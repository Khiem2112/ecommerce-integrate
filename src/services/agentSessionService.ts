import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { appLogger } from '@/lib/logger';
import { chatBroadcaster } from './chatBroadcaster';
import { resolveEscalation } from './escalationService';
import {
  DraftValidationError,
  validateAndPrepareAiDraftService,
  finalizeAppliedAiDraftService,
  type PreparedAiDraftPayload,
} from './aiDraftService';
import {
  sendLazadaImMessage,
  markLazadaSessionRead,
  openLazadaImSession,
  evaluateLazadaSessionValidity,
  evaluateLazadaAntiSpamQuota,
} from './connectors/lazada/lazadaImService';
import type { ActionErrorCode, DbClient, MessageWithSender } from '@/types';

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

export type MarkConversationReadResult = {
  readonly conversationId: number;
  readonly lastReadMessageId: string | null;
};

export type SendOperatorMessageOptions = {
  readonly draftId?: number;
  readonly operatorUserId?: number | null;
  readonly organizationId?: number | null;
  readonly selectedStrategyCode?: string | null;
  readonly customDraftText?: string | null;
  readonly approvedById?: string | null;
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

export class AntiSpamQuotaExceededError extends Error {
  constructor(
    message = 'Lazada anti-spam limit reached: maximum 5 consecutive replies allowed when buyer has not replied within 24 hours.',
  ) {
    super(message);
    this.name = 'AntiSpamQuotaExceededError';
  }
}

export class OutboundDeliveryError extends Error {
  constructor(message = 'Failed to deliver message to Lazada Open API') {
    super(message);
    this.name = 'OutboundDeliveryError';
  }
}

export function classifyOutboundSessionError(
  error: unknown,
  fallbackMessage: string,
): { readonly code: ActionErrorCode; readonly message: string } {
  if (error instanceof ConversationNotFoundError) {
    return { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' };
  }
  if (error instanceof SessionExpiredError) {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Lazada chat session expired (5-day window). Cannot send new messages.',
    };
  }
  if (error instanceof AntiSpamQuotaExceededError) {
    return { code: 'ANTI_SPAM_QUOTA_EXCEEDED', message: error.message };
  }
  if (error instanceof OutboundDeliveryError) {
    return { code: 'PLATFORM_SEND_FAILED', message: error.message };
  }
  if (error instanceof DraftValidationError) {
    return { code: 'DRAFT_VALIDATION_FAILED', message: error.message };
  }
  return {
    code: 'SYSTEM_ERROR',
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

async function runInTransaction<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction((tx) => fn(tx));
  }
  return fn(prisma);
}

function computeMonotonicLastMessageTime(
  incomingTime: Date,
  existingTime?: Date | null,
): Date {
  if (!existingTime) {
    return incomingTime;
  }
  return existingTime.getTime() > incomingTime.getTime() ? existingTime : incomingTime;
}

function parseNumericOrderId(platformOrderId: string | null | undefined): string | number {
  const trimmed = platformOrderId?.trim() ?? '';
  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new OutboundDeliveryError(
      'Cannot open Lazada IM session: linked order has an invalid platform order ID.',
    );
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : trimmed;
}

function isLazadaPlatformConnection(
  connection: { readonly platform?: { readonly code?: string | null } | null } | null | undefined,
): boolean {
  const platformCode = connection?.platform?.code;
  return !platformCode || platformCode === 'lazada';
}

function isAuthorizedConversation<
  T extends {
    readonly isActive: boolean;
    readonly connection?: { readonly organizationId?: number | null } | null;
  },
>(
  conversation: T | null,
  organizationId: number | null | undefined,
): conversation is T {
  if (!conversation || !conversation.isActive) {
    return false;
  }
  if (organizationId === null) {
    return false;
  }
  if (organizationId !== undefined && conversation.connection?.organizationId !== organizationId) {
    return false;
  }
  return true;
}

async function findLatestReadMessageId(
  conversationId: number,
  db: DbClient,
): Promise<string | null> {
  if (typeof db.message?.findFirst !== 'function') {
    return null;
  }

  const latestBuyerMessage = await db.message.findFirst({
    where: {
      conversationId,
      isActive: true,
      platformMessageId: { not: null },
      senderType: { code: 'buyer' },
    },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    select: { platformMessageId: true },
  });

  if (latestBuyerMessage?.platformMessageId) {
    return latestBuyerMessage.platformMessageId;
  }

  const latestPlatformMessage = await db.message.findFirst({
    where: {
      conversationId,
      isActive: true,
      platformMessageId: { not: null },
    },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    select: { platformMessageId: true },
  });

  return latestPlatformMessage?.platformMessageId ?? null;
}

async function resolveSenderTypeId(senderTypeCode: string, db: DbClient): Promise<number> {
  if (typeof db.senderType?.findFirst !== 'function') {
    return 2;
  }

  const matched = await db.senderType.findFirst({
    where: { code: senderTypeCode, isActive: true },
    select: { id: true },
  });
  if (matched) {
    return matched.id;
  }

  if (senderTypeCode !== 'seller') {
    const sellerFallback = await db.senderType.findFirst({
      where: { code: 'seller', isActive: true },
      select: { id: true },
    });
    if (sellerFallback) {
      return sellerFallback.id;
    }
  }

  return 2;
}

export async function takeoverConversationSession(
  conversationId: number,
  operatorUserId?: number | null,
  organizationId?: number | null,
): Promise<TakeoverSessionResult> {
  const txResult = await runInTransaction(async (db) => {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        connection: {
          include: {
            platform: true,
          },
        },
        status: true,
      },
    });

    if (!isAuthorizedConversation(conversation, organizationId)) {
      throw new ConversationNotFoundError();
    }

    const inProgressStatus = await db.conversationStatus.findFirst({
      where: { code: 'in_progress', isActive: true },
      select: { id: true },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: {
        statusId: inProgressStatus?.id ?? conversation.statusId,
        humanApprovalRequired: true,
        unreadCount: 0,
      },
    });

    const lastReadMessageId = conversation.platformSessionId
      ? await findLatestReadMessageId(conversationId, db)
      : null;

    return {
      connectionId: conversation.connectionId,
      organizationId: conversation.connection?.organizationId,
      platformSessionId: conversation.platformSessionId,
      lastMessageTime: conversation.lastMessageTime,
      isLazada: isLazadaPlatformConnection(conversation.connection),
      lastReadMessageId,
    };
  });

  if (txResult.platformSessionId && txResult.lastReadMessageId && txResult.isLazada) {
    const readResult = await markLazadaSessionRead(
      txResult.connectionId,
      txResult.platformSessionId,
      txResult.lastReadMessageId,
    );
    if (!readResult.success) {
      appLogger.warn('Failed to mark Lazada session read during operator takeover', {
        conversationId,
        sessionId: txResult.platformSessionId,
        error: readResult.error,
      });
    }
  }

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:operator_takeover',
      sessionId: txResult.platformSessionId || '',
      conversationId,
      sellerAccountId: operatorUserId ? String(operatorUserId) : 'operator',
    },
    txResult.organizationId,
  );

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:session_updated',
      sessionId: txResult.platformSessionId || '',
      connectionId: txResult.connectionId,
      conversationId,
      unreadCount: 0,
      lastMessageTime: txResult.lastMessageTime ?? undefined,
    },
    txResult.organizationId,
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

export async function markConversationAsRead(
  conversationId: number,
  organizationId?: number | null,
): Promise<MarkConversationReadResult> {
  const readContext = await runInTransaction(async (db) => {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        connection: {
          include: {
            platform: true,
          },
        },
      },
    });

    if (!isAuthorizedConversation(conversation, organizationId)) {
      throw new ConversationNotFoundError();
    }

    const lastReadMessageId = await findLatestReadMessageId(conversationId, db);

    return {
      conversationId: conversation.id,
      connectionId: conversation.connectionId,
      organizationId: conversation.connection?.organizationId,
      platformSessionId: conversation.platformSessionId,
      lastMessageTime: conversation.lastMessageTime,
      isLazada: isLazadaPlatformConnection(conversation.connection),
      lastReadMessageId,
    };
  });

  if (
    readContext.platformSessionId &&
    readContext.lastReadMessageId &&
    readContext.isLazada
  ) {
    const syncResult = await markLazadaSessionRead(
      readContext.connectionId,
      readContext.platformSessionId,
      readContext.lastReadMessageId,
    );

    if (!syncResult.success) {
      appLogger.warn('Unable to sync read state to Lazada Open API', {
        conversationId,
        sessionId: readContext.platformSessionId,
        lastReadMessageId: readContext.lastReadMessageId,
        error: syncResult.error,
      });
    }
  }

  await runInTransaction(async (db) => {
    await db.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  });

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:session_updated',
      sessionId: readContext.platformSessionId || '',
      connectionId: readContext.connectionId,
      conversationId: readContext.conversationId,
      unreadCount: 0,
      lastMessageTime: readContext.lastMessageTime ?? undefined,
    },
    readContext.organizationId,
  );

  return {
    conversationId,
    lastReadMessageId: readContext.lastReadMessageId,
  };
}

export async function sendOperatorMessage(
  conversationId: number,
  text: string,
  draftIdOrOptions?: number | SendOperatorMessageOptions,
  operatorUserIdParam?: number | null,
): Promise<MessageWithSender> {
  const options: SendOperatorMessageOptions =
    typeof draftIdOrOptions === 'object' && draftIdOrOptions !== null
      ? draftIdOrOptions
      : {
          draftId: draftIdOrOptions,
          operatorUserId: operatorUserIdParam,
        };

  const draftId = options.draftId;
  const operatorUserId = options.operatorUserId ?? operatorUserIdParam ?? null;
  const organizationId = options.organizationId;

  const validatedContext = await runInTransaction(async (db) => {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        connection: {
          include: {
            platform: true,
          },
        },
        status: true,
      },
    });

    if (!isAuthorizedConversation(conversation, organizationId)) {
      throw new ConversationNotFoundError();
    }

    const recentMessages =
      typeof db.message?.findMany === 'function'
        ? await db.message.findMany({
            where: { conversationId: conversation.id, isActive: true },
            include: { senderType: true },
            orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
            take: 50,
          })
        : [];

    let latestBuyerMessageTime: Date | null = null;
    let consecutiveOutboundReplies = 0;

    for (const msg of recentMessages ?? []) {
      const senderCode = msg.senderType?.code;
      if (senderCode === 'buyer') {
        latestBuyerMessageTime = msg.timestamp;
        break;
      }
      if (
        senderCode !== 'system' &&
        msg.status !== 'FAILED' &&
        msg.status !== 'RECALLED'
      ) {
        consecutiveOutboundReplies += 1;
      }
    }

    if (
      !latestBuyerMessageTime &&
      recentMessages &&
      recentMessages.length === 50 &&
      typeof db.message?.findFirst === 'function'
    ) {
      const olderBuyerMessage = await db.message.findFirst({
        where: {
          conversationId: conversation.id,
          isActive: true,
          senderType: { code: 'buyer' },
        },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        select: { timestamp: true },
      });
      latestBuyerMessageTime = olderBuyerMessage?.timestamp ?? null;
    }

    // Preserve compatibility for conversations/fixtures with no persisted message rows yet
    const effectiveBuyerTime =
      latestBuyerMessageTime ??
      (!recentMessages || recentMessages.length === 0
        ? (conversation.lastMessageTime ?? null)
        : null);

    const isLazada = isLazadaPlatformConnection(conversation.connection);
    const latestOrder =
      isLazada && typeof db.order?.findFirst === 'function'
        ? await db.order.findFirst({
            where: {
              connectionId: conversation.connectionId,
              customerId: conversation.customerId,
              isActive: true,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, platformOrderId: true, createdAt: true },
          })
        : null;

    let requiresSessionOpen = false;
    if (isLazada) {
      const validity = evaluateLazadaSessionValidity({
        lastBuyerMessageTime: effectiveBuyerTime,
        latestOrderTime: latestOrder?.createdAt ?? null,
      });

      if (!validity.isValid) {
        throw new SessionExpiredError();
      }

      const quota = evaluateLazadaAntiSpamQuota({
        lastBuyerMessageTime: effectiveBuyerTime,
        consecutiveSellerRepliesSinceLastBuyer: consecutiveOutboundReplies,
      });

      if (!quota.allowed) {
        throw new AntiSpamQuotaExceededError();
      }

      requiresSessionOpen = validity.requiresSessionOpen;
    }

    let preparedDraft: PreparedAiDraftPayload | null = null;
    if (draftId !== undefined) {
      preparedDraft = await validateAndPrepareAiDraftService(
        draftId,
        {
          conversationId: conversation.id,
          selectedStrategyCode: options.selectedStrategyCode ?? null,
          customDraftText: options.customDraftText,
          candidateText: text,
        },
        db,
      );
    }

    const effectiveSenderCode = preparedDraft?.senderTypeCode ?? 'seller';
    const senderTypeId = await resolveSenderTypeId(effectiveSenderCode, db);

    return {
      conversation,
      latestOrder,
      requiresSessionOpen,
      preparedDraft,
      effectiveSenderCode,
      senderTypeId,
    };
  });

  const { conversation, latestOrder, requiresSessionOpen, preparedDraft, effectiveSenderCode, senderTypeId } =
    validatedContext;
  const effectiveText = preparedDraft?.messageText ?? text;
  const platformCode = conversation.connection?.platform?.code;
  const isLazada = isLazadaPlatformConnection(conversation.connection);
  let activeSessionId = conversation.platformSessionId?.trim() || '';

  if (requiresSessionOpen && isLazada) {
    const validOrderId = parseNumericOrderId(latestOrder?.platformOrderId);
    const openResult = await openLazadaImSession(conversation.connectionId, validOrderId);
    if (!openResult.success) {
      throw new OutboundDeliveryError(
        openResult.error || 'Failed to reopen Lazada IM session from recent order.',
      );
    }
    if (!openResult.data?.session_id) {
      throw new OutboundDeliveryError(
        'Lazada IM /im/session/open response did not include session_id.',
      );
    }
    activeSessionId = openResult.data.session_id.trim();
  }

  const placeholderMessage = await runInTransaction(async (db) => {
    if (activeSessionId && activeSessionId !== conversation.platformSessionId) {
      await db.conversation.update({
        where: { id: conversation.id },
        data: { platformSessionId: activeSessionId },
      });
    }

    return db.message.create({
      data: {
        conversationId: conversation.id,
        connectionId: conversation.connectionId,
        platformMessageId: null,
        senderTypeId,
        text: effectiveText,
        status: 'SENDING',
        timestamp: new Date(),
        ...(preparedDraft
          ? {
              groundedFacts: [...preparedDraft.groundedFacts],
              ungroundedClaims: [...preparedDraft.ungroundedClaims],
              confidence: preparedDraft.confidence,
              suggestedAction: preparedDraft.suggestedAction,
            }
          : {}),
      },
      include: { senderType: true },
    });
  });

  if (activeSessionId) {
    try {
      await redis.del(`session:${activeSessionId}:debounce`);
    } catch (redisError) {
      appLogger.warn('Failed to clear bot debounce key before operator send', {
        conversationId: conversation.id,
        sessionId: activeSessionId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
    }
  }

  let imResult: { success: boolean; messageId?: string; currentTime?: number; error?: string };
  if (activeSessionId && isLazada) {
    imResult = await sendLazadaImMessage(
      conversation.connectionId,
      activeSessionId,
      effectiveText,
    );
  } else if (platformCode === 'lazada' && !activeSessionId) {
    imResult = {
      success: false,
      error: 'Missing Lazada platform session ID for outbound delivery.',
    };
  } else {
    imResult = { success: true };
  }

  if (!imResult.success) {
    await runInTransaction(async (db) => {
      if (typeof db.message?.update === 'function') {
        await db.message.update({
          where: { id: placeholderMessage.id },
          data: { status: 'FAILED' },
        });
      }
    });

    throw new OutboundDeliveryError(
      imResult.error || 'Failed to send message to Lazada Open API',
    );
  }

  const resolvedPlatformMessageId = imResult.messageId?.trim() || null;
  const committedTimestamp = imResult.currentTime
    ? new Date(imResult.currentTime)
    : new Date();
  const approvedById =
    options.approvedById ?? (operatorUserId ? String(operatorUserId) : null);

  const committedResult = await runInTransaction(async (db) => {
    const updatedMessage =
      typeof db.message?.update === 'function'
        ? await db.message.update({
            where: { id: placeholderMessage.id },
            data: {
              status: 'SENT',
              platformMessageId: resolvedPlatformMessageId,
              connectionId: conversation.connectionId,
              timestamp: committedTimestamp,
            },
            include: { senderType: true },
          })
        : null;

    const finalMessage: MessageWithSender = updatedMessage ?? {
      ...placeholderMessage,
      status: 'SENT',
      platformMessageId: resolvedPlatformMessageId,
      connectionId: conversation.connectionId,
      timestamp: committedTimestamp,
      senderType: placeholderMessage.senderType ?? {
        id: senderTypeId,
        code: effectiveSenderCode,
        name: effectiveSenderCode === 'seller' ? 'Seller' : effectiveSenderCode,
        isHuman: effectiveSenderCode === 'seller',
        isAgent: effectiveSenderCode.startsWith('agent_'),
      },
    };

    const monotonicTime = computeMonotonicLastMessageTime(
      finalMessage.timestamp,
      conversation.lastMessageTime,
    );

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageTime: monotonicTime,
        unreadCount: 0,
        humanApprovalRequired: false,
      },
    });

    return {
      finalMessage,
      monotonicTime,
    };
  });

  const orgId = conversation.connection?.organizationId;
  const senderCode = committedResult.finalMessage.senderType?.code ?? effectiveSenderCode;

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:message_received',
      conversationId: conversation.id,
      messageId: committedResult.finalMessage.id,
      platformMessageId: committedResult.finalMessage.platformMessageId || '',
      senderCode,
      text: committedResult.finalMessage.text,
      status: 'SENT',
      timestamp: committedResult.finalMessage.timestamp,
    },
    orgId,
  );

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:session_updated',
      sessionId: activeSessionId || '',
      connectionId: conversation.connectionId,
      conversationId: conversation.id,
      unreadCount: 0,
      lastMessageTime: committedResult.monotonicTime,
    },
    orgId,
  );

  // Isolate escalation resolution and draft finalization so follow-up conflicts never revert the delivered SENT message
  try {
    await runInTransaction(async (db) => {
      const openAuditLog =
        typeof db.escalationAuditLog?.findFirst === 'function'
          ? await db.escalationAuditLog.findFirst({
              where: {
                conversationId: conversation.id,
                resolvedAt: null,
                isActive: true,
              },
              orderBy: { escalatedAt: 'desc' },
              select: { id: true },
            })
          : null;

      if (openAuditLog && operatorUserId != null) {
        await resolveEscalation(
          {
            auditLogId: openAuditLog.id,
            conversationId: conversation.id,
            handledByUserId: operatorUserId,
            resolutionNote: 'Resolved by operator outbound reply',
          },
          db,
        );
      }
    });
  } catch (escalationError) {
    appLogger.warn('Failed to resolve open escalation audit log after outbound delivery', {
      conversationId: conversation.id,
      messageId: committedResult.finalMessage.id,
      error:
        escalationError instanceof Error
          ? escalationError.message
          : String(escalationError),
    });
  }

  if (draftId !== undefined) {
    await runInTransaction(async (db) => {
      await finalizeAppliedAiDraftService(
        draftId,
        {
          selectedStrategyCode: preparedDraft?.selectedStrategyCode,
          customDraftText: preparedDraft?.customDraftText,
          appliedMessageId: committedResult.finalMessage.id,
          approvedById,
        },
        db,
      );
    });
  }

  appLogger.info('Operator sent outbound message to customer', {
    conversationId: conversation.id,
    messageId: committedResult.finalMessage.id,
    platformMessageId: committedResult.finalMessage.platformMessageId,
    operatorUserId,
  });

  return committedResult.finalMessage;
}

export async function handbackSessionToBot(
  conversationId: number,
  organizationId?: number | null,
): Promise<HandbackSessionResult> {
  const txResult = await runInTransaction(async (db) => {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        connection: true,
      },
    });

    if (!isAuthorizedConversation(conversation, organizationId)) {
      throw new ConversationNotFoundError();
    }

    const awaitingReplyStatus = await db.conversationStatus.findFirst({
      where: { code: 'awaiting_reply', isActive: true },
      select: { id: true },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: {
        statusId: awaitingReplyStatus?.id ?? conversation.statusId,
        humanApprovalRequired: false,
        escalationStatusId: null,
      },
    });

    return {
      platformSessionId: conversation.platformSessionId || '',
      connectionId: conversation.connectionId,
      organizationId: conversation.connection?.organizationId,
    };
  });

  await chatBroadcaster.publishChatEvent(
    {
      type: 'chat:session_updated',
      sessionId: txResult.platformSessionId,
      connectionId: txResult.connectionId,
      conversationId,
    },
    txResult.organizationId,
  );

  appLogger.info('Operator handed session control back to AI bot', {
    conversationId,
  });

  return { conversationId };
}

export async function resolveConversationSession(
  conversationId: number,
  resolutionNote: string,
  handledByUserId: number,
  auditLogId?: number,
  organizationId?: number | null,
): Promise<ResolveSessionResult> {
  const txResult = await runInTransaction(async (db) => {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        connection: true,
      },
    });

    if (!isAuthorizedConversation(conversation, organizationId)) {
      throw new ConversationNotFoundError();
    }

    let targetAuditLogId = auditLogId;
    if (!targetAuditLogId) {
      const openAuditLog = await db.escalationAuditLog.findFirst({
        where: {
          conversationId,
          resolvedAt: null,
          isActive: true,
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
        db,
      );
      return {
        resolvedViaAuditLog: true,
        organizationId: conversation.connection?.organizationId,
      };
    }

    const resolvedStatus = await db.conversationStatus.findFirst({
      where: { code: 'resolved', isActive: true },
      select: { id: true },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: {
        statusId: resolvedStatus?.id ?? conversation.statusId,
        humanApprovalRequired: false,
      },
    });

    return {
      resolvedViaAuditLog: false,
      organizationId: conversation.connection?.organizationId,
    };
  });

  if (!txResult.resolvedViaAuditLog) {
    await chatBroadcaster.publishChatEvent(
      {
        type: 'chat:session_resolved',
        auditLogId: 0,
        conversationId,
        handledByUserId,
      },
      txResult.organizationId,
    );
  }

  appLogger.info('Operator marked session as resolved', {
    conversationId,
    handledByUserId,
  });

  return { conversationId };
}
