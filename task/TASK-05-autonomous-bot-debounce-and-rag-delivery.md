# Task: TASK-05 - Connect Autonomous Bot Debounce Queue, Multi-Layer RAG Pipeline, and Lazada Delivery

- Feature: Autonomous AI Auto-Reply & Debounce Engine
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `docs/autonomous-chat-escalation/flows/v1.md`, `research/lazada/chat api/README.md` (Section 3.3), `.agents/rules/RULE.md`
- Scope: backend
- Status: Complete

## Objective

Bridge the broken autonomous bot pipeline end-to-end: replace the unconsumed Redis debounce key in `chatQueueWorker.ts` with a real BullMQ delayed job trigger (`3-5s` debounce window), upgrade `processAgentConversationTurn` (`src/services/agentSessionManager.ts`) from hardcoded `FactCatalog` keyword matching to `generateGroundedResponse` (`src/services/rag/index.ts`), and actually send approved auto-replies to Lazada via `sendLazadaImMessage` (persisting `SENDING -> SENT / FAILED` and escalating on tool error or low grounding).

## Technical Context And Dependencies

- Pre-requisites: `TASK-01` (BullMQ queue infra), `TASK-02` (`sendLazadaImMessage`, 5-day / 7-day / 5-msg/24h quota helpers), `TASK-03` (`handlePushMessage` buyer/seller separation).
- Reusable Assets:
  - `generateGroundedResponse` in `src/services/rag/index.ts`
  - `evaluateAutonomousGrounding` in `src/services/rag/groundingValidator.ts`
  - `createEscalationAuditLog` in `src/services/escalationService.ts`
  - `sendLazadaImMessage` in `src/services/connectors/lazada/lazadaImService.ts`
  - `withDistributedLock` in `src/lib/redlock.ts`
  - Existing tests in `test/services/agentSessionManager.test.ts` and `test/integration/chatEscalation.test.ts`
- Target Files:
  - `.env.example`
  - `src/lib/queue.ts`
  - `src/services/chatQueueWorker.ts`
  - `src/services/agentSessionManager.ts`
  - `src/services/agentSessionService.ts`
  - `test/services/agentSessionManager.test.ts`
  - `test/integration/chatEscalation.test.ts`

## Checklist

- [x] Add a BullMQ delayed bot-turn scheduling mechanism in `src/lib/queue.ts` and `src/services/chatQueueWorker.ts`:
  - Add configurable `BOT_DEBOUNCE_MS=3000` in `.env.example` (defaulting to `3000`ms).
  - Add queue helpers (e.g., `scheduleBotConversationTurn(conversationId, sessionId, triggerMessageId, delayMs)` and `cancelPendingBotTurn(sessionId)`) that store the latest `triggerMessageId` in Redis (`session:${sessionId}:debounce`) AND enqueue a BullMQ delayed job (`delay: BOT_DEBOUNCE_MS`).
  - When `handlePushMessage` finishes ingesting a normal incoming buyer message (`from_account_type === 1 && payload.status !== 1`) on an eligible conversation (`open` or `awaiting_reply`, not `in_progress`, not `escalated`, not `closed`, not `humanApprovalRequired`), schedule the delayed bot turn.
  - When a human seller replies (`from_account_type === 2 && !auto_reply && type !== 2`) or clicks `takeoverConversationSession`, delete `session:${sessionId}:debounce` and clean up waiting delayed jobs so pending bot replies abort silently.
- [x] Process scheduled bot jobs inside `startChatQueueWorker` (`src/services/chatQueueWorker.ts`) by verifying inside `withDistributedLock` (`conversation:${conversationId}` / `session:${sessionId}`):
  - Confirm `session:${sessionId}:debounce` still exists and matches `triggerMessageId` (skip if superseded by a newer rapid buyer message or cancelled by operator takeover).
  - Delegate execution to `processAgentConversationTurn(conversationId)`.
- [x] Replace `generateCoPilotDraft` hardcoded keyword matcher in `src/services/agentSessionManager.ts` with real RAG orchestration:
  - Call `generateGroundedResponse(conversationId)` from `src/services/rag/index.ts` (falling back safely to escalation with trigger `'tool_error'` if all LLM providers throw or fail schema validation).
  - Select the top/recommended strategy from `result.response.strategies` and evaluate it through `evaluateAutonomousGrounding` (checking VIP negative sentiment, complaint patterns, minimum confidence threshold `>= 0.90`, non-empty grounded fact citations, and zero ungrounded/PII violations).
- [x] Enforce Lazada platform rules inside `processAgentConversationTurn`:
  - Verify `conversation.status.code` is NOT `in_progress`, `escalated`, `resolved`, or `closed` and `humanApprovalRequired` is `false`.
  - Verify session validity (last buyer message `<= 5 days`, or recent order fallback) and Lazada's 24-hour anti-spam rule: count consecutive seller/bot messages sent since the latest buyer reply **within the last 24 hours** (instead of un-windowed `take: 10`), escalating if count `>= 5`.
- [x] Deliver bot replies to Lazada before marking `SENT` (outside long DB transactions):
  - Persist `Message` record with `status: 'SENDING'`, `groundedFacts`, `confidence`, and `suggestedAction: 'auto_reply'` (plus `connectionId` and resolved `senderTypeId`).
  - If `conversation.platformSessionId` is present, call `sendLazadaImMessage(conversation.connectionId, conversation.platformSessionId, replyText)`.
  - On Lazada success: update `Message` to `status: 'SENT'` with real `platformMessageId`, update `conversation.statusId` -> `awaiting_reply` and `conversation.lastMessageTime`, and publish `chat:bot_replied` SSE event with `organizationId`.
  - On Lazada error: update `Message` to `status: 'FAILED'`, invoke `createEscalationAuditLog` with `triggerSource: 'tool_error'`, publish `chat:session_escalated` SSE event, and return `actionTaken: 'escalated'`.
- [x] Update `test/services/agentSessionManager.test.ts` and `test/integration/chatEscalation.test.ts` to test debounce coalescence (only the latest burst message triggers 1 bot reply), human takeover aborting pending delayed bot turn, RAG grounding -> Lazada `/im/message/send` delivery (`SENT`), and Lazada send failure escalating cleanly as `tool_error`.

## Acceptance Criteria

- Criterion 1: Rapidly sending 3 buyer messages within `3000ms` stores all 3 messages in FIFO order and triggers `processAgentConversationTurn` strictly once after the quiet debounce window on the latest message.
- Criterion 2: If an operator replies on Lazada Seller Center or clicks Takeover within the 3-second debounce window, the delayed bot job aborts without sending a duplicate reply or changing status back from `in_progress`.
- Criterion 3: `processAgentConversationTurn` uses `generateGroundedResponse`, sends the reply via `sendLazadaImMessage`, records `platformMessageId` with `status: 'SENT'`, and triggers `tool_error` escalation if Lazada rejects.
- Criterion 4: Auto-reply pauses and escalates when consecutive replies without a buyer response in the past 24 hours reach 5, or when grounding fails / VIP negative sentiment is detected.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/services/agentSessionManager.test.ts test/integration/chatEscalation.test.ts

