import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { withDistributedLock } from '@/lib/redlock';
import { appLogger } from '@/lib/logger';
import {
  evaluateAutonomousGrounding,
  type AutonomousGroundingResult,
} from '@/services/rag/groundingValidator';
import { createEscalationAuditLog } from '@/services/escalationService';
import type {
  DbClient,
  EscalationTriggerSource,
  MessageWithSender,
} from '@/types';

export const AgentAiDraftSchema = z.object({
  suggestedDraft: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  groundedFacts: z.array(z.string()),
  detectedIntent: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  proposedAction: z.enum(['auto_reply', 'await_approval', 'escalate_to_human']),
});

export type AgentAiDraftOutput = z.infer<typeof AgentAiDraftSchema>;

export type AgentSessionTurnResult = {
  handled: boolean;
  actionTaken: 'auto_replied' | 'escalated' | 'skipped';
  groundingResult?: AutonomousGroundingResult;
  sentMessage?: MessageWithSender;
  reason?: string;
};

export async function processAgentConversationTurn(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<AgentSessionTurnResult> {
  const lockKey = `conversation:${conversationId}`;

  const lockResult = await withDistributedLock(lockKey, 10000, async () => {
    const conversation = await tx.conversation.findUnique({
      where: { id: conversationId, isActive: true },
      include: {
        customer: {
          include: { vipTier: true },
        },
        connection: true,
        status: true,
      },
    });

    if (!conversation) {
      return {
        handled: false,
        actionTaken: 'skipped' as const,
        reason: `Conversation ${conversationId} not found or inactive`,
      };
    }

    if (conversation.status.code === 'in_progress' || conversation.status.code === 'closed') {
      return {
        handled: false,
        actionTaken: 'skipped' as const,
        reason: `Conversation is currently ${conversation.status.code}, bot intervention disabled`,
      };
    }

    const recentMessages = await tx.message.findMany({
      where: { conversationId, isActive: true },
      include: { senderType: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const chronologicalMessages = [...recentMessages].reverse();
    const lastMessage = recentMessages[0];

    if (!lastMessage || lastMessage.senderType.code !== 'buyer') {
      return {
        handled: false,
        actionTaken: 'skipped' as const,
        reason: 'Last message is not from buyer, skipping turn',
      };
    }

    const customerMessageText = lastMessage.text || '';
    const vipTierCode = conversation.customer.vipTier.code.toLowerCase();

    const availableFacts = await tx.factCatalog.findMany({
      where: {
        OR: [
          { connectionId: conversation.connectionId },
          { connectionId: null },
        ],
        isActive: true,
      },
    });

    const factCatalogMap = new Map(availableFacts.map((f) => [f.factCode, f]));
    const availableFactCodes = Array.from(factCatalogMap.keys());

    const rawDraft = generateCoPilotDraft(
      customerMessageText,
      vipTierCode,
      availableFacts,
    );

    const draftOutput = AgentAiDraftSchema.parse(rawDraft);

    const groundingResult = evaluateAutonomousGrounding({
      customerMessage: customerMessageText,
      suggestedDraft: draftOutput.suggestedDraft,
      confidenceScore: draftOutput.confidenceScore,
      citedFactCodes: draftOutput.groundedFacts,
      customerVipTierCode: vipTierCode,
      sentiment: draftOutput.sentiment,
      availableFactCodes,
    });

    if (groundingResult.canAutoReply) {
      let consecutivePriorAgentMessages = 0;
      for (let i = 1; i < recentMessages.length; i++) {
        if (recentMessages[i].senderType.code === 'buyer') {
          break;
        }
        if (recentMessages[i].senderType.isAgent) {
          consecutivePriorAgentMessages++;
        }
      }

      if (consecutivePriorAgentMessages >= 5) {
        await createEscalationAuditLog(
          {
            conversationId,
            triggerSource: 'manual_operator',
            confidenceScore: draftOutput.confidenceScore,
            reasonSummary: 'Đã đạt hạn mức tối đa 5 tin nhắn tự động liên tiếp mà khách chưa phản hồi',
            suggestedDraft: draftOutput.suggestedDraft,
          },
          tx,
        );

        return {
          handled: true,
          actionTaken: 'escalated' as const,
          groundingResult,
          reason: 'Daily platform threshold reached',
        };
      }

      const agentSenderType = await tx.senderType.findFirst({
        where: { code: 'agent_logistics' },
      });

      const awaitingReplyStatus = await tx.conversationStatus.findFirst({
        where: { code: 'awaiting_reply' },
        select: { id: true },
      });

      const sentMessage = await tx.message.create({
        data: {
          conversationId,
          connectionId: conversation.connectionId,
          senderTypeId: agentSenderType?.id ?? 3,
          text: draftOutput.suggestedDraft,
          groundedFacts: draftOutput.groundedFacts,
          confidence: draftOutput.confidenceScore,
          suggestedAction: 'auto_reply',
          status: 'SENT',
          timestamp: new Date(),
        },
        include: { senderType: true },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          statusId: awaitingReplyStatus?.id ?? conversation.statusId,
          lastMessageTime: sentMessage.timestamp,
        },
      });

      await redis.publish(
        'chat:events',
        JSON.stringify({
          type: 'chat:bot_replied',
          conversationId,
          messageId: sentMessage.id,
          groundedFacts: draftOutput.groundedFacts,
          text: draftOutput.suggestedDraft,
        }),
      );

      return {
        handled: true,
        actionTaken: 'auto_replied' as const,
        groundingResult,
        sentMessage,
      };
    }

    const triggerSource =
      (groundingResult.triggerSource as EscalationTriggerSource) ??
      'grounding_failure';

    await createEscalationAuditLog(
      {
        conversationId,
        triggerSource,
        confidenceScore: draftOutput.confidenceScore,
        reasonSummary:
          groundingResult.reasonSummary ??
          'Chuyển giao do không đạt ngưỡng tin cậy an toàn',
        suggestedDraft: draftOutput.suggestedDraft,
        isUrgent: groundingResult.isVipNegativeSentiment,
      },
      tx,
    );

    return {
      handled: true,
      actionTaken: 'escalated' as const,
      groundingResult,
      reason: groundingResult.reasonSummary,
    };
  });

  if (!lockResult) {
    throw new Error(`Lock contention on conversation:${conversationId}`);
  }

  return lockResult;
}

function generateCoPilotDraft(
  customerMessage: string,
  vipTierCode: string,
  availableFacts: Array<{ factCode: string; title: string; content: string; category: string }>,
): AgentAiDraftOutput {
  const normalized = customerMessage.toLowerCase();

  const matchingFact = availableFacts.find(
    (f) =>
      normalized.includes(f.title.toLowerCase()) ||
      normalized.includes(f.category.toLowerCase()) ||
      normalized.includes(f.factCode.toLowerCase()),
  );

  if (matchingFact) {
    return {
      suggestedDraft: `Dạ chào quý khách! Theo chính sách của cửa hàng: ${matchingFact.content}`,
      confidenceScore: 0.95,
      groundedFacts: [matchingFact.factCode],
      detectedIntent: matchingFact.category,
      sentiment: 'neutral',
      proposedAction: 'auto_reply',
    };
  }

  if (
    normalized.includes('bảo hành') ||
    normalized.includes('đổi trả') ||
    normalized.includes('hoàn tiền')
  ) {
    const policyFact = availableFacts.find(
      (f) => f.category === 'warranty' || f.category === 'return_policy',
    );

    if (policyFact) {
      return {
        suggestedDraft: `Dạ chào quý khách! Cửa hàng áp dụng quy định: ${policyFact.content}`,
        confidenceScore: 0.92,
        groundedFacts: [policyFact.factCode],
        detectedIntent: policyFact.category,
        sentiment: 'neutral',
        proposedAction: 'auto_reply',
      };
    }
  }

  return {
    suggestedDraft: 'Dạ shop xin phép kiểm tra thông tin và hỗ trợ mình ngay ạ!',
    confidenceScore: 0.65,
    groundedFacts: [],
    detectedIntent: 'general_query',
    sentiment: 'neutral',
    proposedAction: 'escalate_to_human',
  };
}
