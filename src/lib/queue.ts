import crypto from 'node:crypto';
import { Queue, type ConnectionOptions } from 'bullmq';
import { appLogger } from './logger';
import { redis } from './redis';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

export const CHAT_MESSAGE_QUEUE_NAME = 'chat-message-queue';
export const CHAT_QUEUE_PARTITION_COUNT = 8;
export const MIN_CHAT_QUEUE_PARTITION_COUNT = 1;
export const MAX_CHAT_QUEUE_PARTITION_COUNT = CHAT_QUEUE_PARTITION_COUNT;
export const DEFAULT_SQS_CHAT_QUEUE_PARTITION_COUNT = 2;
export const DEFAULT_BOT_DEBOUNCE_MS = 3000;
export const DEFAULT_LAZADA_INITIAL_CHAT_SYNC_DELAY_MS = 900_000;
export const LAZADA_RECONCILE_DEDUP_WINDOW_MS = 300_000;

function isDirectLazadaSqsIngestionActive(): boolean {
  const queueUrl = process.env.LAZADA_SQS_QUEUE_URL?.trim();
  if (!queueUrl) {
    return false;
  }
  return process.env.ENABLE_LAZADA_SQS_CONSUMER?.trim().toLowerCase() !== 'false';
}

/**
 * Resolves the active BullMQ partition count bounded to [1, 8].
 * Uses a lean default of 2 when AWS SQS FIFO direct ingestion is enabled so Redis
 * only maintains workers for delayed bot/sync jobs, and 8 in direct HTTP webhook mode.
 */
export function resolveChatQueuePartitionCount(): number {
  const defaultPartitionCount = isDirectLazadaSqsIngestionActive()
    ? DEFAULT_SQS_CHAT_QUEUE_PARTITION_COUNT
    : CHAT_QUEUE_PARTITION_COUNT;

  const raw = process.env.CHAT_QUEUE_PARTITION_COUNT?.trim();
  if (!raw) {
    return defaultPartitionCount;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_CHAT_QUEUE_PARTITION_COUNT) {
    return defaultPartitionCount;
  }

  return Math.min(MAX_CHAT_QUEUE_PARTITION_COUNT, parsed);
}

export type ChatReconcileSyncMode = 'incremental' | 'full';

export type ChatReconcileSyncReason =
  | 'startup_downtime'
  | 'sqs_retention_exceeded'
  | 'periodic';

export type ScheduleLazadaChatReconciliationOptions = {
  syncMode: ChatReconcileSyncMode;
  reason: ChatReconcileSyncReason;
  sinceTimestampMs?: number;
  delayMs?: number;
};

export type ChatWebhookEventJobData = {
  eventType: 'push_message' | 'push_session_update';
  connectionId?: number;
  externalShopId?: string;
  platform: string;
  payload: LazadaPushMessagePayload | LazadaPushSessionUpdatePayload;
  receivedAt: number;
};

export type ChatBotTurnJobData = {
  eventType: 'bot_turn';
  connectionId?: number;
  conversationId: number;
  sessionId: string;
  triggerMessageId: string;
  platform: string;
  receivedAt: number;
};

export type ChatInitialSyncJobData = {
  eventType: 'initial_chat_sync';
  connectionId: number;
  platform: 'lazada';
  requestedAt: number;
};

export type ChatReconcileSyncJobData = {
  eventType: 'reconcile_chat_sync';
  connectionId: number;
  platform: 'lazada';
  syncMode: ChatReconcileSyncMode;
  reason: ChatReconcileSyncReason;
  sinceTimestampMs?: number;
  requestedAt: number;
};

export type ChatWebhookJobData =
  | ChatWebhookEventJobData
  | ChatBotTurnJobData
  | ChatInitialSyncJobData
  | ChatReconcileSyncJobData;

export function getBotDebounceDelayMs(): number {
  const raw = process.env.BOT_DEBOUNCE_MS;
  if (!raw) {
    return DEFAULT_BOT_DEBOUNCE_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BOT_DEBOUNCE_MS;
  }

  return Math.floor(parsed);
}

export function getInitialChatSyncDelayMs(): number {
  const raw = process.env.LAZADA_INITIAL_CHAT_SYNC_DELAY_MS;
  if (!raw) {
    return DEFAULT_LAZADA_INITIAL_CHAT_SYNC_DELAY_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_LAZADA_INITIAL_CHAT_SYNC_DELAY_MS;
  }

  return Math.floor(parsed);
}

export function getBotDebounceKey(sessionId: string): string {
  return `session:${sessionId}:debounce`;
}

const globalForQueue = globalThis as unknown as {
  chatMessageQueues: Map<number, Queue<ChatWebhookJobData>> | undefined;
};

export function getQueueConnectionOptions(): ConnectionOptions {
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

export function getChatQueuePartitionName(partitionIndex: number): string {
  return `${CHAT_MESSAGE_QUEUE_NAME}-p${partitionIndex}`;
}

export function getSessionPartitionIndex(
  sessionId: string,
  partitionCount?: number,
): number {
  const activePartitionCount = resolveChatQueuePartitionCount();
  const safePartitionCount =
    typeof partitionCount === 'number' &&
    Number.isInteger(partitionCount) &&
    partitionCount > 0
      ? partitionCount
      : activePartitionCount;

  if (!sessionId) {
    return 0;
  }

  const digest = crypto.createHash('sha256').update(sessionId, 'utf8').digest();
  return digest.readUInt32BE(0) % safePartitionCount;
}

function getQueuePartitionMap(): Map<number, Queue<ChatWebhookJobData>> {
  if (!globalForQueue.chatMessageQueues) {
    globalForQueue.chatMessageQueues = new Map<number, Queue<ChatWebhookJobData>>();
  }
  return globalForQueue.chatMessageQueues;
}

export function getChatMessageQueueForPartition(
  partitionIndex: number,
  partitionCount?: number,
): Queue<ChatWebhookJobData> {
  const activePartitionCount =
    typeof partitionCount === 'number' &&
    Number.isInteger(partitionCount) &&
    partitionCount >= MIN_CHAT_QUEUE_PARTITION_COUNT &&
    partitionCount <= MAX_CHAT_QUEUE_PARTITION_COUNT
      ? partitionCount
      : resolveChatQueuePartitionCount();

  const normalizedPartition =
    Number.isInteger(partitionIndex) &&
    partitionIndex >= 0 &&
    partitionIndex < activePartitionCount
      ? partitionIndex
      : 0;

  const queueMap = getQueuePartitionMap();
  const existingQueue = queueMap.get(normalizedPartition);
  if (existingQueue) {
    return existingQueue;
  }

  const queueName = getChatQueuePartitionName(normalizedPartition);
  const queue = new Queue<ChatWebhookJobData>(queueName, {
    connection: getQueueConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });

  queue.on('error', (error: Error) => {
    appLogger.error(`Chat message queue (${queueName}) connection error:`, error);
  });

  queueMap.set(normalizedPartition, queue);
  return queue;
}

export function getChatMessageQueue(
  sessionId?: string,
): Queue<ChatWebhookJobData> {
  const partitionCount = resolveChatQueuePartitionCount();
  const partitionIndex = sessionId
    ? getSessionPartitionIndex(sessionId, partitionCount)
    : 0;
  return getChatMessageQueueForPartition(partitionIndex, partitionCount);
}

function sanitizeJobIdSegment(segment: string): string {
  const cleaned = segment.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'empty';
}

function hashJobIdParts(parts: readonly string[]): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(parts), 'utf8')
    .digest('hex')
    .slice(0, 16);
}

function buildSessionUpdateJobId(
  sessionId: string,
  payload: ChatWebhookEventJobData['payload'],
): string {
  const updatePayload = payload as Partial<LazadaPushSessionUpdatePayload>;
  const safeSession = sanitizeJobIdSegment(sessionId);

  const cursorParts = [
    typeof updatePayload.last_message_id === 'string' &&
    updatePayload.last_message_id.length > 0
      ? `lm=${updatePayload.last_message_id}`
      : null,
    updatePayload.to_position !== undefined && updatePayload.to_position !== null
      ? `tp=${updatePayload.to_position}`
      : null,
    updatePayload.self_position !== undefined && updatePayload.self_position !== null
      ? `sp=${updatePayload.self_position}`
      : null,
    updatePayload.last_message_time !== undefined &&
    updatePayload.last_message_time !== null
      ? `lt=${updatePayload.last_message_time}`
      : null,
  ].filter((part): part is string => part !== null);

  // Deduplicate only when a cursor or timestamp is present so standalone unread_count oscillations are preserved
  if (cursorParts.length > 0) {
    const fingerprintParts = [
      ...cursorParts,
      updatePayload.unread_count !== undefined && updatePayload.unread_count !== null
        ? `uc=${updatePayload.unread_count}`
        : null,
    ].filter((part): part is string => part !== null);

    const hash = hashJobIdParts([sessionId, ...fingerprintParts]);
    return `session_${safeSession}_${hash}`;
  }

  return `session_${safeSession}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function buildBotTurnJobId(
  sessionId: string,
  triggerMessageId: string,
): string {
  const safeSession = sanitizeJobIdSegment(sessionId);
  const safeMessage = sanitizeJobIdSegment(triggerMessageId);
  const hash = hashJobIdParts([sessionId, triggerMessageId]).slice(0, 12);
  return `bot-turn_${safeSession}_${safeMessage}_${hash}`;
}

export function buildInitialChatSyncJobId(connectionId: number): string {
  return `chat-initial-sync_${connectionId}`;
}

export function buildLazadaChatReconcileJobId(
  connectionId: number,
  syncMode: ChatReconcileSyncMode,
  reason: ChatReconcileSyncReason,
  bucketTimestampMs: number = Date.now(),
): string {
  const safeTimestamp =
    Number.isFinite(bucketTimestampMs) && bucketTimestampMs >= 0
      ? bucketTimestampMs
      : Date.now();
  const dedupBucket = Math.floor(safeTimestamp / LAZADA_RECONCILE_DEDUP_WINDOW_MS);
  const safeMode = sanitizeJobIdSegment(syncMode);
  const safeReason = sanitizeJobIdSegment(reason);
  return `chat-reconcile_${connectionId}_${safeMode}_${safeReason}_${dedupBucket}`;
}

export async function addChatMessageJob(
  jobData: ChatWebhookJobData,
  sessionId: string,
  messageId?: string,
): Promise<string> {
  if (jobData.eventType === 'initial_chat_sync') {
    return scheduleInitialChatHistorySync(jobData.connectionId);
  }

  if (jobData.eventType === 'reconcile_chat_sync') {
    return scheduleLazadaChatReconciliation(jobData.connectionId, {
      syncMode: jobData.syncMode,
      reason: jobData.reason,
      sinceTimestampMs: jobData.sinceTimestampMs,
    });
  }

  const queue = getChatMessageQueue(sessionId);

  if (jobData.eventType === 'bot_turn') {
    const jobId = buildBotTurnJobId(jobData.sessionId, jobData.triggerMessageId);
    const job = await queue.add('process_bot_turn', jobData, {
      delay: getBotDebounceDelayMs(),
      jobId,
    });
    return job.id ?? jobId;
  }

  const isRecall =
    'status' in jobData.payload && jobData.payload.status === 1;

  let jobId: string;
  if (messageId) {
    const safeSession = sanitizeJobIdSegment(sessionId);
    const safeMessage = sanitizeJobIdSegment(messageId);
    const collisionHash = hashJobIdParts([sessionId, messageId]).slice(0, 12);
    jobId = isRecall
      ? `msg_${safeSession}_${safeMessage}_${collisionHash}_recall`
      : `msg_${safeSession}_${safeMessage}_${collisionHash}`;
  } else {
    jobId = buildSessionUpdateJobId(sessionId, jobData.payload);
  }

  const job = await queue.add('process_chat_event', jobData, {
    jobId,
  });

  return job.id ?? jobId;
}

export async function scheduleBotConversationTurn(
  connectionId: number | undefined,
  conversationId: number,
  sessionId: string,
  triggerMessageId: string,
  delayMs?: number,
): Promise<string> {
  const effectiveDelayMs =
    typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs > 0
      ? Math.floor(delayMs)
      : getBotDebounceDelayMs();
  const ttlSeconds = Math.max(Math.ceil(effectiveDelayMs / 1000) + 60, 60);
  const debounceKey = getBotDebounceKey(sessionId);

  await redis.set(debounceKey, triggerMessageId, 'EX', ttlSeconds);

  const queue = getChatMessageQueue(sessionId);
  const jobId = buildBotTurnJobId(sessionId, triggerMessageId);
  const jobData: ChatBotTurnJobData = {
    eventType: 'bot_turn',
    connectionId,
    conversationId,
    sessionId,
    triggerMessageId,
    platform: 'lazada',
    receivedAt: Date.now(),
  };

  const job = await queue.add('process_bot_turn', jobData, {
    delay: effectiveDelayMs,
    jobId,
  });

  return job.id ?? jobId;
}

/**
 * Schedules a single delayed one-time Lazada chat history backfill job after OAuth completion.
 * Uses a colon-free deterministic jobId so BullMQ 6.7.2 validates and deduplicates per connection.
 */
export async function scheduleInitialChatHistorySync(
  connectionId: number,
  delayMs?: number,
): Promise<string> {
  if (!Number.isInteger(connectionId) || connectionId <= 0) {
    throw new Error('connectionId must be a positive integer to schedule initial chat sync');
  }

  const effectiveDelayMs =
    typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs >= 0
      ? Math.floor(delayMs)
      : getInitialChatSyncDelayMs();

  const jobId = buildInitialChatSyncJobId(connectionId);
  const queue = getChatMessageQueue(jobId);
  const jobData: ChatInitialSyncJobData = {
    eventType: 'initial_chat_sync',
    connectionId,
    platform: 'lazada',
    requestedAt: Date.now(),
  };

  const job = await queue.add('process_initial_chat_sync', jobData, {
    delay: effectiveDelayMs,
    jobId,
  });

  return job.id ?? jobId;
}

/**
 * Schedules a Lazada chat history reconciliation job with a colon-free deterministic
 * deduplication window jobId so rapid restarts cannot trigger duplicate sync storms.
 */
export async function scheduleLazadaChatReconciliation(
  connectionId: number,
  options: ScheduleLazadaChatReconciliationOptions,
): Promise<string> {
  if (!Number.isInteger(connectionId) || connectionId <= 0) {
    throw new Error(
      'connectionId must be a positive integer to schedule Lazada chat reconciliation',
    );
  }

  const nowMs = Date.now();
  const jobId = buildLazadaChatReconcileJobId(
    connectionId,
    options.syncMode,
    options.reason,
    nowMs,
  );
  const queue = getChatMessageQueue(`chat-reconcile_${connectionId}`);

  const normalizedSinceTimestampMs =
    typeof options.sinceTimestampMs === 'number' &&
    Number.isFinite(options.sinceTimestampMs) &&
    options.sinceTimestampMs >= 0
      ? Math.floor(options.sinceTimestampMs)
      : undefined;

  const jobData: ChatReconcileSyncJobData = {
    eventType: 'reconcile_chat_sync',
    connectionId,
    platform: 'lazada',
    syncMode: options.syncMode,
    reason: options.reason,
    ...(normalizedSinceTimestampMs !== undefined
      ? { sinceTimestampMs: normalizedSinceTimestampMs }
      : {}),
    requestedAt: nowMs,
  };

  const normalizedDelayMs =
    typeof options.delayMs === 'number' &&
    Number.isFinite(options.delayMs) &&
    options.delayMs > 0
      ? Math.floor(options.delayMs)
      : undefined;

  const job = await queue.add('process_reconcile_chat_sync', jobData, {
    jobId,
    ...(normalizedDelayMs !== undefined ? { delay: normalizedDelayMs } : {}),
  });

  return job.id ?? jobId;
}

export async function cancelPendingBotTurn(sessionId: string): Promise<void> {
  if (!sessionId) {
    return;
  }

  await redis.del(getBotDebounceKey(sessionId));

  // Guard BullMQ queue lookup when running under minimal Redis mocks in unrelated unit tests
  const hasRedisSet =
    typeof (redis as unknown as Record<string, unknown>).set === 'function';
  if (!hasRedisSet) {
    return;
  }

  try {
    const queue = getChatMessageQueue(sessionId);
    const pendingJobs: Array<{
      id?: string;
      data?: Partial<ChatWebhookJobData>;
      remove?: () => Promise<void>;
    }> = [];

    if (typeof queue.getDelayed === 'function') {
      const delayed = await queue.getDelayed();
      if (Array.isArray(delayed)) {
        pendingJobs.push(...delayed);
      }
    }

    if (typeof queue.getWaiting === 'function') {
      const waiting = await queue.getWaiting();
      if (Array.isArray(waiting)) {
        pendingJobs.push(...waiting);
      }
    }

    for (const job of pendingJobs) {
      if (
        job?.data?.eventType === 'bot_turn' &&
        job.data.sessionId === sessionId &&
        typeof job.remove === 'function'
      ) {
        try {
          await job.remove();
        } catch (removeError) {
          appLogger.warn('Failed to remove pending bot_turn job', {
            sessionId,
            jobId: job.id,
            error:
              removeError instanceof Error
                ? removeError.message
                : String(removeError),
          });
        }
      }
    }
  } catch (queueError) {
    appLogger.warn('Failed to clean up pending bot_turn queue jobs', {
      sessionId,
      error:
        queueError instanceof Error ? queueError.message : String(queueError),
    });
  }
}

