import { prisma } from '@/lib/prisma';
import { appLogger } from '@/lib/logger';
import { chatBroadcaster } from './chatBroadcaster';
import type {
  DbClient,
  EscalationAuditLogRecord,
  EscalationTriggerSource,
  ChatStreamEvent,
} from '@/types';

export type CreateEscalationInput = {
  conversationId: number;
  triggerSource: EscalationTriggerSource;
  reasonSummary: string;
  confidenceScore?: number;
  suggestedDraft?: string;
  handledByUserId?: number;
  isUrgent?: boolean;
};

export async function createEscalationAuditLog(
  input: CreateEscalationInput,
  tx: DbClient = prisma,
): Promise<EscalationAuditLogRecord> {
  const pendingEscalationStatus = await tx.escalationStatus.findFirst({
    where: { code: 'pending' },
    select: { id: true },
  });

  const escalatedConvStatus = await tx.conversationStatus.findFirst({
    where: { code: 'escalated' },
    select: { id: true },
  });

  const auditLog = await tx.escalationAuditLog.create({
    data: {
      conversationId: input.conversationId,
      triggerSource: input.triggerSource,
      confidenceScore: input.confidenceScore,
      reasonSummary: input.reasonSummary,
      suggestedDraft: input.suggestedDraft,
      handledByUserId: input.handledByUserId,
      escalatedAt: new Date(),
    },
    include: {
      conversation: true,
      handledByUser: true,
    },
  });

  await tx.conversation.update({
    where: { id: input.conversationId },
    data: {
      statusId: escalatedConvStatus?.id ?? undefined,
      escalationStatusId: pendingEscalationStatus?.id ?? undefined,
      priority: input.isUrgent ? 'urgent' : undefined,
    },
  });

  let orgId: number | undefined;
  if (auditLog.conversation?.connectionId) {
    try {
      const conn = await tx.platformConnection?.findUnique?.({
        where: { id: auditLog.conversation.connectionId },
        select: { organizationId: true },
      });
      orgId = conn?.organizationId;
    } catch {
      // Graceful fallback
    }
  }

  const escalationPayload: ChatStreamEvent = {
    type: 'chat:session_escalated',
    auditLogId: auditLog.id,
    conversationId: input.conversationId,
    triggerSource: input.triggerSource,
    confidenceScore: input.confidenceScore ?? 0,
    reasonSummary: input.reasonSummary,
    suggestedDraft: input.suggestedDraft ?? null,
    priority: input.isUrgent ? 'urgent' : 'high',
    timestamp: auditLog.escalatedAt,
  };

  await chatBroadcaster.publishChatEvent(escalationPayload, orgId);

  appLogger.info('Session escalated successfully and alert published', {
    auditLogId: auditLog.id,
    conversationId: input.conversationId,
    triggerSource: input.triggerSource,
  });

  return auditLog as unknown as EscalationAuditLogRecord;
}

export type ResolveEscalationInput = {
  auditLogId: number;
  conversationId: number;
  handledByUserId: number;
  resolutionNote: string;
};

export async function resolveEscalation(
  input: ResolveEscalationInput,
  tx: DbClient = prisma,
): Promise<void> {
  const resolvedEscalationStatus = await tx.escalationStatus.findFirst({
    where: { code: 'resolved_by_human' },
    select: { id: true },
  });

  await tx.escalationAuditLog.update({
    where: { id: input.auditLogId },
    data: {
      handledByUserId: input.handledByUserId,
      resolvedAt: new Date(),
      resolutionNote: input.resolutionNote,
    },
  });

  const updatedConversation = await tx.conversation.update({
    where: { id: input.conversationId },
    data: {
      escalationStatusId: resolvedEscalationStatus?.id ?? undefined,
    },
  });

  let orgId: number | undefined;
  if (updatedConversation?.connectionId) {
    try {
      const conn = await tx.platformConnection?.findUnique?.({
        where: { id: updatedConversation.connectionId },
        select: { organizationId: true },
      });
      orgId = conn?.organizationId;
    } catch {
      // Graceful fallback
    }
  }

  const resolvedPayload: ChatStreamEvent = {
    type: 'chat:session_resolved',
    auditLogId: input.auditLogId,
    conversationId: input.conversationId,
    handledByUserId: input.handledByUserId,
  };

  await chatBroadcaster.publishChatEvent(resolvedPayload, orgId);

  appLogger.info('Escalation resolved by operator', {
    auditLogId: input.auditLogId,
    conversationId: input.conversationId,
    handledByUserId: input.handledByUserId,
  });
}

export async function getEscalationHistory(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<EscalationAuditLogRecord[]> {
  const logs = await tx.escalationAuditLog.findMany({
    where: {
      conversationId,
      isActive: true,
    },
    include: {
      conversation: true,
      handledByUser: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return logs as unknown as EscalationAuditLogRecord[];
}

