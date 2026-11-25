import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message as SqsMessage,
} from '@aws-sdk/client-sqs';
import {
  scheduleLazadaChatReconciliation,
  type ChatWebhookEventJobData,
  type ScheduleLazadaChatReconciliationOptions,
} from '@/lib/queue';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { appLogger } from '@/lib/logger';
import { processChatWebhookJob } from '@/services/chatQueueWorker';
import { LAZADA_INCREMENTAL_SYNC_OVERLAP_MS } from '@/services/connectors';
import { parseLazadaWebhookBody } from '@/utils';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

export const DEFAULT_LAZADA_SQS_REGION = 'ap-southeast-1';
export const DEFAULT_LAZADA_SQS_WAIT_TIME_SECONDS = 20;
export const DEFAULT_LAZADA_SQS_MAX_MESSAGES = 5;
export const DEFAULT_LAZADA_SQS_ERROR_BACKOFF_MS = 3000;

export const LAZADA_SQS_HEARTBEAT_KEY = 'worker:lazada:sqs:heartbeat';
export const DEFAULT_LAZADA_RECOVERY_MIN_DOWNTIME_MS = 1_800_000;
export const DEFAULT_LAZADA_RECOVERY_SQS_RETENTION_GUARD_MS =
  12 * 24 * 60 * 60 * 1000;
export const DEFAULT_LAZADA_HEARTBEAT_INTERVAL_MS = 60_000;

export type StartupDowntimeRecoveryRegime =
  | 'sqs_only'
  | 'drain_then_incremental_sync'
  | 'immediate_full_sync';

export type StartupDowntimeRecoveryConfig = {
  readonly minDowntimeMs: number;
  readonly sqsRetentionGuardMs: number;
};

export type LazadaRecoveryConfig = StartupDowntimeRecoveryConfig & {
  readonly heartbeatIntervalMs: number;
};

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

type ResolvedStartupHeartbeat = {
  readonly lastHeartbeatMs: number | null;
  readonly source: 'redis' | 'database_fallback' | 'none';
};

type PendingIncrementalRecoveryState = {
  readonly recoverySinceMs: number;
  readonly lastHeartbeatMs: number;
  readonly downtimeMs: number;
};

type ConsumerRuntimeState = {
  isStopping: boolean;
  startupRecoveryEvaluated: boolean;
  abortController: AbortController;
  client: SqsClientLike;
  loopPromise: Promise<void>;
  heartbeatTimer?: ReturnType<typeof setInterval>;
  pendingIncrementalRecovery: PendingIncrementalRecoveryState | null;
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

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  return parseOptionalPositiveInt(rawValue) ?? fallback;
}

export function resolveLazadaRecoveryConfig(): LazadaRecoveryConfig {
  return {
    minDowntimeMs: parsePositiveInt(
      process.env.LAZADA_RECOVERY_MIN_DOWNTIME_MS,
      DEFAULT_LAZADA_RECOVERY_MIN_DOWNTIME_MS,
    ),
    sqsRetentionGuardMs: parsePositiveInt(
      process.env.LAZADA_RECOVERY_SQS_RETENTION_GUARD_MS,
      DEFAULT_LAZADA_RECOVERY_SQS_RETENTION_GUARD_MS,
    ),
    heartbeatIntervalMs: parsePositiveInt(
      process.env.LAZADA_HEARTBEAT_INTERVAL_MS,
      DEFAULT_LAZADA_HEARTBEAT_INTERVAL_MS,
    ),
  };
}

/**
 * Classifies startup downtime into one of three recovery regimes based on the elapsed
 * gap since the last worker heartbeat (or database fallback watermark).
 */
export function classifyStartupDowntimeRecovery(
  lastHeartbeatMs: number | null | undefined,
  nowMs: number = Date.now(),
  config: StartupDowntimeRecoveryConfig = {
    minDowntimeMs: DEFAULT_LAZADA_RECOVERY_MIN_DOWNTIME_MS,
    sqsRetentionGuardMs: DEFAULT_LAZADA_RECOVERY_SQS_RETENTION_GUARD_MS,
  },
): StartupDowntimeRecoveryRegime {
  if (
    typeof lastHeartbeatMs !== 'number' ||
    !Number.isFinite(lastHeartbeatMs) ||
    lastHeartbeatMs <= 0 ||
    !Number.isFinite(nowMs)
  ) {
    return 'sqs_only';
  }

  const downtimeMs = Math.max(0, nowMs - lastHeartbeatMs);
  if (downtimeMs >= config.sqsRetentionGuardMs) {
    return 'immediate_full_sync';
  }
  if (downtimeMs >= config.minDowntimeMs) {
    return 'drain_then_incremental_sync';
  }
  return 'sqs_only';
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

async function resolveStartupHeartbeatMs(): Promise<ResolvedStartupHeartbeat> {
  try {
    const rawHeartbeat = await redis.get(LAZADA_SQS_HEARTBEAT_KEY);
    if (typeof rawHeartbeat === 'string' && rawHeartbeat.trim().length > 0) {
      const parsed = Number(rawHeartbeat.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return {
          lastHeartbeatMs: Math.floor(parsed),
          source: 'redis',
        };
      }
    }
  } catch (redisError) {
    appLogger.warn(
      'Failed to read Lazada SQS worker heartbeat from Redis; falling back to database watermark',
      {
        key: LAZADA_SQS_HEARTBEAT_KEY,
        error:
          redisError instanceof Error ? redisError.message : String(redisError),
      },
    );
  }

  try {
    const aggregate = await prisma.conversation.aggregate({
      where: {
        isActive: true,
        connection: {
          isActive: true,
          platform: {
            code: 'lazada',
            isActive: true,
          },
        },
      },
      _max: {
        lastMessageTime: true,
      },
    });

    const maxLastMessageTime = aggregate?._max?.lastMessageTime;
    const fallbackMs =
      maxLastMessageTime instanceof Date ? maxLastMessageTime.getTime() : NaN;
    if (Number.isFinite(fallbackMs) && fallbackMs > 0) {
      return {
        lastHeartbeatMs: Math.floor(fallbackMs),
        source: 'database_fallback',
      };
    }
  } catch (dbError) {
    appLogger.warn(
      'Failed to query active Lazada conversation watermark fallback for startup recovery',
      {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      },
    );
  }

  return {
    lastHeartbeatMs: null,
    source: 'none',
  };
}

async function writeLazadaSqsHeartbeat(
  timestampMs: number = Date.now(),
): Promise<boolean> {
  const normalizedTs =
    Number.isFinite(timestampMs) && timestampMs > 0
      ? Math.floor(timestampMs)
      : Date.now();
  try {
    await redis.set(LAZADA_SQS_HEARTBEAT_KEY, String(normalizedTs));
    return true;
  } catch (redisError) {
    appLogger.warn('Failed to write Lazada SQS worker heartbeat to Redis', {
      key: LAZADA_SQS_HEARTBEAT_KEY,
      error:
        redisError instanceof Error ? redisError.message : String(redisError),
    });
    return false;
  }
}

async function scheduleReconciliationForActiveLazadaConnections(
  options: ScheduleLazadaChatReconciliationOptions,
): Promise<number> {
  let connections: Array<{ id: number }>;
  try {
    connections = await prisma.platformConnection.findMany({
      where: {
        isActive: true,
        platform: {
          code: 'lazada',
          isActive: true,
        },
      },
      select: {
        id: true,
      },
    });
  } catch (dbError) {
    appLogger.error(
      'Failed to load active Lazada connections for startup chat reconciliation',
      {
        syncMode: options.syncMode,
        reason: options.reason,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      },
    );
    return 0;
  }

  let scheduledCount = 0;
  for (const connection of connections) {
    try {
      const jobId = await scheduleLazadaChatReconciliation(
        connection.id,
        options,
      );
      scheduledCount += 1;
      appLogger.info('Scheduled Lazada chat reconciliation job', {
        connectionId: connection.id,
        jobId,
        syncMode: options.syncMode,
        reason: options.reason,
        sinceTimestampMs: options.sinceTimestampMs,
      });
    } catch (scheduleError) {
      appLogger.error(
        'Failed to schedule Lazada chat reconciliation job for connection',
        {
          connectionId: connection.id,
          syncMode: options.syncMode,
          reason: options.reason,
          error:
            scheduleError instanceof Error
              ? scheduleError.message
              : String(scheduleError),
        },
      );
    }
  }

  return scheduledCount;
}

function clearHeartbeatTimer(state: ConsumerRuntimeState): void {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = undefined;
  }
}

async function initializeStartupRecovery(
  state: ConsumerRuntimeState,
  recoveryConfig: LazadaRecoveryConfig,
): Promise<void> {
  const nowMs = Date.now();
  const { lastHeartbeatMs, source } = await resolveStartupHeartbeatMs();
  const regime = classifyStartupDowntimeRecovery(
    lastHeartbeatMs,
    nowMs,
    recoveryConfig,
  );
  const overlapMs = Number.isFinite(LAZADA_INCREMENTAL_SYNC_OVERLAP_MS)
    ? LAZADA_INCREMENTAL_SYNC_OVERLAP_MS
    : 600_000;

  // Capture the recovery anchor before refreshing heartbeat or draining SQS messages
  const recoverySinceMs =
    lastHeartbeatMs !== null ? Math.max(0, lastHeartbeatMs - overlapMs) : null;
  const downtimeMs =
    lastHeartbeatMs !== null ? Math.max(0, nowMs - lastHeartbeatMs) : 0;

  appLogger.info('Evaluated Lazada SQS startup downtime recovery regime', {
    regime,
    heartbeatSource: source,
    lastHeartbeatMs,
    downtimeMs,
    recoverySinceMs,
    minDowntimeMs: recoveryConfig.minDowntimeMs,
    sqsRetentionGuardMs: recoveryConfig.sqsRetentionGuardMs,
  });

  if (state.isStopping || state.abortController.signal.aborted) {
    return;
  }

  if (regime === 'immediate_full_sync') {
    await scheduleReconciliationForActiveLazadaConnections({
      syncMode: 'full',
      reason: 'sqs_retention_exceeded',
    });
  } else if (
    regime === 'drain_then_incremental_sync' &&
    recoverySinceMs !== null &&
    lastHeartbeatMs !== null
  ) {
    state.pendingIncrementalRecovery = {
      recoverySinceMs,
      lastHeartbeatMs,
      downtimeMs,
    };
  }

  if (state.isStopping || state.abortController.signal.aborted) {
    return;
  }

  await writeLazadaSqsHeartbeat(Date.now());

  if (state.isStopping || state.abortController.signal.aborted) {
    return;
  }

  state.startupRecoveryEvaluated = true;

  const timer = setInterval(() => {
    if (state.isStopping || state.abortController.signal.aborted) {
      return;
    }
    void writeLazadaSqsHeartbeat(Date.now());
  }, recoveryConfig.heartbeatIntervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  state.heartbeatTimer = timer;
}

export function startLazadaSqsConsumer(
  overrideConfig?: LazadaSqsConsumerConfig,
  overrideClient?: SqsClientLike,
  overrideRecoveryConfig?: Partial<LazadaRecoveryConfig>,
): boolean {
  if (globalForSqsConsumer.lazadaSqsConsumerState) {
    return true;
  }

  const config = overrideConfig ?? resolveLazadaSqsConsumerConfig();
  if (!config) {
    return false;
  }

  const resolvedRecovery = resolveLazadaRecoveryConfig();
  const recoveryConfig: LazadaRecoveryConfig = {
    minDowntimeMs:
      overrideRecoveryConfig?.minDowntimeMs ?? resolvedRecovery.minDowntimeMs,
    sqsRetentionGuardMs:
      overrideRecoveryConfig?.sqsRetentionGuardMs ??
      resolvedRecovery.sqsRetentionGuardMs,
    heartbeatIntervalMs:
      overrideRecoveryConfig?.heartbeatIntervalMs ??
      resolvedRecovery.heartbeatIntervalMs,
  };

  const client: SqsClientLike =
    overrideClient ?? new SQSClient({ region: config.region });
  const abortController = new AbortController();

  const state: ConsumerRuntimeState = {
    isStopping: false,
    startupRecoveryEvaluated: false,
    abortController,
    client,
    loopPromise: Promise.resolve(),
    pendingIncrementalRecovery: null,
  };

  const runLoop = async (): Promise<void> => {
    appLogger.info('Started Lazada SQS Long Polling consumer', {
      region: config.region,
      queueUrl: config.queueUrl,
      waitTimeSeconds: config.waitTimeSeconds,
      maxNumberOfMessages: config.maxNumberOfMessages,
    });

    try {
      await initializeStartupRecovery(state, recoveryConfig);

      while (!state.isStopping && !abortController.signal.aborted) {
        try {
          const summary = await pollLazadaSqsOnce(
            client,
            config,
            abortController.signal,
          );
          if (
            summary.receivedCount === 0 &&
            state.pendingIncrementalRecovery !== null &&
            !state.isStopping &&
            !abortController.signal.aborted
          ) {
            const pending = state.pendingIncrementalRecovery;
            state.pendingIncrementalRecovery = null;
            await scheduleReconciliationForActiveLazadaConnections({
              syncMode: 'incremental',
              reason: 'startup_downtime',
              sinceTimestampMs: pending.recoverySinceMs,
            });
          }
        } catch (error) {
          if (
            state.isStopping ||
            abortController.signal.aborted ||
            isAbortError(error)
          ) {
            break;
          }
          appLogger.error('Error polling Lazada SQS FIFO queue', {
            queueUrl: config.queueUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          await sleepWithAbort(config.errorBackoffMs, abortController.signal);
        }
      }
    } finally {
      clearHeartbeatTimer(state);
      appLogger.info('Stopped Lazada SQS Long Polling consumer', {
        queueUrl: config.queueUrl,
      });
    }
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
  clearHeartbeatTimer(state);
  state.abortController.abort();

  try {
    await state.loopPromise;
  } finally {
    clearHeartbeatTimer(state);
    if (state.startupRecoveryEvaluated) {
      await writeLazadaSqsHeartbeat(Date.now());
    }
    try {
      state.client.destroy();
    } finally {
      globalForSqsConsumer.lazadaSqsConsumerState = undefined;
    }
  }
}
