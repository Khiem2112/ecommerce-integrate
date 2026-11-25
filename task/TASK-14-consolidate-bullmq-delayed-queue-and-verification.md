# Task: TASK-14 - Consolidate BullMQ Delayed-Job Queue Partitions and End-to-End Verification

- Feature: Lazada Chat Queue Simplification & Regression Verification
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`, `.agents/skills/convention/SKILL.md`
- Scope: shared
- Status: Complete

## Objective

Reduce unnecessary Redis worker overhead in `src/lib/queue.ts` and `src/services/chatQueueWorker.ts` now that high-volume Lazada webhook ingestion runs directly from AWS SQS FIFO to MySQL (with BullMQ focused on delayed `bot_turn`, `initial_chat_sync`, and `reconcile_chat_sync` jobs). Make BullMQ partition count configurable with a lean default suitable for single-process Next.js operation (deferring standalone worker process extraction to a future task), and run the full Lazada chat regression test suite to confirm all paths compose cleanly.

## Technical Context And Dependencies

- Pre-requisites: `TASK-11`, `TASK-12`, `TASK-13`.
- Reusable Assets:
  - `getChatMessageQueue`, `getSessionPartitionIndex`, `CHAT_QUEUE_PARTITION_COUNT` in `src/lib/queue.ts`
  - `startChatQueueWorker`, `stopChatQueueWorker`, `processChatWebhookJob` in `src/services/chatQueueWorker.ts`
  - `test/services/lazadaSqsConsumer.test.ts`, `test/services/chatQueueWorker.test.ts`, `test/services/lazadaChatSyncService.test.ts`, `test/aws/lazadaWebhookLambda.test.ts`
- Target Files:
  - `src/lib/queue.ts`
  - `src/services/chatQueueWorker.ts`
  - `.env.example`
  - `test/services/chatQueueWorker.test.ts`
  - `test/services/lazadaSqsConsumer.test.ts`

## Checklist

- [x] Make BullMQ partition count configurable with mode-aware defaults in `src/lib/queue.ts` and `src/services/chatQueueWorker.ts`:
  - Add `resolveChatQueuePartitionCount()` reading `CHAT_QUEUE_PARTITION_COUNT` (validated integer bounded between `1` and `8`):
    - When `CHAT_QUEUE_PARTITION_COUNT` is unset or invalid, default to `2` if direct AWS SQS ingestion is active (`LAZADA_SQS_QUEUE_URL` is non-empty and `ENABLE_LAZADA_SQS_CONSUMER?.trim().toLowerCase() !== 'false'`), cutting idle Redis worker connections from `8` to `2` while still allowing parallel `bot_turn` + `reconcile_chat_sync` execution.
    - When AWS SQS consumer is disabled (direct HTTP webhook -> BullMQ mode), default to `8` (`CHAT_QUEUE_PARTITION_COUNT`) so direct webhook throughput and intra-partition ordering are not throttled.
  - Ensure `getChatMessageQueue`, `getChatMessageQueueForPartition`, `cancelPendingBotTurn`, and `startChatQueueWorker` all derive partition count consistently from `resolveChatQueuePartitionCount()`.
  - Keep `CHAT_QUEUE_PARTITION_COUNT = 8` export intact so existing imports and direct-mode callers do not break.
  - Document `CHAT_QUEUE_PARTITION_COUNT` in `.env.example` (including the mode-aware default `2` with SQS vs `8` without SQS, a note to drain/clear legacy `p2..p7` delayed jobs when switching an existing Redis instance down from `8` to `2`, and a note that worker-process separation via `ENABLE_IN_APP_WORKERS=false` remains supported for future standalone deployment).
- [x] Verify end-to-end compatibility across SQS consumer, delayed BullMQ worker, delta sync, and AWS Lambda tests:
  - Add/update unit tests in `test/services/chatQueueWorker.test.ts` covering `resolveChatQueuePartitionCount()` bounds (`1..8`), mode-aware defaults (`2` when `LAZADA_SQS_QUEUE_URL` is enabled vs `8` when SQS is disabled), consistent queue routing for `bot_turn` and `reconcile_chat_sync`, and `cancelPendingBotTurn` lookup against the active partition count.
  - Run all Lazada chat, SQS, Lambda, and sync test suites to confirm zero regressions across the full messaging pipeline.

## Acceptance Criteria

- Criterion 1: `resolveChatQueuePartitionCount()` enforces integer bounds `1..8`, defaults to `2` when AWS SQS direct ingestion is enabled and `8` when running direct BullMQ webhook mode, and is used consistently across queue producers, cancellation helpers, and worker startup.
- Criterion 2: Delayed jobs (`bot_turn`, `initial_chat_sync`, `reconcile_chat_sync`) route, execute, and cancel reliably without depending on webhook traffic passing through BullMQ.
- Criterion 3: `src/instrumentation.ts` continues running both in-app workers cleanly during local/single-server operation (standalone worker process extraction explicitly deferred), and `.env.example` documents `CHAT_QUEUE_PARTITION_COUNT` defaults and migration caveat for `p2..p7`.
- Criterion 4: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and the full Lazada chat Vitest suite exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/services/lazadaSqsConsumer.test.ts test/services/chatQueueWorker.test.ts test/services/lazadaChatSyncService.test.ts test/connectors/lazadaChatSyncService.test.ts test/aws/lazadaWebhookLambda.test.ts
