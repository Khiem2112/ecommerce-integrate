import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { withDistributedLock } from '@/lib/redlock';
import { appLogger } from '@/lib/logger';
import { chatBroadcaster } from './chatBroadcaster';
import {
  CHAT_MESSAGE_QUEUE_NAME,
  type ChatWebhookJobData,
} from '@/lib/queue';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
  ChatStreamEvent,
} from '@/types';

const DEBOUNCE_WINDOW_SECONDS = 3;

function getQueueConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: Number(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || undefined,
        maxRetriesPerRequest: null,
      };
    } catch {
      // Fallback if URL parsing is non-standard
    }
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

function parseMessageText(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.txt === 'string') {
      return parsed.txt;
    }
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
    return content;
  } catch {
    return content;
  }
}

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
    },
    select: { id: true },
  });
  return connection?.id;
}

async function handlePushMessage(
  connectionId: number,
  payload: LazadaPushMessagePayload,
): Promise<void> {
  const messageId = payload.message_id;
  const sessionId = payload.session_id;

  let orgId: number | undefined;
  try {
    const connection = await prisma.platformConnection?.findUnique?.({
      where: { id: connectionId },
      select: { organizationId: true },
    });
    orgId = connection?.organizationId;
  } catch {
    // Graceful fallback when platformConnection lookup is mocked or unavailable
  }

  const existingMessage = await prisma.message.findUnique({
    where: {
      connectionId_platformMessageId: {
        connectionId,
        platformMessageId: messageId,
      },
    },
    select: { id: true, status: true },
  });

  if (existingMessage) {
    if (payload.status === 1 && existingMessage.status !== 'RECALLED') {
      await prisma.message.update({
        where: { id: existingMessage.id },
        data: {
          status: 'RECALLED',
          text: '[Tin nhắn đã được thu hồi]',
        },
      });
      appLogger.info('Updated recalled status for message', {
        messageId,
        connectionId,
      });
    }
    return;
  }

  let conversation = await prisma.conversation.findUnique({
    where: {
      connectionId_platformSessionId: {
        connectionId,
        platformSessionId: sessionId,
      },
    },
  });

  if (!conversation) {
    const buyerIdentifier = String(
      payload.from_account_type === 1
        ? payload.from_account_id
        : payload.to_account_id,
    );

    let customer = await prisma.customer.findFirst({
      where: {
        connectionId,
        platformBuyerId: buyerIdentifier,
      },
    });

    if (!customer) {
      const standardTier = await prisma.vipTierCatalog.findFirst({
        where: { code: 'standard' },
        select: { id: true },
      });

      customer = await prisma.customer.create({
        data: {
          connectionId,
          platformBuyerId: buyerIdentifier,
          vipTierId: standardTier?.id ?? 1,
          vipScore: 0,
          totalSpend: 0,
          orderCount: 0,
          avgOrderValue: 0,
        },
      });
    }

    const openStatus = await prisma.conversationStatus.findFirst({
      where: { code: 'open' },
      select: { id: true },
    });

    conversation = await prisma.conversation.create({
      data: {
        connectionId,
        platformSessionId: sessionId,
        customerId: customer.id,
        statusId: openStatus?.id ?? 1,
        unreadCount: 1,
        lastMessageTime: new Date(payload.send_time || Date.now()),
      },
    });

    appLogger.info('Cold session initialized for conversation', {
      conversationId: conversation.id,
      sessionId,
      connectionId,
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        unreadCount: { increment: 1 },
        lastMessageTime: new Date(payload.send_time || Date.now()),
      },
    });
  }

  const senderCode = payload.from_account_type === 1 ? 'buyer' : 'seller';
  const senderType = await prisma.senderType.findFirst({
    where: { code: senderCode },
    select: { id: true },
  });

  let messageText = parseMessageText(payload.content);
  let status = 'RECEIVED';

  if (payload.status === 1) {
    status = 'RECALLED';
    messageText = '[Tin nhắn đã được thu hồi]';
  } else if (payload.process_msg && payload.process_msg.trim() !== '') {
    status = 'FILTERED';
  }

  const createdMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      connectionId,
      platformMessageId: messageId,
      senderTypeId: senderType?.id ?? 1,
      text: messageText,
      status,
      processMsg: payload.process_msg || null,
      timestamp: new Date(payload.send_time || Date.now()),
    },
  });

  const debounceKey = `session:${sessionId}:debounce`;
  if (payload.from_account_type === 1) {
    await redis.set(debounceKey, String(Date.now()), 'EX', DEBOUNCE_WINDOW_SECONDS);
  } else if (payload.from_account_type === 2) {
    await redis.del(debounceKey);

    const inProgressStatus = await prisma.conversationStatus.findFirst({
      where: { code: 'in_progress' },
      select: { id: true },
    });

    if (inProgressStatus) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          statusId: inProgressStatus.id,
        },
      });
    }

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
    text: messageText,
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

  let orgId: number | undefined;
  try {
    const connection = await prisma.platformConnection?.findUnique?.({
      where: { id: connectionId },
      select: { organizationId: true },
    });
    orgId = connection?.organizationId;
  } catch {
    // Graceful fallback when platformConnection lookup is mocked or unavailable
  }

  const updateFields: { unreadCount?: number; lastMessageTime?: Date } = {};
  if (payload.unread_count !== undefined) {
    updateFields.unreadCount = payload.unread_count;
  }
  if (payload.last_message_time !== undefined) {
    updateFields.lastMessageTime = new Date(payload.last_message_time);
  }

  if (Object.keys(updateFields).length > 0) {
    await prisma.conversation.updateMany({
      where: {
        connectionId,
        platformSessionId: sessionId,
      },
      data: updateFields,
    });
  }

  const updateEvent: ChatStreamEvent = {
    type: 'chat:session_updated',
    sessionId,
    connectionId,
    unreadCount: payload.unread_count,
  };
  await chatBroadcaster.publishChatEvent(updateEvent, orgId);
}

export async function processChatWebhookJob(jobData: ChatWebhookJobData): Promise<void> {
  const sessionId = String(
    'session_id' in jobData.payload ? jobData.payload.session_id : '',
  );

  if (!sessionId) {
    throw new Error('Cannot process chat job without session_id');
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

  const lockAcquired = await withDistributedLock(`session:${sessionId}`, 10000, async () => {
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

let activeWorker: Worker<ChatWebhookJobData> | null = null;

export function startChatQueueWorker(): Worker<ChatWebhookJobData> {
  if (activeWorker) {
    return activeWorker;
  }

  activeWorker = new Worker<ChatWebhookJobData>(
    CHAT_MESSAGE_QUEUE_NAME,
    async (job: Job<ChatWebhookJobData>) => {
      await processChatWebhookJob(job.data);
    },
    {
      connection: getQueueConnectionOptions(),
      concurrency: 5,
    },
  );

  activeWorker.on('completed', (job: Job<ChatWebhookJobData>) => {
    appLogger.info(`Chat queue job completed: ${job.id}`);
  });

  activeWorker.on('failed', (job: Job<ChatWebhookJobData> | undefined, error: Error) => {
    appLogger.error(`Chat queue job failed: ${job?.id}`, error);
  });

  return activeWorker;
}

export async function stopChatQueueWorker(): Promise<void> {
  if (activeWorker) {
    await activeWorker.close();
    activeWorker = null;
  }
}
