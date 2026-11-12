# Task: TASK-06 - Implement Initial Chat History Backfill and Webhook Downtime Recovery Sync

- Feature: Lazada IM History Initialization & Recovery (`/im/session/list`, `/im/message/list`)
- Governing Spec: `research/lazada/chat api/README.md` (Sections 1, 4.1, 4.2, 6), `.agents/skills/business-logic/features/shop_platform_integration.md`
- Scope: backend | frontend
- Status: Complete

## Objective

Implement the missing `/im/session/list` and `/im/message/list` backfill workflow to synchronize pre-OAuth conversations (scheduled once after Lazada's 10-15 minute authorization preparation delay) and recover missed messages/admin replies after server or webhook outages — strictly without introducing prohibited periodic polling loops.

## Technical Context And Dependencies

- Pre-requisites: `TASK-02` (`listLazadaImSessions`, `listLazadaImMessages`, `getLazadaImSession`), `TASK-03` (shared template parser, atomic `Customer.upsert`, `unreadCount` rules).
- Reusable Assets:
  - `listLazadaImSessions`, `listLazadaImMessages`, `getLazadaImSession` in `src/services/connectors/lazada/lazadaImService.ts`
  - Shared message/template normalization & customer upsert helpers refactored from `src/services/chatQueueWorker.ts`
  - `completeShopAuthorizationService` in `src/services/shopAuthorizationService.ts`
  - `getAuthenticatedSessionContextService` in `src/services/authentication/authSessionService.ts`
  - `canActorManageConnections` / shop permissions in `src/services/shopConnectionPermissionService.ts`
- Target Files:
  - `.env.example`
  - `src/services/connectors/lazada/lazadaChatSyncService.ts` (new)
  - `src/lib/queue.ts`
  - `src/services/chatQueueWorker.ts`
  - `src/services/shopAuthorizationService.ts`
  - `src/actions/conversationActions.ts`
  - `src/messages/en.json`
  - `src/messages/vi.json`

## Checklist

- [x] Extract shared idempotent ingestion helpers (template content parser, atomic `Customer.upsert`, `Conversation` upsert, monotonic `lastMessageTime`, duplicate `platformMessageId` check) from `src/services/chatQueueWorker.ts` into a reusable module or export so `chatQueueWorker.ts` and `lazadaChatSyncService.ts` share one code path (`reuse-first`).
- [x] Create `src/services/connectors/lazada/lazadaChatSyncService.ts`:
  - `syncLazadaChatHistoryForConnection(connectionId, options?)` implementing cursor-based pagination over `listLazadaImSessions` (`page_size = 20`, bounded safety cap up to Lazada's 3000-conversation / 1-month limit) and `listLazadaImMessages` (`page_size = 20`) per session.
  - Enrich buyer `displayName` / `avatarUrl` via `getLazadaImSession` when missing on `Customer`.
  - Respect Lazada seller status/unread rules: set `unreadCount` accurately from Lazada session metadata, ingest historical `from_account_type = 2` messages WITHOUT triggering false live `chat:operator_takeover` SSE spam or bot auto-replies for old messages!
  - Publish a single summary SSE `chat:session_updated` notification when sync finishes so open UI lists refresh cleanly.
- [x] Add one-time delayed OAuth initial sync scheduling (zero polling):
  - Document `LAZADA_INITIAL_CHAT_SYNC_DELAY_MS=900000` (15 minutes) in `.env.example`.
  - Add `scheduleInitialChatHistorySync(connectionId, delayMs)` in `src/lib/queue.ts` with deterministic colon-free `jobId` deduplication (`chat-initial-sync_${connectionId}`) and handle it inside `startChatQueueWorker()`.
  - Trigger `scheduleInitialChatHistorySync` (non-blocking / fire-and-forget safe queue call outside DB transaction) after `completeShopAuthorizationService` successfully establishes a Lazada connection in `src/services/shopAuthorizationService.ts`.
- [x] Add an operator-triggered recovery Server Action `syncShopChatHistoryAction(connectionId)` in `src/actions/conversationActions.ts`:
  - Authenticate via `getAuthenticatedSessionContextService()` and verify `connectionId` belongs to the caller's active organization and actor has permission.
  - Enforce a Redis cooldown lock (e.g., `cooldown:chat-history-sync:${connectionId}`, minimum 5-minute cooldown between manual backfills per shop) to prevent accidental abuse resembling Lazada-prohibited polling.
- [x] Add i18n keys in `src/messages/en.json` and `src/messages/vi.json` for manual history sync errors/cooldown feedback with 100% parity (and expose a manual sync trigger in Workspace / Shop detail if helpful, keeping UI minimal and consistent).

## Acceptance Criteria

- Criterion 1: Completing Lazada OAuth authorization schedules exactly one delayed backfill job (~15 minutes later by default) and NEVER schedules recurring intervals or polling loops.
- Criterion 2: `syncLazadaChatHistoryForConnection` cursor-paginates `/im/session/list` and `/im/message/list`, idempotently backfills missed messages/sessions without duplicating existing `(connectionId, platformMessageId)` records, and does not auto-reply to historical messages.
- Criterion 3: Operators can invoke `syncShopChatHistoryAction` after webhook downtime, constrained by active-organization ownership and a Redis per-shop cooldown guard.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/services/chatQueueWorker.test.ts

