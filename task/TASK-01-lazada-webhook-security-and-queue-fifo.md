# Task: TASK-01 - Harden Lazada Webhook Verification, Shop Routing, and Per-Session FIFO Queue

- Feature: Lazada IM Webhook Ingestion (`/api/webhooks/marketplace/messages`)
- Governing Spec: `research/lazada/chat api/README.md` (Sections 2.1, 2.2, 2.3), `docs/autonomous-chat-escalation/specs/v1.md`
- Scope: security | backend
- Status: Complete

## Objective

Close webhook signature bypass vulnerabilities by introducing an explicit environment flag (`LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY`) defaulting to strict verification, fix unsafe seller shop ID extraction and query-param connection spoofing, and replace non-FIFO parallel queue processing with deterministic `session_id` hash-partitioned BullMQ shards so events in the same chat session never execute out of order.

## Technical Context And Dependencies

- Pre-requisites: None (foundational ingress and queue task).
- Reusable Assets:
  - `calculateLazadaSignature` in `src/services/connectors/lazada/lazadaSigner.ts`
  - `appLogger` in `src/lib/logger.ts`
  - `getQueueConnectionOptions` / `CHAT_MESSAGE_QUEUE_NAME` in `src/lib/queue.ts`
  - Existing unit tests in `test/api/webhooksMessages.test.ts` and `test/services/chatQueueWorker.test.ts`
- Target Files:
  - `.env.example`
  - `src/app/api/webhooks/marketplace/messages/route.ts`
  - `src/lib/queue.ts`
  - `src/services/chatQueueWorker.ts`
  - `test/api/webhooksMessages.test.ts`
  - `test/services/chatQueueWorker.test.ts`

## Checklist

- [x] Add `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY=false` and optional `LAZADA_CHAT_APP_KEY` / `LAZADA_CHAT_APP_SECRET` documentation to `.env.example`.
- [x] Implement a dedicated helper `shouldSkipWebhookSignatureVerify()` in `src/app/api/webhooks/marketplace/messages/route.ts` that returns `true` ONLY when `process.env.LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY === 'true'`.
- [x] Update `verifyLazadaWebhookSignature` in `src/app/api/webhooks/marketplace/messages/route.ts`:
  - Remove implicit `if (!appSecret) return true` and implicit `if (process.env.NODE_ENV !== 'production') return true` bypasses.
  - Check `LAZADA_CHAT_APP_KEY` / `LAZADA_CHAT_APP_SECRET` first with fallback to `LAZADA_APP_KEY` / `LAZADA_APP_SECRET`.
  - Allow bypass only when `shouldSkipWebhookSignatureVerify()` is `true`, logging a clear warning (`appLogger.warn`).
  - Use timing-safe comparison (`crypto.timingSafeEqual`) when validating hex signatures of equal length.
- [x] Move signature validation in `POST` BEFORE the `!sessionId` probe check so unauthenticated `POST` requests without `session_id` are rejected with HTTP 401 in strict mode (unless `shouldSkipWebhookSignatureVerify()` is `true`). Keep unauthenticated `GET` health check explicit or guarded cleanly.
- [x] Fix `extractSellerShopId` in `src/app/api/webhooks/marketplace/messages/route.ts`:
  - Check `body.seller_id`, `eventData.seller_id`, `from_account_type === 2 && from_account_id`, `to_account_type === 2 && to_account_id`, `user_account_type === 2 && user_account_id`, then parse `session_id.split('_')[0]` (`{seller_id}_2_{buyer_id}_1_{app_id}`).
  - Remove the unsafe bare `if (eventData.to_account_id)` check that could mistake a buyer ID for a seller ID.
- [x] Restrict `?connectionId=` query override and dev fallback:
  - Only forward `connectionId` query param from `route.ts` when `shouldSkipWebhookSignatureVerify()` is `true` (otherwise resolve strictly via `externalShopId` against `platformConnection.externalShopId` so external callers cannot target arbitrary tenant `connectionId`s).
  - In `resolveConnectionIdAsync` (`src/services/chatQueueWorker.ts`), remove the silent fallback to the first active `platformId: 1` connection unless `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY === 'true'`, and match explicitly against active Lazada connections (`platform.code === 'lazada'`).
- [x] Implement deterministic per-`session_id` hash-partitioned BullMQ queues and workers:
  - Partition `chat-message-queue` into `N` deterministic shards (e.g., `CHAT_QUEUE_PARTITION_COUNT = 8`, named `chat-message-queue-p0`..`p7`) hashed deterministically from `sessionId` in `src/lib/queue.ts`.
  - Run a dedicated BullMQ `Worker` with `concurrency: 1` per partition inside `startChatQueueWorker()` (and close all partition workers in `stopChatQueueWorker()`) in `src/services/chatQueueWorker.ts` so messages with the same `session_id` strictly preserve FIFO ordering while different sessions execute in parallel across partitions.
  - Fix `push_session_update` job deduplication in `addChatMessageJob`: use `last_message_id` / `to_position` / `self_position` / `unread_count` when available instead of fragile `Date.now()`-only collisions.
- [x] Update `test/api/webhooksMessages.test.ts` and `test/services/chatQueueWorker.test.ts` to verify strict rejection (`401`) when `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY` is unset/false, controlled bypass when set to `'true'`, `!sessionId` post-auth behavior, `extractSellerShopId` buyer/seller edge cases, and consistent shard routing by `session_id`.

## Acceptance Criteria

- Criterion 1: Sending an unsigned or invalidly signed `POST /api/webhooks/marketplace/messages` request (including a payload missing `session_id` or missing `LAZADA_APP_SECRET`) returns HTTP 401 when `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY` is unset or `'false'`, in both development and production.
- Criterion 2: Setting `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY=true` allows local/sandbox webhook testing without valid HMAC headers while logging a warning and ignoring nothing unexpectedly.
- Criterion 3: Given a Lazada `session_id` formatted as `{seller_id}_2_{buyer_id}_1_{app_id}`, `extractSellerShopId` never extracts `buyer_id`, and strict mode ignores spoofed `?connectionId=` query parameters.
- Criterion 4: Two or more webhook events for the same `session_id` always land on the same BullMQ partition (`concurrency: 1`) and execute strictly in enqueue order.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/api/webhooksMessages.test.ts test/services/chatQueueWorker.test.ts

