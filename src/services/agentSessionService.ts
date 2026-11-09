import { prisma } from '@/lib/prisma';
import { appLogger } from '@/lib/logger';
import { chatBroadcaster } from './chatBroadcaster';
import { resolveEscalation } from './escalationService';
import {
  sendLazadaImMessage,
  markLazadaSessionRead,
} from './connectors/lazada/lazadaImService';
import type { DbClient, Message } from '@/types';

const LAZADA_SESSION_EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000;

export type TakeoverSessionResult = {
  readonly conversationId: number;
  readonly status: string;
};

export type HandbackSessionResult = {
  readonly conversationId: number;
};

export type ResolveSessionResult = {
  readonly conversationId: number;
};

export class SessionExpiredError extends Error {
  constructor(message = 'Session has expired beyond 5-day window') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class ConversationNotFoundError extends Error {
  constructor(message = 'Conversation not found') {
    super(message);
    this.name = 'ConversationNotFoundError';
  }
}

export async function takeoverConversationSession(
  conversationId: number,
  operatorUserId?: number | null,
  tx: DbClient = prisma,
): Promise<TakeoverSessionResult> {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId, isActive: true },
    include: {
      connection: true,
      status: true,
    },
  });

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  const inProgressStatus = await tx.conversationStatus.findFirst({
    where: { code: 'in_progress' },
    select: { id: true },
  });

  await tx.conversation.update({
    where: { id: conversationId },
    data: {
      statusId: inProgressStatus?.id ?? conversation.statusId,
      humanApprovalRequired: true,
    },
  });

  if (conversation.platformSessionId) {
    void markLazadaSessionRead(
      conversation.connectionId,
      conversation.platformSessionId,
    );
  }

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:operator_takeover',
      sessionId: conversation.platformSessionId || '',
      conversationId: conversation.id,
      sellerAccountId: operatorUserId ? String(operatorUserId) : 'operator',
    },
    conversation.connection?.organizationId,
  );

  appLogger.info('Operator took over conversation session', {
    conversationId,
    operatorUserId,
  });

  return {
    conversationId,
    status: 'in_progress',
  };
}

export async function sendOperatorMessage(
  conversationId: number,
  text: string,
  draftId?: number,
  operatorUserId?: number | null,
  tx: DbClient = prisma,
): Promise<Message> {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId, isActive: true },
    include: {
      connection: true,
    },
  });

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  const lastMessageTimestamp = conversation.lastMessageTime
    ? new Date(conversation.lastMessageTime).getTime()
    : 0;

  if (
    lastMessageTimestamp > 0 &&
    Date.now() - lastMessageTimestamp > LAZADA_SESSION_EXPIRATION_MS
  ) {
    throw new SessionExpiredError();
  }

  const sessionId = conversation.platformSessionId || '';
  const imResult = await sendLazadaImMessage(
    conversation.connectionId,
    sessionId,
    text,
  );

  if (!imResult.success) {
    throw new Error(imResult.error || 'Failed to send message to Lazada Open API');
  }

  const sellerSenderType = await tx.senderType.findFirst({
    where: { code: 'seller' },
    select: { id: true },
  });

  const createdMessage = await tx.message.create({
    data: {
      conversationId: conversation.id,
      connectionId: conversation.connectionId,
      platformMessageId: imResult.messageId || `msg-${Date.now()}`,
      senderTypeId: sellerSenderType?.id ?? 2,
      text,
      status: 'SENT',
      timestamp: new Date(),
    },
  });

  await tx.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageTime: createdMessage.timestamp,
      unreadCount: 0,
    },
  });

  if (draftId) {
    await tx.aiDraftResponse.updateMany({
      where: { id: draftId },
      data: { status: 'applied' },
    });
  }

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:message_received',
      conversationId: conversation.id,
      messageId: createdMessage.id,
      platformMessageId: createdMessage.platformMessageId || '',
      senderCode: 'seller',
      text: createdMessage.text,
      timestamp: createdMessage.timestamp,
    },
    conversation.connection?.organizationId,
  );

  appLogger.info('Operator sent approved message to customer', {
    conversationId: conversation.id,
    messageId: createdMessage.id,
    operatorUserId,
  });

  return createdMessage;
}

export async function handbackSessionToBot(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<HandbackSessionResult> {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId, isActive: true },
    include: {
      connection: true,
    },
  });

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  const awaitingReplyStatus = await tx.conversationStatus.findFirst({
    where: { code: 'awaiting_reply' },
    select: { id: true },
  });

  await tx.conversation.update({
    where: { id: conversationId },
    data: {
      statusId: awaitingReplyStatus?.id ?? conversation.statusId,
      humanApprovalRequired: false,
      escalationStatusId: null,
    },
  });

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:session_updated',
      sessionId: conversation.platformSessionId || '',
      connectionId: conversation.connectionId,
    },
    conversation.connection?.organizationId,
  );

  appLogger.info('Operator handed session control back to AI bot', {
    conversationId,
  });

  return { conversationId };
}

export async function resolveConversationSession(
  conversationId: number,
  resolutionNote = 'Resolved by operator',
  handledByUserId = 1,
  auditLogId?: number,
  tx: DbClient = prisma,
): Promise<ResolveSessionResult> {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId, isActive: true },
    include: {
      connection: true,
    },
  });

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  let targetAuditLogId = auditLogId;
  if (!targetAuditLogId) {
    const openAuditLog = await tx.escalationAuditLog.findFirst({
      where: {
        conversationId,
        resolvedAt: null,
      },
      orderBy: { escalatedAt: 'desc' },
      select: { id: true },
    });
    targetAuditLogId = openAuditLog?.id;
  }

  if (targetAuditLogId) {
    await resolveEscalation(
      {
        auditLogId: targetAuditLogId,
        conversationId,
        handledByUserId,
        resolutionNote,
      },
      tx,
    );
  } else {
    const resolvedStatus = await tx.conversationStatus.findFirst({
      where: { code: 'resolved' },
      select: { id: true },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        statusId: resolvedStatus?.id ?? conversation.statusId,
        humanApprovalRequired: false,
      },
    });

    await chatBroadcaster.publishChatEvent(
      {
        type: 'chat:session_resolved',
        auditLogId: 0,
        conversationId,
        handledByUserId,
      },
      conversation.connection?.organizationId,
    );
  }

  appLogger.info('Operator marked session as resolved', {
    conversationId,
    handledByUserId,
  });

  return { conversationId };
}

