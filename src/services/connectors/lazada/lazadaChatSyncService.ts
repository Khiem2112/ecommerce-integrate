import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { withDistributedLock } from '@/lib/redlock';
import { appLogger } from '@/lib/logger';
import { computeMonotonicLastMessageTime } from '@/utils';
import { chatBroadcaster } from '@/services/chatBroadcaster';
import { canActorManageConnections } from '@/services/shopConnectionPermissionService';
import {
  hydrateCustomerFromLazadaSession,
  ingestLazadaMessage,
  isRealLazadaOperatorReply,
  pickNonEmptyStringValue,
  resolveConversationStatusId,
} from '@/services/chatIngestionService';
import {
  getLazadaImSession,
  listLazadaImMessages,
  listLazadaImSessions,
} from './lazadaImService';
import type {
  ActionResponse,
  LazadaImMessageItemDTO,
  LazadaImSessionDetailDTO,
  LazadaPushMessagePayload,
  OrganizationRoleCode,
  SyncLazadaChatHistoryOptions,
  SyncLazadaChatHistoryResult,
} from '@/types';

export const LAZADA_CHAT_PAGE_SIZE = 20;
export const LAZADA_MAX_SYNC_SESSIONS = 3000;
export const LAZADA_DEFAULT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
export const LAZADA_INCREMENTAL_SYNC_OVERLAP_MS = 10 * 60 * 1000;
export const LAZADA_SESSION_MESSAGE_OVERLAP_MS = 5 * 60 * 1000;
export const LAZADA_MAX_SESSION_PAGES = 200;
export const LAZADA_MAX_MESSAGE_PAGES_PER_SESSION = 100;
export const CHAT_HISTORY_SYNC_COOLDOWN_SECONDS = 300;
const CHAT_HISTORY_SYNC_FAILURE_BACKOFF_SECONDS = 30;
const SESSION_LOCK_TTL_MS = 25_000;

const EXISTING_CONVERSATION_PREFETCH_SELECT = {
  id: true,
  isActive: true,
  unreadCount: true,
  lastMessageTime: true,
  customer: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.ConversationSelect;

type PreFetchedConversationSnapshot = Prisma.ConversationGetPayload<{
  select: typeof EXISTING_CONVERSATION_PREFETCH_SELECT;
}>;

export function getChatHistorySyncCooldownKey(connectionId: number): string {
  return `cooldown:chat-history-sync:${connectionId}`;
}

export type TriggerManualLazadaChatHistorySyncInput = {
  readonly connectionId: number;
  readonly organizationId: number;
  readonly actorUserId: number;
  readonly actorRoleCode?: string | null;
  readonly options?: SyncLazadaChatHistoryOptions;
};

function normalizePageSize(pageSize?: number): number {
  if (
    typeof pageSize === 'number' &&
    Number.isInteger(pageSize) &&
    pageSize >= 1 &&
    pageSize <= LAZADA_CHAT_PAGE_SIZE
  ) {
    return pageSize;
  }
  return LAZADA_CHAT_PAGE_SIZE;
}

function normalizeUnreadCount(rawUnreadCount: unknown): number | undefined {
  if (typeof rawUnreadCount === 'number' && Number.isFinite(rawUnreadCount)) {
    return Math.max(0, Math.trunc(rawUnreadCount));
  }
  return undefined;
}

function resolveIncrementalOverlapMs(overlapMs?: number): number {
  if (
    typeof overlapMs === 'number' &&
    Number.isFinite(overlapMs) &&
    overlapMs >= 0
  ) {
    return Math.floor(overlapMs);
  }
  return LAZADA_INCREMENTAL_SYNC_OVERLAP_MS;
}

/**
 * Resolves the session-list start timestamp for a connection sync run.
 * Incremental runs derive the watermark from the newest active conversation minus overlap
 * when no explicit startTime is provided; full runs retain the default 30-day lookback.
 */
async function resolveSyncStartTime(
  connectionId: number,
  options: SyncLazadaChatHistoryOptions,
): Promise<number> {
  if (
    typeof options.startTime === 'number' &&
    Number.isFinite(options.startTime) &&
    options.startTime >= 0
  ) {
    return Math.floor(options.startTime);
  }

  if (options.mode === 'incremental') {
    const effectiveOverlapMs = resolveIncrementalOverlapMs(options.overlapMs);
    const watermarkAggregate = await prisma.conversation.aggregate({
      where: {
        connectionId,
        isActive: true,
      },
      _max: {
        lastMessageTime: true,
      },
    });
    const maxLastMessageTime = watermarkAggregate?._max?.lastMessageTime;
    const maxLastMessageTimeMs =
      maxLastMessageTime instanceof Date ? maxLastMessageTime.getTime() : NaN;
    if (Number.isFinite(maxLastMessageTimeMs)) {
      return Math.max(0, maxLastMessageTimeMs - effectiveOverlapMs);
    }
  }

  return Math.max(0, Date.now() - LAZADA_DEFAULT_LOOKBACK_MS);
}

/**
 * Evaluates whether an existing active conversation can safely skip per-session message
 * pagination during incremental reconciliation without missing new activity or buyer hydration.
 */
function isSessionUnchangedForIncrementalSync(
  existingConversation: PreFetchedConversationSnapshot | null,
  sessionLastMessageTime: number | undefined,
  resolvedUnreadCount: number | undefined,
): boolean {
  if (
    !existingConversation ||
    !existingConversation.isActive ||
    !(existingConversation.lastMessageTime instanceof Date)
  ) {
    return false;
  }

  const existingLastMessageTimeMs =
    existingConversation.lastMessageTime.getTime();
  if (!Number.isFinite(existingLastMessageTimeMs)) {
    return false;
  }

  if (
    typeof sessionLastMessageTime !== 'number' ||
    !Number.isFinite(sessionLastMessageTime) ||
    sessionLastMessageTime <= 0
  ) {
    return false;
  }

  if (sessionLastMessageTime > existingLastMessageTimeMs) {
    return false;
  }

  const hasCustomerDisplayName = Boolean(
    existingConversation.customer?.displayName?.trim(),
  );
  if (!hasCustomerDisplayName) {
    return false;
  }

  if (
    resolvedUnreadCount !== undefined &&
    resolvedUnreadCount > existingConversation.unreadCount
  ) {
    return false;
  }

  return true;
}

function toPushMessagePayload(
  sessionId: string,
  item: LazadaImMessageItemDTO,
  sessionLastMessageTime?: number,
): LazadaPushMessagePayload {
  const fromType =
    typeof item.from_account_type === 'number' ? item.from_account_type : 1;
  const toType =
    typeof item.to_account_type === 'number'
      ? item.to_account_type
      : fromType === 2
        ? 1
        : 2;
  const fallbackSendTime =
    typeof sessionLastMessageTime === 'number' &&
    Number.isFinite(sessionLastMessageTime) &&
    sessionLastMessageTime > 0
      ? sessionLastMessageTime
      : Date.now();

  return {
    session_id: item.session_id?.trim() || sessionId,
    message_id: String(item.message_id),
    content: typeof item.content === 'string' ? item.content : '',
    from_account_id:
      item.from_account_id !== undefined && item.from_account_id !== null
        ? String(item.from_account_id)
        : '',
    from_account_type: fromType,
    send_time:
      typeof item.send_time === 'number' &&
      Number.isFinite(item.send_time) &&
      item.send_time > 0
        ? item.send_time
        : fallbackSendTime,
    template_id: item.template_id,
    to_account_id:
      item.to_account_id !== undefined && item.to_account_id !== null
        ? String(item.to_account_id)
        : '',
    to_account_type: toType,
    type: item.type,
    site_id: item.site_id,
    process_msg: item.process_msg,
    auto_reply: item.auto_reply,
    status: item.status,
  };
}

function mergeSessionDetails(
  summary: LazadaImSessionDetailDTO,
  fetched: LazadaImSessionDetailDTO,
): LazadaImSessionDetailDTO {
  return {
    ...summary,
    ...fetched,
    session_id: summary.session_id,
    title: fetched.title ?? summary.title,
    buyer_name: fetched.buyer_name ?? summary.buyer_name,
    buyerName: fetched.buyerName ?? summary.buyerName,
    head_url: fetched.head_url ?? summary.head_url,
    headUrl: fetched.headUrl ?? summary.headUrl,
    avatar: fetched.avatar ?? summary.avatar,
    avatarUrl: fetched.avatarUrl ?? summary.avatarUrl,
    unread_count: fetched.unread_count ?? summary.unread_count,
    last_message_time: fetched.last_message_time ?? summary.last_message_time,
  };
}

async function fetchPaginatedLazadaSessions(
  connectionId: number,
  startTime: number,
  pageSize: number,
  maxSessions: number,
): Promise<LazadaImSessionDetailDTO[]> {
  const collected: LazadaImSessionDetailDTO[] = [];
  const seenSessionIds = new Set<string>();
  let currentStartTime: number | undefined = startTime;
  let currentLastSessionId: string | undefined;
  let pageCount = 0;

  while (
    collected.length < maxSessions &&
    pageCount < LAZADA_MAX_SESSION_PAGES
  ) {
    pageCount += 1;
    const response = await listLazadaImSessions(connectionId, {
      startTime: currentStartTime,
      lastSessionId: currentLastSessionId,
      pageSize,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const pageSessions = response.data.session_list ?? [];
    let addedInPage = 0;
    for (const session of pageSessions) {
      const normalizedSessionId = session.session_id?.trim();
      if (!normalizedSessionId || seenSessionIds.has(normalizedSessionId)) {
        continue;
      }
      seenSessionIds.add(normalizedSessionId);
      collected.push({ ...session, session_id: normalizedSessionId });
      addedInPage += 1;
      if (collected.length >= maxSessions) {
        break;
      }
    }

    if (
      !response.data.has_more ||
      pageSessions.length === 0 ||
      collected.length >= maxSessions
    ) {
      break;
    }

    const lastItem = pageSessions[pageSessions.length - 1];
    const nextStartTime =
      response.data.next_start_time ?? lastItem?.last_message_time;
    const nextLastSessionId =
      response.data.last_session_id ?? lastItem?.session_id;

    const cursorStalled =
      nextStartTime === currentStartTime &&
      nextLastSessionId === currentLastSessionId;
    if (
      addedInPage === 0 ||
      cursorStalled ||
      (nextStartTime === undefined && !nextLastSessionId)
    ) {
      appLogger.warn('Stopping Lazada IM session pagination due to non-advancing cursor', {
        connectionId,
        pageCount,
        collectedCount: collected.length,
      });
      break;
    }

    currentStartTime = nextStartTime;
    currentLastSessionId = nextLastSessionId;
  }

  return collected;
}

async function fetchPaginatedSessionMessages(
  connectionId: number,
  sessionId: string,
  startTime: number,
  pageSize: number,
  maxPagesPerSession: number,
): Promise<{ readonly ok: true; readonly messages: LazadaImMessageItemDTO[] } | { readonly ok: false }> {
  const collected: LazadaImMessageItemDTO[] = [];
  const seenMessageIds = new Set<string>();
  let currentStartTime: number | undefined = startTime;
  let currentLastMessageId: string | undefined;
  let pageCount = 0;

  while (pageCount < maxPagesPerSession) {
    pageCount += 1;
    const response = await listLazadaImMessages(connectionId, {
      sessionId,
      startTime: currentStartTime,
      lastMessageId: currentLastMessageId,
      pageSize,
    });

    if (!response.success) {
      appLogger.warn('Failed to fetch Lazada IM messages page during history sync', {
        connectionId,
        sessionId,
        pageCount,
        error: response.error,
      });
      if (pageCount === 1) {
        return { ok: false };
      }
      break;
    }

    const pageMessages = response.data.message_list ?? [];
    let addedInPage = 0;
    for (const item of pageMessages) {
      const msgId = item.message_id !== undefined && item.message_id !== null
        ? String(item.message_id).trim()
        : '';
      if (!msgId || seenMessageIds.has(msgId)) {
        continue;
      }
      seenMessageIds.add(msgId);
      collected.push({ ...item, message_id: msgId });
      addedInPage += 1;
    }

    if (!response.data.has_more || pageMessages.length === 0) {
      break;
    }

    const lastItem = pageMessages[pageMessages.length - 1];
    const nextStartTime =
      response.data.next_start_time ?? lastItem?.send_time;
    const nextLastMessageId =
      response.data.last_message_id ?? lastItem?.message_id;

    const cursorStalled =
      nextStartTime === currentStartTime &&
      nextLastMessageId === currentLastMessageId;
    if (
      addedInPage === 0 ||
      cursorStalled ||
      (nextStartTime === undefined && !nextLastMessageId)
    ) {
      appLogger.warn('Stopping Lazada IM message pagination due to non-advancing cursor', {
        connectionId,
        sessionId,
        pageCount,
        collectedCount: collected.length,
      });
      break;
    }

    currentStartTime = nextStartTime;
    currentLastMessageId = nextLastMessageId;
  }

  collected.sort((a, b) => (a.send_time ?? 0) - (b.send_time ?? 0));
  return { ok: true, messages: collected };
}

/**
 * Synchronizes historical Lazada IM sessions and messages for a single active shop connection
 * without polling loops, live takeover SSE spam, or autonomous bot auto-replies.
 */
export async function syncLazadaChatHistoryForConnection(
  connectionId: number,
  options: SyncLazadaChatHistoryOptions = {},
): Promise<SyncLazadaChatHistoryResult> {
  if (!Number.isInteger(connectionId) || connectionId <= 0) {
    throw new Error('connectionId must be a positive integer');
  }

  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      organizationId: true,
      isActive: true,
      status: true,
      platform: {
        select: {
          code: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !connection ||
    !connection.isActive ||
    connection.status === 'disconnected' ||
    connection.status === 'reconnect_required'
  ) {
    throw new Error(`Active Lazada connection ${connectionId} not found`);
  }

  if (!connection.platform?.isActive || connection.platform.code !== 'lazada') {
    throw new Error(`Connection ${connectionId} is not an active Lazada connection`);
  }

  const pageSize = normalizePageSize(options.pageSize);
  const maxSessions =
    typeof options.maxSessions === 'number' &&
    Number.isFinite(options.maxSessions) &&
    options.maxSessions > 0
      ? Math.min(LAZADA_MAX_SYNC_SESSIONS, Math.floor(options.maxSessions))
      : LAZADA_MAX_SYNC_SESSIONS;
  const maxPagesPerSession =
    typeof options.maxPagesPerSession === 'number' &&
    Number.isFinite(options.maxPagesPerSession) &&
    options.maxPagesPerSession > 0
      ? Math.floor(options.maxPagesPerSession)
      : LAZADA_MAX_MESSAGE_PAGES_PER_SESSION;
  const isIncrementalMode = options.mode === 'incremental';
  const startTime = await resolveSyncStartTime(connectionId, options);

  const sessions = await fetchPaginatedLazadaSessions(
    connectionId,
    startTime,
    pageSize,
    maxSessions,
  );

  let sessionsSynced = 0;
  let sessionsSkippedUnchanged = 0;
  let messagesSynced = 0;
  let lastSyncedSessionId: string | undefined;
  let inProgressStatusIdCache: number | null = null;

  for (const session of sessions) {
    try {
      const existingConversationPreFetch = await prisma.conversation.findUnique({
        where: {
          connectionId_platformSessionId: {
            connectionId,
            platformSessionId: session.session_id,
          },
        },
        select: EXISTING_CONVERSATION_PREFETCH_SELECT,
      });

      if (existingConversationPreFetch && !existingConversationPreFetch.isActive) {
        continue;
      }

      const preFetchLastMessageTimeMs =
        existingConversationPreFetch?.lastMessageTime?.getTime() ?? 0;

      let effectiveSessionDetail: LazadaImSessionDetailDTO = session;
      const summaryDisplayName = pickNonEmptyStringValue([
        session.title,
        session.buyer_name,
        session.buyerName,
      ]);
      const customerNeedsName =
        !existingConversationPreFetch?.customer?.displayName?.trim();

      if (!summaryDisplayName && customerNeedsName) {
        try {
          const fetchedSession = await getLazadaImSession(
            connectionId,
            session.session_id,
          );
          if (fetchedSession.success) {
            effectiveSessionDetail = mergeSessionDetails(
              session,
              fetchedSession.data,
            );
          }
        } catch (hydrateError) {
          appLogger.warn(
            'Non-fatal error fetching Lazada IM session detail during history sync',
            {
              connectionId,
              sessionId: session.session_id,
              error:
                hydrateError instanceof Error
                  ? hydrateError.message
                  : String(hydrateError),
            },
          );
        }
      }

      const resolvedUnreadCount = normalizeUnreadCount(
        effectiveSessionDetail.unread_count ?? session.unread_count,
      );

      // Skip N+1 message list calls during incremental reconciliation when session metadata
      // confirms no newer activity, no unread increase, and an already-hydrated buyer profile.
      if (
        isIncrementalMode &&
        isSessionUnchangedForIncrementalSync(
          existingConversationPreFetch,
          session.last_message_time,
          resolvedUnreadCount,
        )
      ) {
        sessionsSkippedUnchanged += 1;
        continue;
      }

      const messageStartTime =
        isIncrementalMode &&
        existingConversationPreFetch?.lastMessageTime instanceof Date &&
        Number.isFinite(existingConversationPreFetch.lastMessageTime.getTime())
          ? Math.max(
              startTime,
              existingConversationPreFetch.lastMessageTime.getTime() -
                LAZADA_SESSION_MESSAGE_OVERLAP_MS,
            )
          : startTime;

      const messagePageResult = await fetchPaginatedSessionMessages(
        connectionId,
        session.session_id,
        messageStartTime,
        pageSize,
        maxPagesPerSession,
      );

      if (!messagePageResult.ok) {
        continue;
      }
      const sessionFallbackTime =
        typeof effectiveSessionDetail.last_message_time === 'number' &&
        Number.isFinite(effectiveSessionDetail.last_message_time) &&
        effectiveSessionDetail.last_message_time > 0
          ? effectiveSessionDetail.last_message_time
          : undefined;

      const lockResult = await withDistributedLock(
        `session:${session.session_id}`,
        SESSION_LOCK_TTL_MS,
        async () => {
          const lockedConversation = await prisma.conversation.findUnique({
            where: {
              connectionId_platformSessionId: {
                connectionId,
                platformSessionId: session.session_id,
              },
            },
            select: {
              id: true,
              isActive: true,
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
            },
          });

          if (lockedConversation && !lockedConversation.isActive) {
            return { skipped: true as const, sessionMessagesSynced: 0 };
          }

          let latestFetchedSendTimeMs = sessionFallbackTime ?? 0;
          for (const msgItem of messagePageResult.messages) {
            if (
              typeof msgItem.send_time === 'number' &&
              Number.isFinite(msgItem.send_time) &&
              msgItem.send_time > latestFetchedSendTimeMs
            ) {
              latestFetchedSendTimeMs = msgItem.send_time;
            }
          }

          const hasNewerLiveMessage = Boolean(
            lockedConversation?.lastMessageTime &&
              (latestFetchedSendTimeMs > 0
                ? lockedConversation.lastMessageTime.getTime() >
                  latestFetchedSendTimeMs
                : lockedConversation.lastMessageTime.getTime() >
                  preFetchLastMessageTimeMs),
          );

          let targetConversationId: number | undefined = lockedConversation?.id;
          let currentStatusCode: string | null =
            lockedConversation?.status?.code ?? null;
          let latestConversationTime: Date | null =
            lockedConversation?.lastMessageTime ?? null;
          let latestNonSystemPayload: LazadaPushMessagePayload | null = null;
          let latestNonSystemSendTime = -1;
          let hydrationAttempted = false;
          let sessionMessagesSynced = 0;

          for (const msgItem of messagePageResult.messages) {
            const payload = toPushMessagePayload(
              session.session_id,
              msgItem,
              sessionFallbackTime,
            );
            const result = await ingestLazadaMessage({
              connectionId,
              organizationId: connection.organizationId,
              payload,
              mode: 'historical_sync',
              sessionDetail: effectiveSessionDetail,
              targetUnreadCount: resolvedUnreadCount ?? 0,
              skipHydration: hydrationAttempted,
            });

            if (result.outcome !== 'skipped_inactive') {
              hydrationAttempted = true;
            }

            if (
              result.outcome === 'created' ||
              result.outcome === 'updated_recalled'
            ) {
              sessionMessagesSynced += 1;
            }

            if (result.conversationId !== undefined) {
              targetConversationId = result.conversationId;
            }
            if (result.statusCode !== undefined) {
              currentStatusCode = result.statusCode;
            }
            if (result.lastMessageTime) {
              latestConversationTime = computeMonotonicLastMessageTime(
                result.lastMessageTime,
                latestConversationTime,
              );
            }

            if (
              payload.type !== 2 &&
              payload.template_id !== 2 &&
              payload.status !== 1 &&
              payload.send_time >= latestNonSystemSendTime
            ) {
              latestNonSystemSendTime = payload.send_time;
              latestNonSystemPayload = payload;
            }
          }

          if (
            lockedConversation?.customer &&
            lockedConversation.customer.isActive &&
            !lockedConversation.customer.displayName &&
            !hydrationAttempted
          ) {
            await hydrateCustomerFromLazadaSession(
              connectionId,
              session.session_id,
              lockedConversation.customer,
              effectiveSessionDetail,
            );
          }

          if (targetConversationId !== undefined) {
            const finalUpdateData: {
              unreadCount?: number;
              lastMessageTime?: Date;
              statusId?: number;
            } = {};

            if (resolvedUnreadCount !== undefined && !hasNewerLiveMessage) {
              finalUpdateData.unreadCount = resolvedUnreadCount;
            }

            if (sessionFallbackTime !== undefined) {
              const sessionLastMsgDate = new Date(sessionFallbackTime);
              const monotonicTime = computeMonotonicLastMessageTime(
                sessionLastMsgDate,
                latestConversationTime,
              );
              if (
                !latestConversationTime ||
                monotonicTime.getTime() > latestConversationTime.getTime()
              ) {
                finalUpdateData.lastMessageTime = monotonicTime;
              }
            }

            if (
              !hasNewerLiveMessage &&
              latestNonSystemPayload &&
              isRealLazadaOperatorReply(latestNonSystemPayload) &&
              (currentStatusCode === 'open' ||
                currentStatusCode === 'awaiting_reply')
            ) {
              if (inProgressStatusIdCache === null) {
                inProgressStatusIdCache =
                  await resolveConversationStatusId('in_progress');
              }
              finalUpdateData.statusId = inProgressStatusIdCache;
            }

            if (Object.keys(finalUpdateData).length > 0) {
              await prisma.conversation.update({
                where: { id: targetConversationId },
                data: finalUpdateData,
              });
            }
          }

          return {
            skipped: false as const,
            sessionMessagesSynced,
          };
        },
      );

      if (lockResult === null) {
        appLogger.warn(
          'Skipping Lazada chat history session sync due to lock contention',
          {
            connectionId,
            sessionId: session.session_id,
          },
        );
        continue;
      }

      if (lockResult.skipped) {
        continue;
      }

      messagesSynced += lockResult.sessionMessagesSynced;
      sessionsSynced += 1;
      lastSyncedSessionId = session.session_id;
    } catch (sessionError) {
      appLogger.warn(
        'Failed to synchronize Lazada chat session during history backfill',
        {
          connectionId,
          sessionId: session.session_id,
          error:
            sessionError instanceof Error
              ? sessionError.message
              : String(sessionError),
        },
      );
    }
  }

  const lastSyncedAtDate = new Date();

  try {
    await chatBroadcaster.publishChatEvent(
      {
        type: 'chat:session_updated',
        sessionId: lastSyncedSessionId ?? `history_sync_${connectionId}`,
        connectionId,
        lastMessageTime: lastSyncedAtDate,
      },
      connection.organizationId,
    );
  } catch (publishError) {
    appLogger.warn('Non-fatal error publishing summary SSE event after chat history sync', {
      connectionId,
      organizationId: connection.organizationId,
      error:
        publishError instanceof Error
          ? publishError.message
          : String(publishError),
    });
  }

  appLogger.info('Completed Lazada chat history sync for connection', {
    connectionId,
    organizationId: connection.organizationId,
    mode: isIncrementalMode ? 'incremental' : 'full',
    sessionsSynced,
    sessionsSkippedUnchanged,
    messagesSynced,
  });

  return {
    connectionId,
    organizationId: connection.organizationId,
    sessionsSynced,
    sessionsSkippedUnchanged,
    messagesSynced,
    lastSyncedAt: lastSyncedAtDate.toISOString(),
  };
}

/**
 * Validates actor permission, active organization ownership, and a 5-minute per-shop Redis cooldown
 * before executing manual Lazada chat history recovery sync.
 */
export async function triggerManualLazadaChatHistorySyncService(
  input: TriggerManualLazadaChatHistorySyncInput,
): Promise<ActionResponse<SyncLazadaChatHistoryResult>> {
  const { connectionId, organizationId, actorUserId, actorRoleCode, options } =
    input;

  if (!Number.isInteger(connectionId) || connectionId <= 0) {
    return {
      success: false,
      code: 'INVALID_INPUT',
      error: 'A valid shop connection ID is required.',
    };
  }

  const actorUser = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, isAdmin: true, isActive: true },
  });

  if (!actorUser || !actorUser.isActive) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized',
    };
  }

  let resolvedRoleCode: OrganizationRoleCode | undefined = actorRoleCode
    ? (actorRoleCode as OrganizationRoleCode)
    : undefined;

  if (!actorUser.isAdmin && !resolvedRoleCode) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUser.id,
        isActive: true,
        membershipStatus: {
          code: 'active',
          isActive: true,
        },
        role: {
          isActive: true,
        },
      },
      select: {
        role: {
          select: {
            code: true,
          },
        },
      },
    });
    resolvedRoleCode = membership?.role?.code as OrganizationRoleCode | undefined;
  }

  if (
    !canActorManageConnections(
      { id: actorUser.id, isAdmin: Boolean(actorUser.isAdmin) },
      resolvedRoleCode,
    )
  ) {
    return {
      success: false,
      code: 'FORBIDDEN',
      error: 'You do not have permission to synchronize chat history for this shop.',
    };
  }

  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      organizationId: true,
      isActive: true,
      status: true,
      platform: {
        select: {
          code: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !connection ||
    !connection.isActive ||
    connection.organizationId !== organizationId
  ) {
    return {
      success: false,
      code: 'CONNECTION_NOT_FOUND',
      error: 'Active Lazada shop connection not found in the current organization.',
    };
  }

  if (
    connection.status === 'disconnected' ||
    connection.status === 'reconnect_required'
  ) {
    return {
      success: false,
      code: 'CONNECTION_NOT_FOUND',
      error: 'Shop connection is disconnected or requires reconnection.',
    };
  }

  if (!connection.platform?.isActive || connection.platform.code !== 'lazada') {
    return {
      success: false,
      code: 'INVALID_INPUT',
      error: 'Chat history synchronization is only supported for active Lazada connections.',
    };
  }

  const cooldownKey = getChatHistorySyncCooldownKey(connectionId);
  const lockSetResult = await redis.set(
    cooldownKey,
    String(Date.now()),
    'EX',
    CHAT_HISTORY_SYNC_COOLDOWN_SECONDS,
    'NX',
  );

  if (lockSetResult !== 'OK') {
    return {
      success: false,
      code: 'SYNC_COOLDOWN_ACTIVE',
      error: 'Manual chat history sync is on a 5-minute cooldown for this shop.',
    };
  }

  try {
    const summary = await syncLazadaChatHistoryForConnection(
      connectionId,
      options,
    );
    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    await redis
      .expire(cooldownKey, CHAT_HISTORY_SYNC_FAILURE_BACKOFF_SECONDS)
      .catch(() => undefined);
    appLogger.error('Manual Lazada chat history sync failed', {
      connectionId,
      organizationId,
      actorUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      error:
        error instanceof Error
          ? error.message
          : 'Unable to synchronize Lazada chat history.',
    };
  }
}
