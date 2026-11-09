import { Queue, type ConnectionOptions } from 'bullmq';
import { getRedisClient } from './redis';
import { appLogger } from './logger';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

export const CHAT_MESSAGE_QUEUE_NAME = 'chat-message-queue';

export type ChatWebhookJobData = {
  eventType: 'push_message' | 'push_session_update';
  connectionId?: number;
  externalShopId?: string;
  platform: string;
  payload: LazadaPushMessagePayload | LazadaPushSessionUpdatePayload;
  receivedAt: number;
};

const globalForQueue = globalThis as unknown as {
  chatMessageQueue: Queue<ChatWebhookJobData> | undefined;
};

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

export function getChatMessageQueue(): Queue<ChatWebhookJobData> {
  if (globalForQueue.chatMessageQueue) {
    return globalForQueue.chatMessageQueue;
  }

  const queue = new Queue<ChatWebhookJobData>(CHAT_MESSAGE_QUEUE_NAME, {
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
    appLogger.error('Chat message queue connection error:', error);
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForQueue.chatMessageQueue = queue;
  }

  return queue;
}

export async function addChatMessageJob(
  jobData: ChatWebhookJobData,
  sessionId: string,
  messageId?: string,
): Promise<string> {
  const queue = getChatMessageQueue();
  const isRecall =
    'status' in jobData.payload && jobData.payload.status === 1;

  let jobId: string;
  if (messageId) {
    jobId = isRecall
      ? `msg:${sessionId}:${messageId}:recall`
      : `msg:${sessionId}:${messageId}`;
  } else {
    jobId = `session:${sessionId}:${Date.now()}`;
  }

  const job = await queue.add('process_chat_event', jobData, {
    jobId,
  });

  return job.id ?? jobId;
}

