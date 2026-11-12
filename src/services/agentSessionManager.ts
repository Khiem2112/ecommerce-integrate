import { prisma } from '@/lib/prisma';
import { withDistributedLock } from '@/lib/redlock';
import { appLogger } from '@/lib/logger';
import { generateGroundedResponse } from '@/services/rag';
import {
  buildGroundingFactCatalog,
  type GroundingFact,
} from '@/services/rag/groundingFacts';
import {
  evaluateAutonomousGrounding,
  type AutonomousGroundingResult,
} from '@/services/rag/groundingValidator';
import { resolveIntentTier } from '@/services/rag/intentRouter';
import {
  createEscalationAuditLog,
  type CreateEscalationInput,
} from '@/services/escalationService';
import {
  computeMonotonicLastMessageTime,
  isLazadaPlatformConnection,
  parseNumericOrderId,
  summarizeOutboundTurnWindow,
} from '@/utils';
import { getPoliciesByIntent } from '@/utils/rag';
import { chatBroadcaster } from './chatBroadcaster';
import {
  evaluateLazadaAntiSpamQuota,
  evaluateLazadaSessionValidity,
  openLazadaImSession,
  sendLazadaImMessage,
} from './connectors/lazada/lazadaImService';
import type {
  ChatStreamEvent,
  DbClient,
  EscalationTriggerSource,
  MessageWithSender,
} from '@/types';

const CONVERSATION_LOCK_TTL_MS = 25_000;
const RAG_GENERATION_TIMEOUT_MS = 10_000;
const AUTONOMOUS_ELIGIBLE_STATUS_CODES = new Set(['open', 'awaiting_reply']);
const NEGATIVE_INTENT_CODES = new Set([
  'complaint',
  'dispute',
  'escalation',
  'refund',
]);

export type AgentSessionTurnResult = {
  handled: boolean;
  actionTaken: 'auto_replied' | 'escalated' | 'skipped';
  groundingResult?: AutonomousGroundingResult;
  sentMessage?: MessageWithSender;
  reason?: string;
};

function isAutonomousEligibleStatus(code: string | null | undefined): boolean {
  return Boolean(code && AUTONOMOUS_ELIGIBLE_STATUS_CODES.has(code));
}

async function runInTransaction<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
  if (
    typeof (prisma as unknown as { $transaction?: unknown }).$transaction ===
    'function'
  ) {
    return prisma.$transaction((transactionClient) => fn(transactionClient));
  }
  return fn(prisma);
}

async function generateGroundedResponseWithTimeout(
  conversationId: number,
  timeoutMs: number = RAG_GENERATION_TIMEOUT_MS,
): Promise<Awaited<ReturnType<typeof generateGroundedResponse>>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      generateGroundedResponse(conversationId),
      new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`RAG generation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function resolvePreferredAgentSenderCode(intentCode: string): string {
  const normalized = intentCode.toLowerCase();
  if (
    normalized === 'refund_request' ||
    normalized === 'refund' ||
    normalized === 'cancellation'
  ) {
    return 'agent_refund';
  }
  if (normalized === 'product_info' || normalized === 'repurchase') {
    return 'agent_product';
  }
  return 'agent_logistics';
}

async function resolveBotSenderTypeId(
  db: DbClient,
  intentCode: string,
): Promise<number> {
  const preferredCode = resolvePreferredAgentSenderCode(intentCode);
  const candidateCodes = Array.from(
    new Set([preferredCode, 'agent_logistics', 'seller']),
  );

  for (const code of candidateCodes) {
    const senderType = await db.senderType.findFirst({
      where: { code, isActive: true },
      select: { id: true },
    });
    if (senderType?.id) {
      return senderType.id;
    }
  }

  throw new Error(
    "Missing required active SenderType seed row ('agent_logistics', 'agent_refund', 'agent_product', or 'seller')",
  );
}

async function escalateIfStillAutonomous(
  conversationId: number,
  escalationInput: CreateEscalationInput,
  groundingResult?: AutonomousGroundingResult,
): Promise<AgentSessionTurnResult> {
  const isStillAutonomous = await runInTransaction(async (db) => {
    const freshConversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        isActive: true,
        humanApprovalRequired: true,
        status: { select: { code: true } },
      },
    });

    return (
      Boolean(freshConversation?.isActive) &&
      !freshConversation?.humanApprovalRequired &&
      isAutonomousEligibleStatus(freshConversation?.status?.code)
    );
  });

  if (!isStillAutonomous) {
    return {
      handled: false,
      actionTaken: 'skipped',
      reason: 'Conversation state changed before autonomous escalation',
    };
  }

  await createEscalationAuditLog(escalationInput);

  return {
    handled: true,
    actionTaken: 'escalated',
    groundingResult,
    reason: escalationInput.reasonSummary,
  };
}

export async function processAgentConversationTurn(
  conversationId: number,
): Promise<AgentSessionTurnResult> {
  const lockKey = `conversation:${conversationId}`;

  const lockResult = await withDistributedLock(
    lockKey,
    CONVERSATION_LOCK_TTL_MS,
    async () => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          customer: {
            include: { vipTier: true },
          },
          connection: {
            include: { platform: true },
          },
          status: true,
        },
      });

      if (!conversation || !conversation.isActive) {
        return {
          handled: false,
          actionTaken: 'skipped' as const,
          reason: `Conversation ${conversationId} not found or inactive`,
        };
      }

      if (
        conversation.humanApprovalRequired ||
        !isAutonomousEligibleStatus(conversation.status?.code)
      ) {
        return {
          handled: false,
          actionTaken: 'skipped' as const,
          reason: `Conversation is currently ${conversation.status?.code ?? 'blocked'}, bot intervention disabled`,
        };
      }

      const recentMessages = await prisma.message.findMany({
        where: { conversationId, isActive: true },
        include: { senderType: true },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: 50,
      });

      const lastMessage = recentMessages[0];
      if (!lastMessage) {
        return {
          handled: false,
          actionTaken: 'skipped' as const,
          reason: 'No active messages in conversation, skipping turn',
        };
      }

      const turnWindow = summarizeOutboundTurnWindow(recentMessages);
      let latestBuyerMessageTime = turnWindow.latestBuyerMessageTime;
      const consecutiveOutboundReplies = turnWindow.consecutiveOutboundReplies;

      if (
        !latestBuyerMessageTime &&
        recentMessages.length === 50 &&
        typeof prisma.message?.findFirst === 'function'
      ) {
        const olderBuyerMessage = await prisma.message.findFirst({
          where: {
            conversationId,
            isActive: true,
            senderType: { code: 'buyer' },
          },
          orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
          select: { timestamp: true },
        });
        latestBuyerMessageTime = olderBuyerMessage?.timestamp ?? null;
      }

      const isLazada = isLazadaPlatformConnection(conversation.connection);
      const latestOrder =
        isLazada && typeof prisma.order?.findFirst === 'function'
          ? await prisma.order.findFirst({
              where: {
                connectionId: conversation.connectionId,
                customerId: conversation.customerId,
                isActive: true,
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true, platformOrderId: true, createdAt: true },
            })
          : null;

      let activeSessionId = conversation.platformSessionId?.trim() ?? '';
      let requiresSessionOpen = false;

      if (isLazada) {
        const validity = evaluateLazadaSessionValidity({
          lastBuyerMessageTime: latestBuyerMessageTime,
          latestOrderTime: latestOrder?.createdAt ?? null,
        });

        if (!validity.isValid) {
          return escalateIfStillAutonomous(conversationId, {
            conversationId,
            triggerSource: 'tool_error',
            reasonSummary:
              'Phiên chat Lazada đã hết hạn cửa sổ 5 ngày/7 ngày, chuyển giao cho nhân viên xử lý',
          });
        }

        const quota = evaluateLazadaAntiSpamQuota({
          lastBuyerMessageTime: latestBuyerMessageTime,
          consecutiveSellerRepliesSinceLastBuyer: consecutiveOutboundReplies,
        });

        if (!quota.allowed) {
          return escalateIfStillAutonomous(conversationId, {
            conversationId,
            triggerSource: 'manual_operator',
            reasonSummary:
              'Đã đạt hạn mức tối đa 5 tin nhắn tự động liên tiếp trong 24 giờ khi khách chưa phản hồi',
          });
        }

        requiresSessionOpen = validity.requiresSessionOpen;
      }

      if (lastMessage.senderType?.code !== 'buyer') {
        return {
          handled: false,
          actionTaken: 'skipped' as const,
          reason: 'Last message is not from buyer, skipping turn',
        };
      }

      if (requiresSessionOpen) {
        const numericOrderId = parseNumericOrderId(latestOrder?.platformOrderId);
        if (numericOrderId === null) {
          return escalateIfStillAutonomous(conversationId, {
            conversationId,
            triggerSource: 'tool_error',
            reasonSummary:
              'Không thể mở lại phiên chat Lazada do thiếu mã đơn hàng hợp lệ trong 7 ngày',
          });
        }

        const openResult = await openLazadaImSession(
          conversation.connectionId,
          numericOrderId,
        );
        if (!openResult.success || !openResult.data?.session_id) {
          const openError = !openResult.success ? openResult.error : undefined;
          return escalateIfStillAutonomous(conversationId, {
            conversationId,
            triggerSource: 'tool_error',
            reasonSummary:
              openError ??
              'Không thể mở lại phiên chat Lazada từ đơn hàng 7 ngày gần nhất',
          });
        }

        activeSessionId = openResult.data.session_id.trim();
        if (activeSessionId && activeSessionId !== conversation.platformSessionId) {
          await runInTransaction(async (db) => {
            await db.conversation.update({
              where: { id: conversationId },
              data: { platformSessionId: activeSessionId },
            });
          });
        }
      }

      let ragResult: Awaited<ReturnType<typeof generateGroundedResponse>>;
      try {
        ragResult = await generateGroundedResponseWithTimeout(conversationId);
      } catch (ragError) {
        const message =
          ragError instanceof Error ? ragError.message : String(ragError);
        appLogger.error('RAG generation failed during autonomous bot turn', {
          conversationId,
          error: message,
        });

        return escalateIfStillAutonomous(conversationId, {
          conversationId,
          triggerSource: 'tool_error',
          reasonSummary: `Lỗi tạo phản hồi AI tự động: ${message}`,
        });
      }

      const strategies = ragResult.response?.strategies ?? [];
      const selectedStrategy =
        strategies.find(
          (strategy) => strategy.id === ragResult.response?.recommendedStrategyId,
        ) ??
        strategies.find((strategy) => strategy.rank === 1) ??
        strategies[0];

      if (!selectedStrategy || !selectedStrategy.draftText?.trim()) {
        return escalateIfStillAutonomous(conversationId, {
          conversationId,
          triggerSource: 'tool_error',
          reasonSummary:
            'Hệ thống AI không tạo được phương án trả lời hợp lệ',
        });
      }

      const customerMessageText = lastMessage.text ?? '';
      const vipTierCode =
        conversation.customer?.vipTier?.code?.toLowerCase() ?? 'standard';

      const catalogFacts =
        typeof prisma.factCatalog?.findMany === 'function'
          ? await prisma.factCatalog.findMany({
              where: {
                OR: [
                  { connectionId: conversation.connectionId },
                  { connectionId: null },
                ],
                isActive: true,
              },
              select: { factCode: true },
            })
          : [];

      const detectedIntentCode =
        ragResult.context?.turn?.detectedIntent?.code ?? null;
      const resolvedIntent = resolveIntentTier(
        customerMessageText,
        detectedIntentCode,
      );

      const ragCatalog =
        ragResult.context?.dossier && ragResult.context?.evidence
          ? buildGroundingFactCatalog(
              ragResult.context,
              getPoliciesByIntent(detectedIntentCode ?? resolvedIntent.code),
            )
          : new Map<string, GroundingFact>();

      const strategyGrounding =
        ragResult.grounding?.byStrategyId?.[selectedStrategy.id];
      const availableFactCodes = Array.from(
        new Set([
          ...catalogFacts.map((fact) => fact.factCode),
          ...Array.from(ragCatalog.keys()),
        ]),
      );

      const normalizedDbIntent = detectedIntentCode?.toLowerCase() ?? '';
      const normalizedResolvedIntent = resolvedIntent.code.toLowerCase();
      const intentSentiment =
        NEGATIVE_INTENT_CODES.has(normalizedDbIntent) ||
        NEGATIVE_INTENT_CODES.has(normalizedResolvedIntent)
          ? ('negative' as const)
          : ('neutral' as const);

      let groundingResult = evaluateAutonomousGrounding({
        customerMessage: customerMessageText,
        suggestedDraft: selectedStrategy.draftText,
        confidenceScore: selectedStrategy.confidence,
        citedFactCodes: selectedStrategy.groundedFactsUsed,
        customerVipTierCode: vipTierCode,
        sentiment: intentSentiment,
        availableFactCodes,
      });

      const hasNonAutoReplyAction =
        selectedStrategy.suggestedAction !== 'auto_reply';
      const hasCompensationOffer =
        selectedStrategy.proposedCompensation !== undefined &&
        selectedStrategy.proposedCompensation.kind !== 'none';
      const hasStrategyGroundingViolations =
        (strategyGrounding !== undefined && !strategyGrounding.isValid) ||
        selectedStrategy.ungroundedClaims.length > 0;

      if (
        groundingResult.canAutoReply &&
        (hasNonAutoReplyAction ||
          hasCompensationOffer ||
          hasStrategyGroundingViolations)
      ) {
        const violationDetails =
          strategyGrounding?.violations?.map((v) => v.description).join('; ') ??
          '';
        let gatingReason = violationDetails;
        if (!gatingReason && hasCompensationOffer) {
          gatingReason =
            'Phương án có đề xuất bồi thường hoặc voucher cần nhân viên phê duyệt';
        } else if (!gatingReason && hasNonAutoReplyAction) {
          gatingReason =
            'Phương án yêu cầu nhân viên phê duyệt hoặc tiếp nhận xử lý';
        } else if (!gatingReason) {
          gatingReason =
            'Phương án trả lời vi phạm kiểm tra bằng chứng hoặc chính sách an toàn';
        }

        groundingResult = {
          canAutoReply: false,
          triggerSource: 'grounding_failure',
          reasonSummary: gatingReason,
          confidenceScore: selectedStrategy.confidence,
          isVipNegativeSentiment: false,
          invalidFactCodes: [...selectedStrategy.ungroundedClaims],
        };
      }

      if (!groundingResult.canAutoReply) {
        const triggerSource =
          (groundingResult.triggerSource as EscalationTriggerSource) ??
          'grounding_failure';

        return escalateIfStillAutonomous(
          conversationId,
          {
            conversationId,
            triggerSource,
            confidenceScore: selectedStrategy.confidence,
            reasonSummary:
              groundingResult.reasonSummary ??
              'Chuyển giao do không đạt ngưỡng tin cậy an toàn',
            suggestedDraft: selectedStrategy.draftText,
            isUrgent: groundingResult.isVipNegativeSentiment,
          },
          groundingResult,
        );
      }

      const effectiveIntentCode =
        detectedIntentCode ?? resolvedIntent.code;

      const stepAResult = await runInTransaction(async (db) => {
        const freshConversation = await db.conversation.findUnique({
          where: { id: conversationId },
          select: {
            isActive: true,
            humanApprovalRequired: true,
            statusId: true,
            lastMessageTime: true,
            status: { select: { code: true } },
          },
        });

        if (
          !freshConversation ||
          !freshConversation.isActive ||
          freshConversation.humanApprovalRequired ||
          !isAutonomousEligibleStatus(freshConversation.status?.code)
        ) {
          return { aborted: true as const };
        }

        const senderTypeId = await resolveBotSenderTypeId(
          db,
          effectiveIntentCode,
        );
        const awaitingReplyStatus = await db.conversationStatus.findFirst({
          where: { code: 'awaiting_reply', isActive: true },
          select: { id: true },
        });
        if (!awaitingReplyStatus?.id) {
          throw new Error(
            "Missing required active ConversationStatus seed row with code 'awaiting_reply'",
          );
        }

        const placeholderMessage = await db.message.create({
          data: {
            conversationId,
            connectionId: conversation.connectionId,
            senderTypeId,
            text: selectedStrategy.draftText,
            groundedFacts: selectedStrategy.groundedFactsUsed,
            confidence: selectedStrategy.confidence,
            suggestedAction: 'auto_reply',
            status: 'SENDING',
            timestamp: new Date(),
          },
          include: { senderType: true },
        });

        return {
          aborted: false as const,
          placeholderMessage,
          awaitingReplyStatusId: awaitingReplyStatus.id,
          existingLastMessageTime: freshConversation.lastMessageTime,
        };
      });

      if (stepAResult.aborted) {
        return {
          handled: false,
          actionTaken: 'skipped' as const,
          reason: 'Conversation state changed before autonomous delivery',
        };
      }

      let imResult: {
        success: boolean;
        messageId?: string;
        currentTime?: number;
        error?: string;
      };

      if (activeSessionId && isLazada) {
        imResult = await sendLazadaImMessage(
          conversation.connectionId,
          activeSessionId,
          selectedStrategy.draftText,
        );
      } else if (isLazada && !activeSessionId) {
        imResult = {
          success: false,
          error: 'Missing Lazada platform session ID for autonomous delivery.',
        };
      } else {
        imResult = { success: true };
      }

      if (!imResult.success) {
        await runInTransaction(async (db) => {
          await db.message.update({
            where: { id: stepAResult.placeholderMessage.id },
            data: { status: 'FAILED' },
          });
        });

        const failureSummary =
          imResult.error ?? 'Gửi tin nhắn tự động qua Lazada IM thất bại';

        return escalateIfStillAutonomous(
          conversationId,
          {
            conversationId,
            triggerSource: 'tool_error',
            confidenceScore: selectedStrategy.confidence,
            reasonSummary: failureSummary,
            suggestedDraft: selectedStrategy.draftText,
          },
          groundingResult,
        );
      }

      const sentTimestamp = imResult.currentTime
        ? new Date(imResult.currentTime)
        : new Date();

      const sentMessage = await runInTransaction(async (db) => {
        const updatedMessage = await db.message.update({
          where: { id: stepAResult.placeholderMessage.id },
          data: {
            status: 'SENT',
            ...(imResult.messageId
              ? { platformMessageId: imResult.messageId }
              : {}),
            timestamp: sentTimestamp,
          },
          include: { senderType: true },
        });

        await db.conversation.update({
          where: { id: conversationId },
          data: {
            statusId: stepAResult.awaitingReplyStatusId,
            lastMessageTime: computeMonotonicLastMessageTime(
              sentTimestamp,
              stepAResult.existingLastMessageTime,
            ),
            unreadCount: 0,
          },
        });

        return updatedMessage;
      });

      const botRepliedEvent: ChatStreamEvent = {
        type: 'chat:bot_replied',
        conversationId,
        messageId: sentMessage.id,
        groundedFacts: selectedStrategy.groundedFactsUsed,
        text: selectedStrategy.draftText,
        confidence: groundingResult.confidenceScore,
        timestamp: sentMessage.timestamp,
      };

      await chatBroadcaster.publishChatEvent(
        botRepliedEvent,
        conversation.connection?.organizationId,
      );

      return {
        handled: true,
        actionTaken: 'auto_replied' as const,
        groundingResult,
        sentMessage,
      };
    },
  );

  if (!lockResult) {
    throw new Error(`Lock contention on conversation:${conversationId}`);
  }

  return lockResult;
}
