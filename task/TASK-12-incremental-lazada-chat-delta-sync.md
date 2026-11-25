# Task: TASK-12 - Incremental Delta Reconciliation for Lazada IM Session and Message APIs

- Feature: Lazada Chat History Sync & Reconciliation
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`, `.agents/skills/convention/SKILL.md`
- Scope: backend
- Status: Complete

## Objective

Eliminate N+1 `/im/message/list` API calls in `src/services/connectors/lazada/lazadaChatSyncService.ts` when running incremental recovery or reconciliation against Lazada's two independent chat APIs (`listLazadaImSessions` and `listLazadaImMessages`). Compute a connection-level watermark from existing DB conversations, skip message fetches for unchanged sessions, and narrow per-session message queries to each session's own watermark minus a safety overlap window.

## Technical Context And Dependencies

- Pre-requisites: `TASK-02`, `TASK-06` (existing `lazadaImService.ts` and `lazadaChatSyncService.ts`).
- Reusable Assets:
  - `listLazadaImSessions`, `listLazadaImMessages`, `getLazadaImSession` in `src/services/connectors/lazada/lazadaImService.ts`
  - `ingestLazadaMessage` in `src/services/chatIngestionService.ts`
  - `withDistributedLock` in `src/lib/redlock.ts`
  - `prisma.conversation` unique index `@@unique([connectionId, platformSessionId])` in `src/model/schema.prisma`
- Target Files:
  - `src/types/lazada.ts`
  - `src/services/connectors/lazada/lazadaChatSyncService.ts`
  - `test/services/lazadaChatSyncService.test.ts`
  - `test/connectors/lazadaChatSyncService.test.ts`

## Checklist

- [x] Extend sync options and result types in `src/types/lazada.ts`:
  - Add optional `mode?: 'full' | 'incremental'` and `overlapMs?: number` to `SyncLazadaChatHistoryOptions` (defaulting to existing behavior when omitted so manual/initial full backfills remain backward compatible).
  - Add optional `sessionsSkippedUnchanged?: number` to `SyncLazadaChatHistoryResult` for observability and test verification.
- [x] Implement connection-level watermark calculation and per-session delta filtering in `src/services/connectors/lazada/lazadaChatSyncService.ts`:
  - Add constant `LAZADA_INCREMENTAL_SYNC_OVERLAP_MS = 10 * 60 * 1000` (10-minute safety overlap) and `LAZADA_SESSION_MESSAGE_OVERLAP_MS = 5 * 60 * 1000` (5-minute per-session overlap).
  - When `options.mode === 'incremental'` and `options.startTime` is not explicitly provided, query `prisma.conversation.aggregate` (`_max: { lastMessageTime: true }`) for active conversations of `connectionId`. If a watermark exists, set `startTime = Math.max(0, maxLastMessageTimeMs - effectiveOverlapMs)`; if no conversations exist yet, fall back to `Date.now() - LAZADA_DEFAULT_LOOKBACK_MS`.
  - Add `unreadCount: true` to the `existingConversationPreFetch` Prisma `select` clause (currently only selecting `id`, `isActive`, `lastMessageTime`, and `customer.displayName`) so unread count comparisons use live DB values.
  - Before calling `fetchPaginatedSessionMessages` for an existing active conversation in `incremental` mode, evaluate whether the session is unchanged:
    - `existingConversationPreFetch` exists and has `lastMessageTime`,
    - `session.last_message_time` is a valid positive number and `session.last_message_time <= existingConversationPreFetch.lastMessageTime.getTime()`,
    - `existingConversationPreFetch.customer?.displayName` is already populated, and
    - unread count did not increase (`resolvedUnreadCount === undefined || resolvedUnreadCount <= existingConversationPreFetch.unreadCount`).
    - When unchanged, increment `sessionsSkippedUnchanged` and skip calling `fetchPaginatedSessionMessages` (saving N+1 API calls; standalone message recalls without a newer `last_message_time` or increased `unread_count` are intentionally left to live SQS FIFO webhooks or `mode: 'full'` sync).
  - For sessions that DO need message fetching in `incremental` mode and already have `existingConversationPreFetch.lastMessageTime`, pass a tightened `messageStartTime = Math.max(startTime, existingConversationPreFetch.lastMessageTime.getTime() - LAZADA_SESSION_MESSAGE_OVERLAP_MS)` to `fetchPaginatedSessionMessages` instead of scanning the full 30-day lookback.
  - Preserve full backfill behavior (`mode: 'full'` or omitted) for initial OAuth onboarding so historical messages are never prematurely skipped.
- [x] Add unit tests in `test/services/lazadaChatSyncService.test.ts` and/or `test/connectors/lazadaChatSyncService.test.ts`:
  - Test `mode: 'incremental'` computes `startTime` from `prisma.conversation.aggregate` `_max.lastMessageTime` minus overlap.
  - Test unchanged sessions skip `listLazadaImMessages` completely and increment `sessionsSkippedUnchanged`.
  - Test changed sessions (newer `last_message_time`, missing customer `displayName`, or brand-new session) still invoke `listLazadaImMessages` with the tightened per-session `startTime`.
  - Test `mode: 'full'` (default) continues fetching messages without skipping existing sessions.

## Acceptance Criteria

- Criterion 1: Incremental sync derives `startTime` from the connection's latest `Conversation.lastMessageTime` minus safety overlap when no explicit `startTime` is provided.
- Criterion 2: Unchanged sessions do not trigger `/im/message/list` calls during incremental sync, eliminating N+1 API overhead when no new messages arrived.
- Criterion 3: Changed or newly discovered sessions still fetch and ingest all missing messages idempotently under `withDistributedLock` with `mode: 'historical_sync'`.
- Criterion 4: Existing initial OAuth full backfill and manual sync callers remain backward compatible.
- Criterion 5: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and targeted Vitest suites exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/services/lazadaChatSyncService.test.ts test/connectors/lazadaChatSyncService.test.ts
