import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message as SqsMessage,
} from '@aws-sdk/client-sqs';
import type { ChatWebhookEventJobData } from '@/lib/queue';
import { appLogger } from '@/lib/logger';
import { processChatWebhookJob } from '@/services/chatQueueWorker';
import { parseLazadaWebhookBody } from '@/utils';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

export const DEFAULT_LAZADA_SQS_REGION = 'ap-southeast-1';
export const DEFAULT_LAZADA_SQS_WAIT_TIME_SECONDS = 20;
export const DEFAULT_LAZADA_SQS_MAX_MESSAGES = 5;
export const DEFAULT_LAZADA_SQS_ERROR_BACKOFF_MS = 3000;

export type LazadaSqsConsumerConfig = {
  readonly queueUrl: string;
  readonly region: string;
  readonly waitTimeSeconds: number;
  readonly maxNumberOfMessages: number;
  readonly visibilityTimeoutSeconds?: number;
  readonly errorBackoffMs: number;
};

export type LazadaSqsBatchSummary = {
  readonly receivedCount: number;
  readonly processedCount: number;
  readonly deletedCount: number;
  readonly failedCount: number;
};

export type SqsClientLike = Pick<SQSClient, 'send' | 'destroy'>;

type ParsedSqsWebhookJob = {
  readonly sessionId: string;
  readonly messageId?: string;
  readonly jobData: ChatWebhookEventJobData;
};

type ConsumerRuntimeState = {
  isStopping: boolean;
  abortController: AbortController;
  client: SqsClientLike;
  loopPromise: Promise<void>;
};

const globalForSqsConsumer = globalThis as unknown as {
  lazadaSqsConsumerState?: ConsumerRuntimeState;
};

function parseBoundedInt(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalPositiveInt(rawValue: string | undefined): number | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function isLazadaSqsConsumerEnabled(): boolean {
  const queueUrl = process.env.LAZADA_SQS_QUEUE_URL?.trim();
  if (!queueUrl) {
    return false;
  }
  return process.env.ENABLE_LAZADA_SQS_CONSUMER?.trim().toLowerCase() !== 'false';
}

export function resolveLazadaSqsConsumerConfig(): LazadaSqsConsumerConfig | null {
  if (!isLazadaSqsConsumerEnabled()) {
    return null;
  }

  const queueUrl = process.env.LAZADA_SQS_QUEUE_URL?.trim();
  if (!queueUrl) {
    return null;
  }

  const region =
    process.env.LAZADA_SQS_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    DEFAULT_LAZADA_SQS_REGION;

  return {
    queueUrl,
    region,
    waitTimeSeconds: parseBoundedInt(
      process.env.LAZADA_SQS_WAIT_TIME_SECONDS,
      DEFAULT_LAZADA_SQS_WAIT_TIME_SECONDS,
      1,
      20,
    ),
    maxNumberOfMessages: parseBoundedInt(
      process.env.LAZADA_SQS_MAX_MESSAGES,
      DEFAULT_LAZADA_SQS_MAX_MESSAGES,
      1,
      10,
    ),
    visibilityTimeoutSeconds: parseOptionalPositiveInt(
      process.env.LAZADA_SQS_VISIBILITY_TIMEOUT_SECONDS,
    ),
    errorBackoffMs: parseBoundedInt(
      process.env.LAZADA_SQS_ERROR_BACKOFF_MS,
      DEFAULT_LAZADA_SQS_ERROR_BACKOFF_MS,
      250,
      60_000,
    ),
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses an SQS message body into a chat webhook job payload. Supports both the Lambda
 * ingress envelope and raw Lazada webhook JSON. Returns null for probe pings.
 */
export function parseSqsMessageBodyToJob(
  rawBody: string | undefined,
): ParsedSqsWebhookJob | null {
  if (!rawBody || rawBody.trim().length === 0) {
    throw new Error('Empty SQS message body');
  }

  const parsed: unknown = JSON.parse(rawBody);
  if (!isPlainRecord(parsed)) {
    throw new Error('SQS message body must be a JSON object');
  }

  if (
    parsed.source === 'aws-lazada-webhook' &&
    isPlainRecord(parsed.payload)
  ) {
    const sessionId =
      typeof parsed.sessionId === 'string' ? parsed.sessionId.trim() : '';
    if (!sessionId) {
      return null;
    }

    const messageId =
      typeof parsed.messageId === 'string' && parsed.messageId.trim() !== ''
        ? parsed.messageId.trim()
        : undefined;
    const externalShopId =
      typeof parsed.externalShopId === 'string' && parsed.externalShopId.trim() !== ''
        ? parsed.externalShopId.trim()
        : undefined;
    const eventType: ChatWebhookEventJobData['eventType'] =
      parsed.eventType === 'push_message'
        ? 'push_message'
        : 'push_session_update';
    const receivedAt =
      typeof parsed.receivedAt === 'number' && Number.isFinite(parsed.receivedAt)
        ? parsed.receivedAt
        : Date.now();

    return {
      sessionId,
      messageId,
      jobData: {
        eventType,
        externalShopId,
        platform: 'lazada',
        payload:
          eventType === 'push_message'
            ? (parsed.payload as unknown as LazadaPushMessagePayload)
            : (parsed.payload as unknown as LazadaPushSessionUpdatePayload),
        receivedAt,
      },
    };
  }

  const normalized = parseLazadaWebhookBody(parsed);
  if (!normalized) {
    return null;
  }

  return {
    sessionId: normalized.sessionId,
    messageId: normalized.messageId,
    jobData: {
      eventType: normalized.eventType,
      externalShopId: normalized.externalShopId,
      platform: 'lazada',
      payload: normalized.payload,
      receivedAt: Date.now(),
    },
  };
}

async function deleteSqsMessage(
  client: SqsClientLike,
  queueUrl: string,
  receiptHandle: string | undefined,
  sqsMessageId: string | undefined,
): Promise<boolean> {
  if (!receiptHandle) {
    return false;
  }

  try {
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
    return true;
  } catch (deleteError) {
    appLogger.warn('Failed to delete processed SQS message; database idempotency will deduplicate redelivery', {
      sqsMessageId,
      error:
        deleteError instanceof Error ? deleteError.message : String(deleteError),
    });
    return false;
  }
}

/**
 * Processes an ordered SQS FIFO batch sequentially via direct database ingestion,
 * halting remaining records for any MessageGroupId/session_id that fails so intra-session FIFO order is preserved.
 */
export async function processLazadaSqsBatch(
  client: SqsClientLike,
  queueUrl: string,
  messages: readonly SqsMessage[],
): Promise<LazadaSqsBatchSummary> {
  const failedSessionGroups = new Set<string>();
  let processedCount = 0;
  let deletedCount = 0;
  let failedCount = 0;

  for (const message of messages) {
    const sqsGroupId = message.Attributes?.MessageGroupId;
    if (sqsGroupId && failedSessionGroups.has(sqsGroupId)) {
      failedCount += 1;
      appLogger.warn('Skipping SQS FIFO message after earlier failure in the same MessageGroupId', {
        sqsMessageId: message.MessageId,
        messageGroupId: sqsGroupId,
      });
      continue;
    }

    let parsedJob: ParsedSqsWebhookJob | null;
    try {
      parsedJob = parseSqsMessageBodyToJob(message.Body);
    } catch (parseError) {
      failedCount += 1;
      if (sqsGroupId) {
        failedSessionGroups.add(sqsGroupId);
      }
      appLogger.error('Invalid Lazada SQS message payload; retaining in queue for DLQ inspection', {
        sqsMessageId: message.MessageId,
        messageGroupId: sqsGroupId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      continue;
    }

    if (!parsedJob) {
      // Remove stray probe events without session_id so they do not block the FIFO group
      const deleted = await deleteSqsMessage(
        client,
        queueUrl,
        message.ReceiptHandle,
        message.MessageId,
      );
      if (deleted) {
        deletedCount += 1;
      }
      continue;
    }

    const effectiveGroupKey = sqsGroupId || parsedJob.sessionId;
    if (failedSessionGroups.has(effectiveGroupKey)) {
      failedCount += 1;
      appLogger.warn('Skipping SQS FIFO message after earlier failure in the same session group', {
        sqsMessageId: message.MessageId,
        sessionGroupKey: effectiveGroupKey,
      });
      continue;
    }

    try {
      await processChatWebhookJob(parsedJob.jobData);
      processedCount += 1;

      const deleted = await deleteSqsMessage(
        client,
        queueUrl,
        message.ReceiptHandle,
        message.MessageId,
      );
      if (deleted) {
        deletedCount += 1;
      }

      appLogger.info('Processed Lazada SQS message directly into database', {
        sqsMessageId: message.MessageId,
        eventType: parsedJob.jobData.eventType,
        sessionId: parsedJob.sessionId,
        messageId: parsedJob.messageId,
      });
    } catch (processError) {
      failedCount += 1;
      failedSessionGroups.add(effectiveGroupKey);
      appLogger.error('Failed to process Lazada SQS message directly; retaining message in SQS for retry', {
        sqsMessageId: message.MessageId,
        eventType: parsedJob.jobData.eventType,
        sessionId: parsedJob.sessionId,
        messageId: parsedJob.messageId,
        error:
          processError instanceof Error
            ? processError.message
            : String(processError),
      });
    }
  }

  return {
    receivedCount: messages.length,
    processedCount,
    deletedCount,
    failedCount,
  };
}

export async function pollLazadaSqsOnce(
  client: SqsClientLike,
  config: LazadaSqsConsumerConfig,
  abortSignal?: AbortSignal,
): Promise<LazadaSqsBatchSummary> {
  const response = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: config.queueUrl,
      MaxNumberOfMessages: config.maxNumberOfMessages,
      WaitTimeSeconds: config.waitTimeSeconds,
      ...(config.visibilityTimeoutSeconds !== undefined
        ? { VisibilityTimeout: config.visibilityTimeoutSeconds }
        : {}),
      MessageSystemAttributeNames: [
        'MessageGroupId',
        'MessageDeduplicationId',
        'ApproximateReceiveCount',
      ],
    }),
    abortSignal ? { abortSignal } : undefined,
  );

  const messages = response.Messages ?? [];
  if (messages.length === 0) {
    return {
      receivedCount: 0,
      processedCount: 0,
      deletedCount: 0,
      failedCount: 0,
    };
  }

  return processLazadaSqsBatch(client, config.queueUrl, messages);
}

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function startLazadaSqsConsumer(
  overrideConfig?: LazadaSqsConsumerConfig,
  overrideClient?: SqsClientLike,
): boolean {
  if (globalForSqsConsumer.lazadaSqsConsumerState) {
    return true;
  }

  const config = overrideConfig ?? resolveLazadaSqsConsumerConfig();
  if (!config) {
    return false;
  }

  const client: SqsClientLike =
    overrideClient ?? new SQSClient({ region: config.region });
  const abortController = new AbortController();

  const state: ConsumerRuntimeState = {
    isStopping: false,
    abortController,
    client,
    loopPromise: Promise.resolve(),
  };

  const runLoop = async (): Promise<void> => {
    appLogger.info('Started Lazada SQS Long Polling consumer', {
      region: config.region,
      queueUrl: config.queueUrl,
      waitTimeSeconds: config.waitTimeSeconds,
      maxNumberOfMessages: config.maxNumberOfMessages,
    });

    while (!state.isStopping && !abortController.signal.aborted) {
      try {
        await pollLazadaSqsOnce(client, config, abortController.signal);
      } catch (error) {
        if (state.isStopping || abortController.signal.aborted || isAbortError(error)) {
          break;
        }
        appLogger.error('Error polling Lazada SQS FIFO queue', {
          queueUrl: config.queueUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        await sleepWithAbort(config.errorBackoffMs, abortController.signal);
      }
    }

    appLogger.info('Stopped Lazada SQS Long Polling consumer', {
      queueUrl: config.queueUrl,
    });
  };

  state.loopPromise = runLoop();
  globalForSqsConsumer.lazadaSqsConsumerState = state;
  return true;
}

export async function stopLazadaSqsConsumer(): Promise<void> {
  const state = globalForSqsConsumer.lazadaSqsConsumerState;
  if (!state) {
    return;
  }

  state.isStopping = true;
  state.abortController.abort();

  try {
    await state.loopPromise;
  } finally {
    try {
      state.client.destroy();
    } finally {
      globalForSqsConsumer.lazadaSqsConsumerState = undefined;
    }
  }
}
