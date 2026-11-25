# Task: TASK-11 - Direct SQS-to-DB Ingestion and Stale Auto-Reply Guard

- Feature: Lazada Chat Webhook Ingress & Autonomous Bot Safety
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`, `.agents/skills/convention/SKILL.md`
- Scope: backend
- Status: Complete

## Objective

Eliminate double-queuing (`AWS SQS FIFO -> Next.js -> BullMQ -> Next.js -> MySQL`) by having `src/services/lazadaSqsConsumer.ts` invoke `processChatWebhookJob` directly before deleting each SQS message, tune SQS batch size and visibility timeout to safely cover cold-session Lazada API hydration, and guard `src/services/chatIngestionService.ts` against triggering stale autonomous bot replies when draining older backlogged messages after server downtime.

## Technical Context And Dependencies

- Pre-requisites: `TASK-01`, `TASK-05`, `TASK-10` (existing `lazadaSqsConsumer.ts`, `chatQueueWorker.ts`, `chatIngestionService.ts`, and AWS SAM template).
- Reusable Assets:
  - `processChatWebhookJob` in `src/services/chatQueueWorker.ts`
  - `ingestLazadaMessage` and `scheduleBotConversationTurn` in `src/services/chatIngestionService.ts`
  - `withDistributedLock` in `src/lib/redlock.ts`
  - `parseLazadaWebhookBody` in `src/utils`
  - `appLogger` in `src/lib/logger.ts`
- Target Files:
  - `src/services/lazadaSqsConsumer.ts`
  - `src/services/chatIngestionService.ts`
  - `infra/aws-lazada-webhook/template.yaml`
  - `infra/aws-lazada-webhook/README.md`
  - `.env.example`
  - `test/services/lazadaSqsConsumer.test.ts`
  - `test/services/chatQueueWorker.test.ts`

## Checklist

- [x] Replace BullMQ bridge enqueueing with direct DB ingestion in `src/services/lazadaSqsConsumer.ts`:
  - Replace `addChatMessageJob(...)` inside `processLazadaSqsBatch` with a direct call to `processChatWebhookJob(parsedJob.jobData)` from `@/services/chatQueueWorker`.
  - Keep strict intra-session FIFO handling (`failedSessionGroups`): if `processChatWebhookJob` throws (DB error, lock contention, or transient error), retain the SQS message without calling `deleteSqsMessage` and skip subsequent messages for the same `MessageGroupId` / `sessionId` within the batch.
  - Only call `deleteSqsMessage` after `processChatWebhookJob` resolves successfully, and update batch summary metrics (`processedCount` or preserve `enqueuedCount` backward compatibility with clear naming if tests depend on it—prefer keeping type compatibility clean and updating callers/tests).
  - Lower `DEFAULT_LAZADA_SQS_MAX_MESSAGES` from `10` to `5` so a batch containing multiple cold sessions stays comfortably within SQS visibility timeout.
  - Update log messages to reflect direct SQS-to-DB processing rather than bridging to BullMQ.
- [x] Add stale-message auto-reply freshness guard in `src/services/chatIngestionService.ts` and `.env.example`:
  - Add helper `getBotAutoReplyMaxMessageAgeMs()` reading `BOT_AUTOREPLY_MAX_MESSAGE_AGE_MS` with a safe default of `300_000` (5 minutes) and bounds validation.
  - Normalize `payload.send_time` before constructing `incomingTime`: if `payload.send_time` is a positive finite number in epoch seconds (`< 1_000_000_000_000`), multiply by `1000` to convert to milliseconds so second-precision timestamps are not misclassified as stale (1970).
  - Inside `ingestLazadaMessage` (live webhook mode), compute message age `Date.now() - incomingTime.getTime()`. When the message is older than `getBotAutoReplyMaxMessageAgeMs()`, still persist the conversation/message and publish the SSE event normally, but skip `scheduleBotConversationTurn(...)` and log a structured info/warn entry (`Skipping autonomous bot turn for stale backlogged buyer message`).
  - Document `BOT_AUTOREPLY_MAX_MESSAGE_AGE_MS=300000` and updated `LAZADA_SQS_MAX_MESSAGES=5` in `.env.example`.
- [x] Align AWS SQS infrastructure defaults in `infra/aws-lazada-webhook/template.yaml` and `infra/aws-lazada-webhook/README.md`:
  - Update `SqsVisibilityTimeoutSeconds` default from `60` to `90` and update its description to reflect direct DB ingestion and cold-session hydration.
  - Update `infra/aws-lazada-webhook/README.md` step description so it documents direct SQS FIFO -> OmniCart DB ingestion (with BullMQ reserved for delayed bot/sync jobs).
- [x] Update and expand unit tests in `test/services/lazadaSqsConsumer.test.ts` and `test/services/chatQueueWorker.test.ts`:
  - Update `test/services/lazadaSqsConsumer.test.ts` to mock and assert direct calls to `processChatWebhookJob`, verify `DeleteMessageCommand` is NOT sent when `processChatWebhookJob` fails, verify intra-session FIFO halt on failure, and verify default `DEFAULT_LAZADA_SQS_MAX_MESSAGES` is `5`.
  - Add regression tests verifying that buyer messages older than `BOT_AUTOREPLY_MAX_MESSAGE_AGE_MS` are saved to DB and broadcast to SSE without calling `scheduleBotConversationTurn`, while fresh buyer messages (including payloads with 10-digit epoch-second `send_time`) still schedule `bot_turn`.

## Acceptance Criteria

- Criterion 1: `lazadaSqsConsumer.ts` processes `push_message` and `push_session_update` SQS events directly via `processChatWebhookJob` without calling `addChatMessageJob`, and deletes SQS messages only after successful DB processing.
- Criterion 2: Failed DB ingestion or lock contention retains the SQS message for retry/DLQ and halts remaining messages for the same `MessageGroupId` / `sessionId` in the current batch.
- Criterion 3: Buyer messages older than `BOT_AUTOREPLY_MAX_MESSAGE_AGE_MS` (default 5 minutes) are persisted and emitted over SSE, while autonomous bot auto-reply scheduling is skipped.
- Criterion 4: `infra/aws-lazada-webhook/template.yaml` sets `SqsVisibilityTimeoutSeconds` default to `90` and `.env.example` documents `LAZADA_SQS_MAX_MESSAGES=5` and `BOT_AUTOREPLY_MAX_MESSAGE_AGE_MS=300000`.
- Criterion 5: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and targeted Vitest suites exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/services/lazadaSqsConsumer.test.ts test/services/chatQueueWorker.test.ts test/aws/lazadaWebhookLambda.test.ts
