# Lazada Chat Integration Remediation Tasks

This directory contains sequential tasks generated from the technical audit of Lazada IM webhook ingestion, outbound messaging, Lazada Seller Center (ASC) admin synchronization, cold session initialization, and multi-tenant workspace isolation.

All tasks follow `.agents/skills/task-runner/templates/task.md` and can be executed sequentially via `.agents/skills/task-runner/scripts/run_tasks.ps1`.

## Task Sequence

1. `TASK-01-lazada-webhook-security-and-queue-fifo.md`
   - Scope: `security`, `backend`
   - Summary: Add `LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY` toggle (fail-closed by default), close `!sessionId` pre-auth probe bypass, harden `extractSellerShopId` and `resolveConnectionIdAsync`, and partition BullMQ chat queue by `session_id` hash for strict FIFO ordering.
2. `TASK-02-lazada-im-client-and-api-coverage.md`
   - Scope: `backend`
   - Summary: Fix `lazadaImService.ts` camelCase token lookup with auto-refresh via `shopCredentialService.ts`, fix `LazadaClient.post` unwrapped `json.data` handling, remove silent fake-success fallback, add `last_read_message_id` to `/im/session/read`, implement `/im/session/get`, `/im/session/list`, `/im/message/list`, `/im/session/open`, `/im/message/recall`, and add session aging (5-day / 7-day order) + 5-msg/24h quota helpers.
3. `TASK-03-cold-session-templates-and-admin-sync.md`
   - Scope: `database`, `backend`
   - Summary: Add optional `displayName` and `avatarUrl` on `Customer` for buyer profile hydration, parse rich Lazada `template_id` payloads into `MessageType`/`mediaUrl`/`referenceId`, atomically upsert `Customer` + hydrate via `/im/session/get` on cold sessions, fix ASC admin `unreadCount` corruption, prevent false takeover on `auto_reply: true` / `type: 2`, and broadcast SSE on message recall and session updates.
4. `TASK-04-outbound-message-delivery-unification.md`
   - Scope: `backend`, `frontend`
   - Summary: Route manual composer (`MessageInput` -> `sendMessageAction`) and AI draft approval (`AiResponsePreview` -> `saveAiResponseAction`) through verified Lazada delivery (`sendLazadaImMessage`) outside long DB transactions, track `SENDING -> SENT / FAILED` states, mark Lazada session read with `last_read_message_id` when opening unread threads, fix 5-day expiry calculation based on last buyer reply, and update UI/i18n feedback.
5. `TASK-05-autonomous-bot-debounce-and-rag-delivery.md`
   - Scope: `backend`
   - Summary: Replace dead Redis debounce key with BullMQ delayed trigger jobs, upgrade `processAgentConversationTurn` from hardcoded keyword matching to `generateGroundedResponse`, cancel pending bot turns on human takeover, enforce 5-msg/24h quota and 5-day/7-day validity, and send auto-replies to Lazada before marking `SENT` (or escalate `tool_error` on failure).
6. `TASK-06-initial-chat-history-sync-and-recovery.md`
   - Scope: `backend`, `frontend`
   - Summary: Implement cursor-paginated `/im/session/list` + `/im/message/list` backfill service (`lazadaChatSyncService.ts`), schedule one-time 15-minute delayed sync after Lazada OAuth completion (`completeShopAuthorizationService`), and provide a rate-limited on-demand recovery Server Action for webhook downtime without periodic polling.
7. `TASK-07-sse-auth-multitenancy-and-ui-sync.md`
   - Scope: `security`, `backend`, `frontend`
   - Summary: Require authenticated session + active `organizationId` in `/api/chat/stream` and scope all inbox/conversation/RAG queries and broadcasts strictly by organization, stop setting `humanApprovalRequired: true` on `chat:operator_takeover`, fix `AgentSessionList` tab priority (`in_progress` before `escalated`), fix `useAgentSession` cold session cache invalidation + `seller` sender display, and render rich message templates, buyer display names, and unread badges.
8. `TASK-08-lazada-chat-integration-test-suite.md`
   - Scope: `shared`
   - Summary: Add `"test": "vitest run"` script to `package.json`, ensure comprehensive Vitest coverage across all four Lazada IM flows and multi-tenant security boundaries, and verify full green check suite.

## Suggested Execution Command

```powershell
.\.agents\skills\task-runner\scripts\run_tasks.ps1 -TaskFiles `
  task/TASK-01-lazada-webhook-security-and-queue-fifo.md, `
  task/TASK-02-lazada-im-client-and-api-coverage.md, `
  task/TASK-03-cold-session-templates-and-admin-sync.md, `
  task/TASK-04-outbound-message-delivery-unification.md, `
  task/TASK-05-autonomous-bot-debounce-and-rag-delivery.md, `
  task/TASK-06-initial-chat-history-sync-and-recovery.md, `
  task/TASK-07-sse-auth-multitenancy-and-ui-sync.md, `
  task/TASK-08-lazada-chat-integration-test-suite.md
```

