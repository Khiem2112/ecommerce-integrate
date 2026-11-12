import { Worker, type Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { withDistributedLock } from '@/lib/redlock';
import { appLogger } from '@/lib/logger';
import { computeMonotonicLastMessageTime } from '@/utils';
import { chatBroadcaster } from './chatBroadcaster';
import { processAgentConversationTurn } from './agentSessionManager';
import { getLazadaImSession } from './connectors/lazada/lazadaImService';
import {
  CHAT_QUEUE_PARTITION_COUNT,
  cancelPendingBotTurn,
  getBotDebounceKey,
  getChatQueuePartitionName,
  getQueueConnectionOptions,
  scheduleBotConversationTurn,
  type ChatWebhookJobData,
} from '@/lib/queue';
import type {
  Customer,
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
  ChatStreamEvent,
  MessageType,
} from '@/types';

const SESSION_LOCK_TTL_MS = 25_000;
const CLAIM_DEBOUNCE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;
const RECALLED_MESSAGE_TEXT = '[Tin nhắn đã được thu hồi]';
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

const CONVERSATION_WORKER_SELECT = {
  id: true,
  isActive: true,
  humanApprovalRequired: true,
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

type CustomerHydrationTarget = Readonly<
  Pick<Customer, 'id' | 'displayName' | 'avatarUrl'>
>;

type ActiveConnectionOrgResult = {
  readonly active: boolean;
  readonly organizationId?: number;
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

function pickNonEmptyStringValue(
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

export { computeMonotonicLastMessageTime };

async function resolveConnectionIdAsync(
  connectionId?: number,
  externalShopId?: string,
): Promise<number | undefined> {
  if (connectionId) {
    return connectionId;
  }
  if (!externalShopId) {
    return undefined;
  }

  const connection = await prisma.platformConnection.findFirst({
    where: {
      externalShopId,
      isActive: true,
      platform: {
        code: 'lazada',
        isActive: true,
      },
    },
    select: { id: true },
  });

  if (connection?.id) {
    return connection.id;
  }

  // Fallback only when webhook signature verification skip is explicitly enabled for local sandbox testing
  if (process.env.LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY === 'true') {
    const fallback = await prisma.platformConnection.findFirst({
      where: {
        isActive: true,
        platform: {
          code: 'lazada',
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (fallback?.id) {
      appLogger.warn(
        'Resolved fallback active Lazada connection via LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY',
        {
          fallbackConnectionId: fallback.id,
          externalShopId,
        },
      );
      return fallback.id;
    }
  }

  return undefined;
}

async function resolveActiveConnectionOrg(
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

async function hydrateCustomerFromLazadaSession(
  connectionId: number,
  sessionId: string,
  customer: CustomerHydrationTarget,
): Promise<void> {
  try {
    if (typeof getLazadaImSession !== 'function') {
      return;
    }
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
      return;
    }

    const detail = sessionResult.data;
    const resolvedDisplayName = pickNonEmptyStringValue([
      detail.title,
      detail.buyer_name,
      detail.buyerName,
    ]);
    const resolvedAvatarUrl = pickNonEmptyStringValue([
      detail.head_url,
      detail.headUrl,
      detail.avatar,
      detail.avatarUrl,
    ]);

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

async function findRecentActiveOrderIdForCustomer(
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

async function handlePushMessage(
  connectionId: number,
  payload: LazadaPushMessagePayload,
): Promise<void> {
  const messageId = payload.message_id;
  const sessionId = payload.session_id;
  const connectionOrg = await resolveActiveConnectionOrg(connectionId);
  if (!connectionOrg.active) {
    appLogger.warn('Skipping webhook message for missing or inactive connection', {
      connectionId,
      sessionId,
      messageId,
    });
    return;
  }
  const orgId = connectionOrg.organizationId;

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
      return;
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
      if (recalledConversationId === undefined) {
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

      if (recalledConversationId !== undefined) {
        const recalledEvent: ChatStreamEvent = {
          type: 'chat:message_updated',
          conversationId: recalledConversationId,
          messageId: existingMessage.id,
          platformMessageId: messageId,
          status: 'RECALLED',
          text: RECALLED_MESSAGE_TEXT,
          timestamp: incomingTime,
        };
        await chatBroadcaster.publishChatEvent(recalledEvent, orgId);
      }

      appLogger.info('Updated recalled status for message', {
        messageId,
        connectionId,
      });
    }
    return;
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
    select: CONVERSATION_WORKER_SELECT,
  });

  if (conversation && !conversation.isActive) {
    appLogger.warn('Skipping webhook message for inactive conversation', {
      conversationId: conversation.id,
      connectionId,
      sessionId,
      messageId,
    });
    return;
  }

  const shouldIncrementUnread =
    payload.from_account_type === 1 &&
    payload.status !== 1 &&
    payload.type !== 2 &&
    payload.template_id !== 2;

  let createdNewConversation = false;

  if (!conversation) {
    const buyerIdentifier = String(
      payload.from_account_type === 1
        ? payload.from_account_id
        : payload.to_account_id,
    );

    const standardTier = await prisma.vipTierCatalog.findFirst({
      where: { code: 'standard', isActive: true },
      select: { id: true },
    });
    if (!standardTier?.id) {
      throw new Error("Missing required active VipTierCatalog seed row with code 'standard'");
    }

    const openStatus = await prisma.conversationStatus.findFirst({
      where: { code: 'open', isActive: true },
      select: { id: true },
    });
    if (!openStatus?.id) {
      throw new Error("Missing required active ConversationStatus seed row with code 'open'");
    }

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
        vipTierId: standardTier.id,
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

    await hydrateCustomerFromLazadaSession(connectionId, sessionId, customer);

    const referencedOrderId =
      parsedContent.messageType === 'ORDER' || payload.template_id === 10011
        ? parsedContent.referenceId
        : null;

    const linkedOrderId = await findRecentActiveOrderIdForCustomer(
      connectionId,
      customer.id,
      referencedOrderId,
    );

    conversation = await prisma.conversation.create({
      data: {
        connectionId,
        platformSessionId: sessionId,
        customerId: customer.id,
        ...(linkedOrderId !== null ? { orderId: linkedOrderId } : {}),
        statusId: openStatus.id,
        unreadCount: shouldIncrementUnread ? 1 : 0,
        lastMessageTime: incomingTime,
      },
      select: CONVERSATION_WORKER_SELECT,
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
      conversation.customer &&
      conversation.customer.isActive &&
      !conversation.customer.displayName
    ) {
      await hydrateCustomerFromLazadaSession(
        connectionId,
        sessionId,
        conversation.customer,
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

    if (shouldIncrementUnread) {
      conversationUpdateData.unreadCount = { increment: 1 };
    } else if (payload.from_account_type === 2) {
      conversationUpdateData.unreadCount = 0;
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

  const senderType = await prisma.senderType.findFirst({
    where: { code: senderCode, isActive: true },
    select: { id: true },
  });
  if (!senderType?.id) {
    throw new Error(`Missing required active SenderType seed row with code '${senderCode}'`);
  }

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
      senderTypeId: senderType.id,
      messageType: parsedContent.messageType,
      text: messageText,
      mediaUrl: messageMediaUrl,
      referenceId: messageReferenceId,
      status,
      processMsg: trimmedProcessMsg,
      timestamp: incomingTime,
    },
  });

  const isRealBuyerMessage =
    payload.from_account_type === 1 &&
    payload.status !== 1 &&
    payload.type !== 2 &&
    payload.template_id !== 2;

  const isRealOperatorReply =
    payload.from_account_type === 2 &&
    payload.status !== 1 &&
    payload.auto_reply !== true &&
    payload.type !== 2 &&
    payload.template_id !== 10015 &&
    payload.template_id !== 2;

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

    const inProgressStatus = await prisma.conversationStatus.findFirst({
      where: { code: 'in_progress', isActive: true },
      select: { id: true },
    });
    if (!inProgressStatus?.id) {
      throw new Error("Missing required active ConversationStatus seed row with code 'in_progress'");
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        statusId: inProgressStatus.id,
      },
    });

    const takeoverEvent: ChatStreamEvent = {
      type: 'chat:operator_takeover',
      sessionId,
      conversationId: conversation.id,
      sellerAccountId: payload.from_account_id,
    };
    await chatBroadcaster.publishChatEvent(takeoverEvent, orgId);
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

  await chatBroadcaster.publishChatEvent(eventPayload, orgId);
}

async function handlePushSessionUpdate(
  connectionId: number,
  payload: LazadaPushSessionUpdatePayload,
): Promise<void> {
  const sessionId = payload.session_id;
  if (!sessionId) {
    return;
  }

  const connectionOrg = await resolveActiveConnectionOrg(connectionId);
  if (!connectionOrg.active) {
    appLogger.warn('Skipping session update for missing or inactive connection', {
      connectionId,
      sessionId,
    });
    return;
  }
  const orgId = connectionOrg.organizationId;

  const matchedConversation = await prisma.conversation.findFirst({
    where: {
      connectionId,
      platformSessionId: sessionId,
      isActive: true,
    },
    select: {
      id: true,
      unreadCount: true,
      lastMessageTime: true,
    },
  });

  const updateFields: { unreadCount?: number; lastMessageTime?: Date } = {};
  if (typeof payload.unread_count === 'number' && Number.isFinite(payload.unread_count)) {
    updateFields.unreadCount = Math.max(0, Math.trunc(payload.unread_count));
  }
  if (typeof payload.last_message_time === 'number' && Number.isFinite(payload.last_message_time)) {
    const incomingTime = new Date(payload.last_message_time);
    updateFields.lastMessageTime = computeMonotonicLastMessageTime(
      incomingTime,
      matchedConversation?.lastMessageTime,
    );
  }

  if (Object.keys(updateFields).length > 0) {
    await prisma.conversation.updateMany({
      where: {
        connectionId,
        platformSessionId: sessionId,
        isActive: true,
      },
      data: updateFields,
    });
  }

  const resolvedUnreadCount =
    updateFields.unreadCount !== undefined
      ? updateFields.unreadCount
      : matchedConversation?.unreadCount;

  const resolvedLastMessageTime =
    updateFields.lastMessageTime !== undefined
      ? updateFields.lastMessageTime
      : (matchedConversation?.lastMessageTime ?? undefined);

  const updateEvent: ChatStreamEvent = {
    type: 'chat:session_updated',
    sessionId,
    connectionId,
    conversationId: matchedConversation?.id,
    unreadCount: resolvedUnreadCount,
    lastMessageTime: resolvedLastMessageTime,
  };
  await chatBroadcaster.publishChatEvent(updateEvent, orgId);
}

async function verifyBotDebounceToken(
  sessionId: string,
  triggerMessageId: string,
): Promise<boolean> {
  const debounceKey = getBotDebounceKey(sessionId);
  const latestTriggerId = await redis.get(debounceKey);
  return Boolean(latestTriggerId) && latestTriggerId === triggerMessageId;
}

async function releaseBotDebounceToken(
  sessionId: string,
  triggerMessageId: string,
): Promise<void> {
  const debounceKey = getBotDebounceKey(sessionId);
  if (typeof redis.eval === 'function') {
    await redis.eval(
      CLAIM_DEBOUNCE_SCRIPT,
      1,
      debounceKey,
      triggerMessageId,
    );
    return;
  }

  const latestTriggerId = await redis.get(debounceKey);
  if (latestTriggerId === triggerMessageId) {
    await redis.del(debounceKey);
  }
}

export async function processChatWebhookJob(jobData: ChatWebhookJobData): Promise<void> {
  const sessionId =
    jobData.eventType === 'bot_turn'
      ? String(jobData.sessionId ?? '')
      : String('session_id' in jobData.payload ? jobData.payload.session_id : '');

  if (!sessionId) {
    throw new Error('Cannot process chat job without session_id');
  }

  if (jobData.eventType === 'bot_turn') {
    const lockAcquired = await withDistributedLock(
      `session:${sessionId}`,
      SESSION_LOCK_TTL_MS,
      async () => {
        const isCurrentTrigger = await verifyBotDebounceToken(
          sessionId,
          jobData.triggerMessageId,
        );
        if (!isCurrentTrigger) {
          return true;
        }

        await processAgentConversationTurn(jobData.conversationId);
        await releaseBotDebounceToken(sessionId, jobData.triggerMessageId);
        return true;
      },
    );

    if (!lockAcquired) {
      throw new Error(`Lock contention for session:${sessionId}, retrying via queue`);
    }
    return;
  }

  const connectionId = await resolveConnectionIdAsync(
    jobData.connectionId,
    jobData.externalShopId,
  );

  if (!connectionId) {
    appLogger.warn('Skipping webhook processing due to unmapped connectionId', {
      sessionId,
      externalShopId: jobData.externalShopId,
    });
    return;
  }

  const lockAcquired = await withDistributedLock(
    `session:${sessionId}`,
    SESSION_LOCK_TTL_MS,
    async () => {
    if (jobData.eventType === 'push_message') {
      await handlePushMessage(
        connectionId,
        jobData.payload as LazadaPushMessagePayload,
      );
    } else if (jobData.eventType === 'push_session_update') {
      await handlePushSessionUpdate(
        connectionId,
        jobData.payload as LazadaPushSessionUpdatePayload,
      );
    }
    return true;
  });

  if (!lockAcquired) {
    throw new Error(`Lock contention for session:${sessionId}, retrying via queue`);
  }
}

const globalForWorker = globalThis as unknown as {
  chatWorkers?: Worker<ChatWebhookJobData>[];
};

export function startChatQueueWorker(): Worker<ChatWebhookJobData>[] {
  if (globalForWorker.chatWorkers && globalForWorker.chatWorkers.length > 0) {
    return globalForWorker.chatWorkers;
  }

  const workers: Worker<ChatWebhookJobData>[] = Array.from(
    { length: CHAT_QUEUE_PARTITION_COUNT },
    (_, partition) => {
      const queueName = getChatQueuePartitionName(partition);
      const worker = new Worker<ChatWebhookJobData>(
        queueName,
        async (job: Job<ChatWebhookJobData>) => {
          await processChatWebhookJob(job.data);
        },
        {
          connection: getQueueConnectionOptions(),
          concurrency: 1,
        },
      );

      worker.on('completed', (job: Job<ChatWebhookJobData>) => {
        appLogger.info(`Chat queue job completed [${queueName}]: ${job.id}`);
      });

      worker.on('failed', (job: Job<ChatWebhookJobData> | undefined, error: Error) => {
        appLogger.error(`Chat queue job failed [${queueName}]: ${job?.id}`, error);
      });

      return worker;
    },
  );

  globalForWorker.chatWorkers = workers;
  return workers;
}

export async function stopChatQueueWorker(): Promise<void> {
  if (globalForWorker.chatWorkers && globalForWorker.chatWorkers.length > 0) {
    const workersToClose = globalForWorker.chatWorkers;
    try {
      await Promise.all(workersToClose.map((worker) => worker.close()));
    } finally {
      globalForWorker.chatWorkers = undefined;
    }
  }
}
