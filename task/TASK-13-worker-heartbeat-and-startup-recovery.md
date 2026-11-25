# Task: TASK-13 - Worker Heartbeat Downtime Detection and Startup Recovery Orchestration

- Feature: Lazada Chat Downtime Recovery & Single Ingress Guard
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`, `.agents/skills/convention/SKILL.md`
- Scope: backend
- Status: Complete

## Objective

Implement lightweight worker heartbeat tracking and startup downtime-threshold orchestration so that when the server restarts after downtime, it automatically follows the three recovery regimes: short downtime (`< 30 minutes`) drains SQS only; medium downtime (`30 minutes` to `< 12 days`) drains SQS until empty and then schedules a one-shot incremental delta reconciliation for active Lazada connections; long downtime (`>= 12 days`, approaching the 14-day SQS FIFO retention limit) immediately triggers API reconciliation without waiting for expired SQS messages. Also add an explicit env guard on the direct HTTP webhook route so production deployments using AWS SQS maintain a single authoritative ingress path.

## Technical Context And Dependencies

- Pre-requisites: `TASK-11` (direct SQS ingestion) and `TASK-12` (incremental delta reconciliation `mode: 'incremental'`).
- Reusable Assets:
  - `redis` in `src/lib/redis.ts`
  - `syncLazadaChatHistoryForConnection` and `LAZADA_INCREMENTAL_SYNC_OVERLAP_MS` in `src/services/connectors/lazada/lazadaChatSyncService.ts`
  - `scheduleInitialChatHistorySync` / BullMQ delayed job helpers in `src/lib/queue.ts`
  - `startLazadaSqsConsumer` / `pollLazadaSqsOnce` in `src/services/lazadaSqsConsumer.ts`
  - `prisma.platformConnection` and `prisma.conversation` in `src/lib/prisma.ts`
  - `appLogger` in `src/lib/logger.ts`
- Target Files:
  - `src/lib/queue.ts`
  - `src/services/chatQueueWorker.ts`
  - `src/services/lazadaSqsConsumer.ts`
  - `src/app/api/webhooks/marketplace/messages/route.ts`
  - `.env.example`
  - `test/services/lazadaSqsConsumer.test.ts`
  - `test/services/chatQueueWorker.test.ts`
  - `test/api/webhooksMessages.test.ts`

## Checklist

- [x] Add `reconcile_chat_sync` job support in `src/lib/queue.ts` and `src/services/chatQueueWorker.ts`:
  - Add `ChatReconcileSyncJobData` (`eventType: 'reconcile_chat_sync'`, `connectionId`, `platform: 'lazada'`, `syncMode: 'incremental' | 'full'`, `reason: 'startup_downtime' | 'sqs_retention_exceeded' | 'periodic'`, `sinceTimestampMs?: number`, `requestedAt`) to `ChatWebhookJobData`.
  - Add `scheduleLazadaChatReconciliation(connectionId, options)` accepting `{ syncMode, reason, sinceTimestampMs?, delayMs? }` and using a deterministic deduplication `jobId` (without colons for BullMQ 6.7.2 compatibility) so rapid restarts do not enqueue duplicate sync storms.
  - Handle `jobData.eventType === 'reconcile_chat_sync'` in `processChatWebhookJob` by calling `syncLazadaChatHistoryForConnection(jobData.connectionId, { mode: jobData.syncMode, ...(jobData.sinceTimestampMs !== undefined ? { startTime: jobData.sinceTimestampMs } : {}) })`.
- [x] Implement heartbeat tracking and startup downtime decision logic in `src/services/lazadaSqsConsumer.ts`:
  - Define Redis heartbeat key `worker:lazada:sqs:heartbeat` and configurable thresholds:
    - `LAZADA_RECOVERY_MIN_DOWNTIME_MS` (default `1_800_000` = 30 minutes)
    - `LAZADA_RECOVERY_SQS_RETENTION_GUARD_MS` (default `12 * 24 * 60 * 60 * 1000` = 12 days)
    - `LAZADA_HEARTBEAT_INTERVAL_MS` (default `60_000` = 60 seconds)
  - Add pure helper `classifyStartupDowntimeRecovery(lastHeartbeatMs, nowMs, config)` returning `'sqs_only' | 'drain_then_incremental_sync' | 'immediate_full_sync'`.
  - On `startLazadaSqsConsumer`:
    - Resolve `lastHeartbeatMs` by reading `worker:lazada:sqs:heartbeat` from Redis first. If the Redis key is missing or Redis read fails (e.g., Redis restarted without persistence alongside the app server), fall back to querying `prisma.conversation.aggregate` (`_max: { lastMessageTime: true }`) across active Lazada connections so downtime is still detected. Only treat as first boot (`'sqs_only'`) when neither Redis heartbeat nor any existing active Lazada conversation watermark exists (or if both lookups fail gracefully).
    - Capture `recoverySinceMs = Math.max(0, lastHeartbeatMs - LAZADA_INCREMENTAL_SYNC_OVERLAP_MS)` before refreshing the heartbeat so subsequent SQS ingestion cannot advance the sync watermark past the actual downtime window.
    - If classified as `'immediate_full_sync'` (`downtime >= 12 days`), enqueue `reconcile_chat_sync` (`syncMode: 'full'`, `reason: 'sqs_retention_exceeded'`) for all active Lazada `PlatformConnection` records right away.
    - If classified as `'drain_then_incremental_sync'` (`30 minutes <= downtime < 12 days`), store a one-shot pending recovery state holding `recoverySinceMs`; once the consumer observes the first empty SQS poll (`receivedCount === 0`), enqueue `reconcile_chat_sync` (`syncMode: 'incremental'`, `reason: 'startup_downtime'`, `sinceTimestampMs: recoverySinceMs`) for all active Lazada connections and clear the pending state.
    - Periodically refresh `worker:lazada:sqs:heartbeat` (and update it on clean `stopLazadaSqsConsumer`) while clearing timers properly on shutdown to avoid leaks.
- [x] Add single-ingress guard option to `src/app/api/webhooks/marketplace/messages/route.ts` and document env vars in `.env.example`:
  - Support `ENABLE_DIRECT_LAZADA_WEBHOOK_ROUTE` (when explicitly set to `'false'`, return HTTP `410` or `503` JSON response indicating webhooks must arrive via the AWS SQS ingress gateway; default enabled when unset to preserve existing local/direct setups and tests).
  - Document `LAZADA_RECOVERY_MIN_DOWNTIME_MS`, `LAZADA_RECOVERY_SQS_RETENTION_GUARD_MS`, `LAZADA_HEARTBEAT_INTERVAL_MS`, and `ENABLE_DIRECT_LAZADA_WEBHOOK_ROUTE` in `.env.example`.
- [x] Add unit tests in `test/services/lazadaSqsConsumer.test.ts` and `test/services/chatQueueWorker.test.ts`:
  - Test `classifyStartupDowntimeRecovery` across all three downtime regimes (`< 30m`, `30m..12d`, `>= 12d`) and missing heartbeat.
  - Test missing Redis heartbeat falls back to DB `MAX(Conversation.lastMessageTime)` to classify downtime accurately, while empty DB + missing Redis heartbeat falls back to `'sqs_only'`.
  - Test `drain_then_incremental_sync` waits until `pollLazadaSqsOnce` returns `receivedCount === 0` before scheduling incremental reconciliation once with `sinceTimestampMs` derived from the pre-drain `lastHeartbeatMs` (not post-drain DB max), and does not re-trigger on subsequent empty polls.
  - Test `reconcile_chat_sync` forwards `sinceTimestampMs` as `startTime` to `syncLazadaChatHistoryForConnection` inside `processChatWebhookJob`.
  - Test Redis failure during heartbeat read/write never crashes the SQS polling loop.

## Acceptance Criteria

- Criterion 1: Short restarts (`< 30 minutes`) drain SQS without triggering Lazada REST API reconciliation calls.
- Criterion 2: Medium downtime (`30 minutes` to `< 12 days`) drains SQS first and schedules exactly one `incremental` delta reconciliation per active Lazada connection once the SQS queue reports empty, anchored to the pre-drain `lastHeartbeatMs` minus safety overlap (`sinceTimestampMs`).
- Criterion 3: Long downtime (`>= 12 days`) immediately schedules API reconciliation for active Lazada connections without waiting for expired SQS messages.
- Criterion 4: Missing Redis heartbeat falls back to active Lazada `Conversation.lastMessageTime` max in MySQL before defaulting to first-boot `'sqs_only'`, and heartbeat read/write failures degrade gracefully with timer handles cleaned up on `stopLazadaSqsConsumer()`.
- Criterion 5: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and targeted Vitest suites exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/services/lazadaSqsConsumer.test.ts test/services/chatQueueWorker.test.ts test/api/webhooksMessages.test.ts
