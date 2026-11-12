import { Worker, type Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { withDistributedLock } from '@/lib/redlock';
import { appLogger } from '@/lib/logger';
import { computeMonotonicLastMessageTime } from '@/utils';
import { chatBroadcaster } from './chatBroadcaster';
import { processAgentConversationTurn } from './agentSessionManager';
import { syncLazadaChatHistoryForConnection } from './connectors';
import {
  ingestLazadaMessage,
  parseLazadaMessageContent,
  resolveActiveConnectionOrg,
  type ParsedLazadaMessageContent,
} from './chatIngestionService';
import {
  CHAT_QUEUE_PARTITION_COUNT,
  getBotDebounceKey,
  getChatQueuePartitionName,
  getQueueConnectionOptions,
  type ChatWebhookJobData,
} from '@/lib/queue';
import type {
  ChatStreamEvent,
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

const SESSION_LOCK_TTL_MS = 25_000;
const CLAIM_DEBOUNCE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

export {
  parseLazadaMessageContent,
  computeMonotonicLastMessageTime,
  type ParsedLazadaMessageContent,
};

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

async function handlePushMessage(
  connectionId: number,
  payload: LazadaPushMessagePayload,
): Promise<void> {
  const connectionOrg = await resolveActiveConnectionOrg(connectionId);
  if (!connectionOrg.active) {
    appLogger.warn('Skipping webhook message for missing or inactive connection', {
      connectionId,
      sessionId: payload.session_id,
      messageId: payload.message_id,
    });
    return;
  }

  await ingestLazadaMessage({
    connectionId,
    organizationId: connectionOrg.organizationId,
    payload,
    mode: 'live_webhook',
  });
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
  if (jobData.eventType === 'initial_chat_sync') {
    if (!Number.isInteger(jobData.connectionId) || jobData.connectionId <= 0) {
      throw new Error('Cannot process initial_chat_sync job without valid connectionId');
    }
    await syncLazadaChatHistoryForConnection(jobData.connectionId);
    return;
  }

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
    },
  );

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
