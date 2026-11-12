import { prisma } from '@/lib/prisma';
import { appLogger } from '@/lib/logger';
import { computeMonotonicLastMessageTime } from '@/utils';
import { scheduleBotConversationTurn, cancelPendingBotTurn } from '@/lib/queue';
import { chatBroadcaster } from './chatBroadcaster';
import { getLazadaImSession } from './connectors/lazada/lazadaImService';
import type {
  ChatStreamEvent,
  Customer,
  LazadaImSessionDetailDTO,
  LazadaPushMessagePayload,
  MessageType,
} from '@/types';

export const RECALLED_MESSAGE_TEXT = '[Tin nhắn đã được thu hồi]';
const ORDER_LINK_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const NESTED_RECORD_KEYS = [
  'data',
  'body',
  'payload',
  'content',
  'message',
  'item',
  'order',
  'voucher',
  'video',
  'card',
] as const;

export const CONVERSATION_INGESTION_SELECT = {
  id: true,
  isActive: true,
  humanApprovalRequired: true,
  unreadCount: true,
  lastMessageTime: true,
  status: {
    select: {
      code: true,
    },
  },
  customer: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      isActive: true,
    },
  },
} as const;

export type ParsedLazadaMessageContent = {
  readonly text: string;
  readonly messageType: MessageType;
  readonly mediaUrl: string | null;
  readonly referenceId: string | null;
};

export type CustomerHydrationTarget = Readonly<
  Pick<Customer, 'id' | 'displayName' | 'avatarUrl'>
>;

export type ActiveConnectionOrgResult = {
  readonly active: boolean;
  readonly organizationId?: number;
};

export type IngestLazadaMessageMode = 'live_webhook' | 'historical_sync';

export type IngestLazadaMessageInput = {
  readonly connectionId: number;
  readonly organizationId?: number;
  readonly payload: LazadaPushMessagePayload;
  readonly mode?: IngestLazadaMessageMode;
  readonly sessionDetail?: LazadaImSessionDetailDTO;
  readonly targetUnreadCount?: number;
  readonly skipHydration?: boolean;
};

export type IngestLazadaMessageOutcome =
  | 'created'
  | 'updated_recalled'
  | 'skipped_duplicate'
  | 'skipped_inactive';

export type IngestLazadaMessageResult = {
  readonly outcome: IngestLazadaMessageOutcome;
  readonly conversationId?: number;
  readonly messageId?: number;
  readonly createdNewConversation?: boolean;
  readonly statusCode?: string | null;
  readonly lastMessageTime?: Date;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParseJsonRecord(content: string): Record<string, unknown> | null {
  if (!content) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(content);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function collectSearchRecords(
  root: Record<string, unknown> | null,
): readonly Record<string, unknown>[] {
  if (!root) {
    return [];
  }

  const collected: Record<string, unknown>[] = [root];
  const visited = new Set<Record<string, unknown>>([root]);

  const enqueueRecord = (candidate: unknown): void => {
    if (isPlainRecord(candidate) && !visited.has(candidate)) {
      visited.add(candidate);
      collected.push(candidate);
    }
  };

  for (const key of NESTED_RECORD_KEYS) {
    enqueueRecord(root[key]);
  }
  for (const value of Object.values(root)) {
    enqueueRecord(value);
  }

  // Inspect second-level nested containers (e.g. data.item or card.body)
  const firstLevelCount = collected.length;
  for (let i = 1; i < firstLevelCount; i += 1) {
    const child = collected[i];
    for (const key of NESTED_RECORD_KEYS) {
      enqueueRecord(child[key]);
    }
  }

  return collected;
}

function pickStringField(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return null;
}

function pickIdentifierField(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
  }
  return null;
}

export function pickNonEmptyStringValue(
  candidates: readonly (string | null | undefined)[],
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function plainTextFallback(
  rawTrimmed: string,
  parsedRoot: Record<string, unknown> | null,
  defaultLabel: string,
): string {
  if (parsedRoot !== null) {
    return defaultLabel;
  }
  if (rawTrimmed.length === 0) {
    return defaultLabel;
  }
  if (rawTrimmed.startsWith('{') || rawTrimmed.startsWith('[')) {
    return defaultLabel;
  }
  return rawTrimmed;
}

function extractBuyerIdFromSessionId(sessionId: string): string | null {
  const parts = sessionId.split('_');
  if (parts.length >= 4 && parts[3] === '1' && parts[2]?.trim().length > 0) {
    return parts[2].trim();
  }
  return null;
}

function resolveBuyerIdentifier(
  payload: LazadaPushMessagePayload,
  sessionDetail?: LazadaImSessionDetailDTO,
): string {
  if (payload.from_account_type === 1) {
    const fromId = String(payload.from_account_id ?? '').trim();
    if (fromId.length > 0) {
      return fromId;
    }
  } else {
    const toId = String(payload.to_account_id ?? '').trim();
    if (toId.length > 0) {
      return toId;
    }
  }

  const sessionBuyerId =
    sessionDetail?.buyer_id !== undefined && sessionDetail.buyer_id !== null
      ? String(sessionDetail.buyer_id).trim()
      : '';
  if (sessionBuyerId.length > 0) {
    return sessionBuyerId;
  }

  const sessionUserAccountId =
    sessionDetail?.user_account_id !== undefined && sessionDetail.user_account_id !== null
      ? String(sessionDetail.user_account_id).trim()
      : '';
  if (sessionUserAccountId.length > 0) {
    return sessionUserAccountId;
  }

  return extractBuyerIdFromSessionId(payload.session_id) ?? 'unknown_buyer';
}

export function isRealLazadaBuyerMessage(
  payload: Pick<
    LazadaPushMessagePayload,
    'from_account_type' | 'status' | 'type' | 'template_id'
  >,
): boolean {
  return (
    payload.from_account_type === 1 &&
    payload.status !== 1 &&
    payload.type !== 2 &&
    payload.template_id !== 2
  );
}

export function isRealLazadaOperatorReply(
  payload: Pick<
    LazadaPushMessagePayload,
    'from_account_type' | 'status' | 'auto_reply' | 'type' | 'template_id'
  >,
): boolean {
  return (
    payload.from_account_type === 2 &&
    payload.status !== 1 &&
    payload.auto_reply !== true &&
    payload.type !== 2 &&
    payload.template_id !== 10015 &&
    payload.template_id !== 2
  );
}

/**
 * Parses Lazada IM template content JSON into typed message fields without throwing on malformed input.
 */
export function parseLazadaMessageContent(
  content: string,
  templateId?: number,
  messageTypeHint?: number,
): ParsedLazadaMessageContent {
  const rawContent = typeof content === 'string' ? content : '';
  const trimmedContent = rawContent.trim();
  const parsedRoot = tryParseJsonRecord(trimmedContent);
  const records = collectSearchRecords(parsedRoot);

  if (templateId === 2 || messageTypeHint === 2) {
    const systemText = pickStringField(records, [
      'recallContent',
      'recall_content',
      'txt',
      'text',
      'content',
      'title',
      'msg',
      'message',
    ]);
    return {
      text: systemText ?? plainTextFallback(trimmedContent, parsedRoot, '[System message]'),
      messageType: 'SYSTEM',
      mediaUrl: null,
      referenceId: null,
    };
  }

  switch (templateId) {
    case 3: {
      const mediaUrl = pickStringField(records, ['imgUrl', 'img_url', 'url', 'picUrl', 'pic_url']);
      const caption = pickStringField(records, ['txt', 'text', 'caption', 'title']);
      return {
        text: caption ?? '[Image]',
        messageType: 'IMAGE',
        mediaUrl,
        referenceId: null,
      };
    }

    case 4: {
      const mediaUrl = pickStringField(records, [
        'imgUrl',
        'img_url',
        'smallImgUrl',
        'small_img_url',
        'url',
      ]);
      const emojiText = pickStringField(records, ['txt', 'text', 'emoji', 'title']);
      return {
        text: emojiText ?? '[emoji]',
        messageType: 'EMOJI',
        mediaUrl,
        referenceId: null,
      };
    }

    case 6: {
      const referenceId = pickIdentifierField(records, ['video_id', 'videoId']);
      const mediaUrl = pickStringField(records, [
        'videoUrl',
        'video_url',
        'coverUrl',
        'cover_url',
        'imgUrl',
        'img_url',
        'url',
      ]);
      const title = pickStringField(records, ['txt', 'text', 'title']);
      return {
        text: title ?? (referenceId ? `[Video #${referenceId}]` : '[Video]'),
        messageType: 'VIDEO',
        mediaUrl,
        referenceId,
      };
    }

    case 10006: {
      const referenceId = pickIdentifierField(records, [
        'itemId',
        'item_id',
        'productId',
        'product_id',
      ]);
      const title = pickStringField(records, [
        'txt',
        'text',
        'title',
        'itemTitle',
        'item_title',
        'itemName',
        'item_name',
        'name',
      ]);
      return {
        text: title ?? (referenceId ? `[Item #${referenceId}]` : '[Item]'),
        messageType: 'ITEM',
        mediaUrl: null,
        referenceId,
      };
    }

    case 10007: {
      const referenceId = pickIdentifierField(records, [
        'orderId',
        'order_id',
        'orderNumber',
        'order_number',
      ]);
      const title = pickStringField(records, [
        'txt',
        'text',
        'title',
        'orderStatus',
        'order_status',
      ]);
      return {
        text: title ?? (referenceId ? `[Order #${referenceId}]` : '[Order]'),
        messageType: 'ORDER',
        mediaUrl: null,
        referenceId,
      };
    }

    case 10008: {
      const referenceId = pickIdentifierField(records, [
        'promotionId',
        'promotion_id',
        'voucherId',
        'voucher_id',
      ]);
      const title = pickStringField(records, [
        'txt',
        'text',
        'title',
        'promotionName',
        'promotion_name',
        'voucherName',
        'voucher_name',
        'name',
      ]);
      return {
        text: title ?? (referenceId ? `[Voucher #${referenceId}]` : '[Voucher]'),
        messageType: 'VOUCHER',
        mediaUrl: null,
        referenceId,
      };
    }

    case 10010: {
      const inviteText = pickStringField(records, [
        'txt',
        'text',
        'title',
        'content',
        'action',
        'msg',
        'message',
      ]);
      return {
        text: inviteText ?? plainTextFallback(trimmedContent, parsedRoot, '[Store follow invitation]'),
        messageType: 'SYSTEM',
        mediaUrl: null,
        referenceId: null,
      };
    }

    case 10011: {
      const referenceId = pickIdentifierField(records, [
        'orderId',
        'order_id',
        'refundId',
        'refund_id',
      ]);
      const claimText = pickStringField(records, [
        'txt',
        'text',
        'title',
        'content',
        'action',
        'status',
        'msg',
        'message',
      ]);
      const defaultLabel = referenceId
        ? `[Return / Refund #${referenceId}]`
        : '[Return / Refund card]';
      return {
        text: claimText ?? plainTextFallback(trimmedContent, parsedRoot, defaultLabel),
        messageType: 'SYSTEM',
        mediaUrl: null,
        referenceId,
      };
    }

    case 10015: {
      const autoReplyText = pickStringField(records, [
        'txt',
        'text',
        'content',
        'title',
        'action',
        'msg',
        'message',
      ]);
      return {
        text: autoReplyText ?? plainTextFallback(trimmedContent, parsedRoot, '[Auto-reply]'),
        messageType: 'TEXT',
        mediaUrl: null,
        referenceId: null,
      };
    }

    case 1:
    default: {
      const txt = pickStringField(records, [
        'txt',
        'text',
        'content',
        'title',
        'msg',
        'message',
      ]);
      const translateTxt = pickStringField(records, ['translateTxt', 'translate_txt']);

      let resolvedText: string;
      if (txt && translateTxt && translateTxt !== txt) {
        resolvedText = `${txt}\n(${translateTxt})`;
      } else if (txt) {
        resolvedText = txt;
      } else if (translateTxt) {
        resolvedText = translateTxt;
      } else {
        resolvedText =
          trimmedContent.length === 0
            ? ''
            : plainTextFallback(trimmedContent, parsedRoot, '[Message]');
      }

      return {
        text: resolvedText,
        messageType: 'TEXT',
        mediaUrl: null,
        referenceId: null,
      };
    }
  }
}

export async function resolveActiveConnectionOrg(
  connectionId: number,
): Promise<ActiveConnectionOrgResult> {
  if (typeof prisma.platformConnection?.findUnique !== 'function') {
    return { active: false };
  }
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
    select: { organizationId: true, isActive: true },
  });
  if (!connection || !connection.isActive) {
    return { active: false };
  }
  return {
    active: true,
    organizationId: connection.organizationId,
  };
}

export async function resolveStandardVipTierId(): Promise<number> {
  const standardTier = await prisma.vipTierCatalog.findFirst({
    where: { code: 'standard', isActive: true },
    select: { id: true },
  });
  if (!standardTier?.id) {
    throw new Error("Missing required active VipTierCatalog seed row with code 'standard'");
  }
  return standardTier.id;
}

export async function resolveConversationStatusId(code: string): Promise<number> {
  const statusRow = await prisma.conversationStatus.findFirst({
    where: { code, isActive: true },
    select: { id: true },
  });
  if (!statusRow?.id) {
    throw new Error(`Missing required active ConversationStatus seed row with code '${code}'`);
  }
  return statusRow.id;
}

export async function resolveSenderTypeId(senderCode: string): Promise<number> {
  const senderType = await prisma.senderType.findFirst({
    where: { code: senderCode, isActive: true },
    select: { id: true },
  });
  if (!senderType?.id) {
    throw new Error(`Missing required active SenderType seed row with code '${senderCode}'`);
  }
  return senderType.id;
}

export async function hydrateCustomerFromLazadaSession(
  connectionId: number,
  sessionId: string,
  customer: CustomerHydrationTarget,
  prefetchedSessionDetail?: LazadaImSessionDetailDTO,
): Promise<void> {
  try {
    let resolvedDisplayName = prefetchedSessionDetail
      ? pickNonEmptyStringValue([
          prefetchedSessionDetail.title,
          prefetchedSessionDetail.buyer_name,
          prefetchedSessionDetail.buyerName,
        ])
      : null;
    let resolvedAvatarUrl = prefetchedSessionDetail
      ? pickNonEmptyStringValue([
          prefetchedSessionDetail.head_url,
          prefetchedSessionDetail.headUrl,
          prefetchedSessionDetail.avatar,
          prefetchedSessionDetail.avatarUrl,
        ])
      : null;

    if (
      prefetchedSessionDetail === undefined &&
      !resolvedDisplayName &&
      typeof getLazadaImSession === 'function'
    ) {
      const sessionResult = await getLazadaImSession(connectionId, sessionId);
      if (!sessionResult || !sessionResult.success) {
        if (sessionResult && !sessionResult.success) {
          appLogger.warn('Failed to hydrate Lazada session metadata for customer', {
            connectionId,
            sessionId,
            customerId: customer.id,
            error: sessionResult.error,
          });
        }
      } else {
        const detail = sessionResult.data;
        resolvedDisplayName = pickNonEmptyStringValue([
          detail.title,
          detail.buyer_name,
          detail.buyerName,
        ]);
        resolvedAvatarUrl =
          resolvedAvatarUrl ??
          pickNonEmptyStringValue([
            detail.head_url,
            detail.headUrl,
            detail.avatar,
            detail.avatarUrl,
          ]);
      }
    }

    const updateData: { displayName?: string; avatarUrl?: string } = {};
    if (resolvedDisplayName && resolvedDisplayName !== customer.displayName) {
      updateData.displayName = resolvedDisplayName;
    }
    if (resolvedAvatarUrl && resolvedAvatarUrl !== customer.avatarUrl) {
      updateData.avatarUrl = resolvedAvatarUrl;
    }

    if (Object.keys(updateData).length > 0 && typeof prisma.customer?.update === 'function') {
      await prisma.customer.update({
        where: { id: customer.id },
        data: updateData,
      });
    }
  } catch (error) {
    appLogger.warn('Non-fatal error hydrating Lazada session metadata', {
      connectionId,
      sessionId,
      customerId: customer.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function findRecentActiveOrderIdForCustomer(
  connectionId: number,
  customerId: number,
  referencedOrderId: string | null,
): Promise<number | null> {
  if (typeof prisma.order?.findFirst !== 'function') {
    return null;
  }

  if (referencedOrderId) {
    const exactOrder = await prisma.order.findFirst({
      where: {
        connectionId,
        customerId,
        platformOrderId: referencedOrderId,
        isActive: true,
      },
      select: { id: true },
    });
    if (exactOrder?.id) {
      return exactOrder.id;
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - ORDER_LINK_LOOKBACK_MS);
  const recentOrder = await prisma.order.findFirst({
    where: {
      connectionId,
      customerId,
      isActive: true,
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return recentOrder?.id ?? null;
}

/**
 * Idempotently ingests a Lazada message into Customer, Conversation, and Message tables.
 * In 'historical_sync' mode, suppresses live SSE takeover/message spam, bot turns, and per-message unread accumulation.
 */
export async function ingestLazadaMessage(
  input: IngestLazadaMessageInput,
): Promise<IngestLazadaMessageResult> {
  const {
    connectionId,
    organizationId,
    payload,
    mode = 'live_webhook',
    sessionDetail,
    targetUnreadCount,
    skipHydration = false,
  } = input;

  const isHistoricalSync = mode === 'historical_sync';
  const messageId = payload.message_id;
  const sessionId = payload.session_id;

  const incomingTimestampMs =
    typeof payload.send_time === 'number' &&
    Number.isFinite(payload.send_time) &&
    payload.send_time > 0
      ? payload.send_time
      : Date.now();
  const incomingTime = new Date(incomingTimestampMs);

  const existingMessage = await prisma.message.findUnique({
    where: {
      connectionId_platformMessageId: {
        connectionId,
        platformMessageId: messageId,
      },
    },
    select: {
      id: true,
      status: true,
      conversationId: true,
      isActive: true,
    },
  });

  if (existingMessage) {
    if (!existingMessage.isActive) {
      appLogger.info('Skipping webhook for inactive existing message', {
        messageId,
        connectionId,
        existingMessageId: existingMessage.id,
      });
      return { outcome: 'skipped_inactive' };
    }

    if (payload.status === 1 && existingMessage.status !== 'RECALLED') {
      await prisma.message.update({
        where: { id: existingMessage.id },
        data: {
          status: 'RECALLED',
          text: RECALLED_MESSAGE_TEXT,
          mediaUrl: null,
          referenceId: null,
        },
      });

      let recalledConversationId: number | undefined =
        existingMessage.conversationId ?? undefined;
      if (!isHistoricalSync && recalledConversationId === undefined) {
        const recalledConversation = await prisma.conversation.findUnique({
          where: {
            connectionId_platformSessionId: {
              connectionId,
              platformSessionId: sessionId,
            },
          },
          select: { id: true, isActive: true },
        });
        if (recalledConversation && recalledConversation.isActive) {
          recalledConversationId = recalledConversation.id;
        }
      }

      if (!isHistoricalSync && recalledConversationId !== undefined) {
        const recalledEvent: ChatStreamEvent = {
          type: 'chat:message_updated',
          conversationId: recalledConversationId,
          messageId: existingMessage.id,
          platformMessageId: messageId,
          status: 'RECALLED',
          text: RECALLED_MESSAGE_TEXT,
          timestamp: incomingTime,
        };
        await chatBroadcaster.publishChatEvent(recalledEvent, organizationId);
      }

      appLogger.info('Updated recalled status for message', {
        messageId,
        connectionId,
      });

      return {
        outcome: 'updated_recalled',
        conversationId: recalledConversationId,
        messageId: existingMessage.id,
      };
    }

    return {
      outcome: 'skipped_duplicate',
      conversationId: existingMessage.conversationId ?? undefined,
      messageId: existingMessage.id,
    };
  }

  const parsedContent = parseLazadaMessageContent(
    payload.content,
    payload.template_id,
    payload.type,
  );

  let conversation = await prisma.conversation.findUnique({
    where: {
      connectionId_platformSessionId: {
        connectionId,
        platformSessionId: sessionId,
      },
    },
    select: CONVERSATION_INGESTION_SELECT,
  });

  if (conversation && !conversation.isActive) {
    appLogger.warn('Skipping webhook message for inactive conversation', {
      conversationId: conversation.id,
      connectionId,
      sessionId,
      messageId,
    });
    return { outcome: 'skipped_inactive' };
  }

  const shouldIncrementUnread =
    !isHistoricalSync && isRealLazadaBuyerMessage(payload);

  let createdNewConversation = false;

  if (!conversation) {
    const buyerIdentifier = resolveBuyerIdentifier(payload, sessionDetail);
    const standardTierId = await resolveStandardVipTierId();
    const openStatusId = await resolveConversationStatusId('open');

    const customer = await prisma.customer.upsert({
      where: {
        connectionId_platformBuyerId: {
          connectionId,
          platformBuyerId: buyerIdentifier,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        connectionId,
        platformBuyerId: buyerIdentifier,
        vipTierId: standardTierId,
        vipScore: 0,
        totalSpend: 0,
        orderCount: 0,
        avgOrderValue: 0,
        isActive: true,
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!skipHydration && (!isHistoricalSync || !customer.displayName)) {
      await hydrateCustomerFromLazadaSession(
        connectionId,
        sessionId,
        customer,
        isHistoricalSync ? sessionDetail : undefined,
      );
    }

    const referencedOrderId =
      parsedContent.messageType === 'ORDER' || payload.template_id === 10011
        ? parsedContent.referenceId
        : null;

    const linkedOrderId = await findRecentActiveOrderIdForCustomer(
      connectionId,
      customer.id,
      referencedOrderId,
    );

    const initialUnreadCount = isHistoricalSync
      ? Math.max(0, Math.trunc(targetUnreadCount ?? 0))
      : shouldIncrementUnread
        ? 1
        : 0;

    conversation = await prisma.conversation.create({
      data: {
        connectionId,
        platformSessionId: sessionId,
        customerId: customer.id,
        ...(linkedOrderId !== null ? { orderId: linkedOrderId } : {}),
        statusId: openStatusId,
        unreadCount: initialUnreadCount,
        lastMessageTime: incomingTime,
      },
      select: CONVERSATION_INGESTION_SELECT,
    });
    createdNewConversation = true;

    appLogger.info('Cold session initialized for conversation', {
      conversationId: conversation.id,
      sessionId,
      connectionId,
      linkedOrderId,
    });
  } else {
    if (
      !skipHydration &&
      conversation.customer &&
      conversation.customer.isActive &&
      !conversation.customer.displayName
    ) {
      await hydrateCustomerFromLazadaSession(
        connectionId,
        sessionId,
        conversation.customer,
        isHistoricalSync ? sessionDetail : undefined,
      );
    }

    const nextLastMessageTime = computeMonotonicLastMessageTime(
      incomingTime,
      conversation.lastMessageTime,
    );

    const conversationUpdateData: {
      unreadCount?: number | { increment: number };
      lastMessageTime: Date;
    } = {
      lastMessageTime: nextLastMessageTime,
    };

    if (!isHistoricalSync) {
      if (shouldIncrementUnread) {
        conversationUpdateData.unreadCount = { increment: 1 };
      } else if (payload.from_account_type === 2) {
        conversationUpdateData.unreadCount = 0;
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: conversationUpdateData,
    });
  }

  const senderCode =
    payload.type === 2 || payload.template_id === 2
      ? 'system'
      : payload.from_account_type === 1
        ? 'buyer'
        : 'seller';

  const senderTypeId = await resolveSenderTypeId(senderCode);

  const trimmedProcessMsg = payload.process_msg?.trim() || null;
  let messageText = parsedContent.text;
  let messageMediaUrl = parsedContent.mediaUrl;
  let messageReferenceId = parsedContent.referenceId;
  let status: 'SENT' | 'RECALLED' | 'FILTERED' = 'SENT';

  if (payload.status === 1) {
    status = 'RECALLED';
    messageText = RECALLED_MESSAGE_TEXT;
    messageMediaUrl = null;
    messageReferenceId = null;
  } else if (payload.status === 2 || trimmedProcessMsg !== null) {
    status = 'FILTERED';
  }

  const createdMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      connectionId,
      platformMessageId: messageId,
      senderTypeId,
      messageType: parsedContent.messageType,
      text: messageText,
      mediaUrl: messageMediaUrl,
      referenceId: messageReferenceId,
      status,
      processMsg: trimmedProcessMsg,
      timestamp: incomingTime,
    },
  });

  if (!isHistoricalSync) {
    const isRealBuyerMessage = isRealLazadaBuyerMessage(payload);
    const isRealOperatorReply = isRealLazadaOperatorReply(payload);

    if (isRealBuyerMessage) {
      const statusCode = createdNewConversation
        ? 'open'
        : (conversation.status?.code ?? null);
      const humanApprovalRequired = createdNewConversation
        ? false
        : Boolean(conversation.humanApprovalRequired);
      const isEligibleForBot =
        !humanApprovalRequired &&
        (statusCode === 'open' || statusCode === 'awaiting_reply');

      if (isEligibleForBot) {
        try {
          await scheduleBotConversationTurn(
            connectionId,
            conversation.id,
            sessionId,
            messageId,
          );
        } catch (scheduleError) {
          appLogger.warn('Failed to schedule autonomous bot turn after buyer message', {
            conversationId: conversation.id,
            sessionId,
            messageId,
            error:
              scheduleError instanceof Error
                ? scheduleError.message
                : String(scheduleError),
          });
        }
      }
    } else if (isRealOperatorReply) {
      await cancelPendingBotTurn(sessionId);

      const inProgressStatusId = await resolveConversationStatusId('in_progress');
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          statusId: inProgressStatusId,
          humanApprovalRequired: false,
        },
      });

      const takeoverEvent: ChatStreamEvent = {
        type: 'chat:operator_takeover',
        sessionId,
        conversationId: conversation.id,
        sellerAccountId: payload.from_account_id,
      };
      await chatBroadcaster.publishChatEvent(takeoverEvent, organizationId);
    }

    const eventPayload: ChatStreamEvent = {
      type: 'chat:message_received',
      conversationId: conversation.id,
      messageId: createdMessage.id,
      platformMessageId: messageId,
      senderCode,
      messageType: parsedContent.messageType,
      text: messageText,
      mediaUrl: messageMediaUrl,
      referenceId: messageReferenceId,
      status,
      processMsg: trimmedProcessMsg,
      timestamp: createdMessage.timestamp,
    };

    await chatBroadcaster.publishChatEvent(eventPayload, organizationId);
  }

  return {
    outcome: 'created',
    conversationId: conversation.id,
    messageId: createdMessage.id,
    createdNewConversation,
    statusCode: createdNewConversation ? 'open' : (conversation.status?.code ?? null),
    lastMessageTime: incomingTime,
  };
}
