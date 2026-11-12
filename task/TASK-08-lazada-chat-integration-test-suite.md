# Task: TASK-08 - Build End-to-End Integration Test Suite for All Four Lazada Chat Flows

- Feature: Automated Verification Across All Lazada IM Flows
- Governing Spec: `research/lazada/chat api/README.md`, `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/skills/task-runner/SKILL.md`
- Scope: shared
- Status: Complete

## Objective

Establish a cohesive Vitest integration and unit test suite covering all four fixed Lazada IM flows end-to-end (Webhook ingress & security toggle, Outbound manual/AI/bot replies, ASC Admin sync & history recovery, and Cold session creation & multi-tenant SSE isolation), add a standard `test` script in `package.json`, and validate the entire repository test/lint/type/i18n baseline passes cleanly.

## Technical Context And Dependencies

- Pre-requisites: Completion of `TASK-01` through `TASK-07`.
- Reusable Assets:
  - `vitest.config.ts` (`include: ['test/**/*.test.ts']`)
  - Existing chat tests under `test/api/`, `test/connectors/`, `test/services/`, `test/actions/`, `test/hooks/`, `test/integration/`
- Target Files:
  - `package.json`
  - `test/connectors/lazadaImService.test.ts` (new)
  - `test/connectors/lazadaChatSyncService.test.ts` (new)
  - `test/actions/conversationActions.test.ts` (new)
  - `test/integration/lazadaFourFlowsEndToEnd.test.ts` (new)

## Checklist

- [x] Add `"test": "vitest run"` to `scripts` in `package.json` (and review `.gitignore` rule for `test/` with project policy if tests are intended for git tracking — keep existing `.gitignore` behavior documented unless tracking is requested).
- [x] Create `test/connectors/lazadaImService.test.ts` covering:
  - Reading camelCase `accessToken` + triggering `refreshShopTokenIfNeededService` before IM requests
  - Handling `LazadaClient.post` unwrapped `json.data` return on `/im/message/send` and propagating real errors instead of dev fake success
  - Enforcing `last_read_message_id` in `markLazadaSessionRead`
  - `/im/session/get`, `/im/session/list`, `/im/message/list`, `/im/session/open`, `/im/message/recall` parameter formatting (`page_size <= 20`)
  - 5-day last-buyer-reply / 7-day order window and 5-message/24h anti-spam quota rules.
- [x] Create `test/connectors/lazadaChatSyncService.test.ts` covering:
  - Cursor pagination (`next_start_time`, `last_session_id`, `last_message_id`) across multiple pages
  - Idempotent ingestion with duplicate `platformMessageId` skipping
  - One-off delayed job scheduling without polling intervals and Redis cooldown guard on manual sync.
- [x] Create `test/actions/conversationActions.test.ts` covering:
  - Organization scoping on `fetchInboxAction` and `fetchConversationAction`
  - `sendMessageAction` and `saveAiResponseAction` delivering to Lazada via `sendLazadaImMessage` and handling `FAILED` state safely without falsely marking drafts `applied`.
- [x] Create `test/integration/lazadaFourFlowsEndToEnd.test.ts` verifying full scenario chains across mocked DB/Redis/Fetch layers:
  - Flow 1: Signed webhook vs `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY` toggle -> FIFO shard queueing -> DB persistence
  - Flow 2: Rapid buyer burst debounce -> single RAG grounded reply sent via `/im/message/send`; operator manual reply & AI draft send
  - Flow 3: ASC admin reply (`unreadCount` reset to 0, real human takeover) vs `auto_reply: true` / `type: 2` (no takeover) + message recall SSE emission
  - Flow 4: Brand-new buyer cold session -> `Customer.upsert` + `/im/session/get` displayName + cold SSE invalidation + strict cross-org isolation.
- [x] Run verification suite: `npx tsc --noEmit` (exit 0), `yarn test` (30/30 files, 281/281 tests passed, exit 0), `yarn i18n:check --only parity` (1651/1651 keys, exit 0), and targeted `eslint --no-ignore` on TASK-08 files (exit 0); pre-existing unrelated `scratch/`/`src/` baseline errors remain outside TASK-08 scope in full `yarn lint` and `yarn i18n:check`.

## Acceptance Criteria

- Criterion 1: `yarn test` runs Vitest cleanly across all existing and new `.test.ts` files with 0 failures and 0 skipped critical assertions.
- Criterion 2: All four Lazada chat flows and multi-tenancy/webhook authentication guards have explicit automated regression tests.
- Criterion 3: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and `yarn test` all exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: yarn test

