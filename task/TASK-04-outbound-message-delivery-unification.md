# Task: TASK-04 - Unify Outbound Message Delivery, AI Co-Pilot Send, Read Receipts, and 5-Day Window Check

- Feature: Application Outbound Reply Flow & Two-Way Read Sync (`/conversations`)
- Governing Spec: `research/lazada/chat api/README.md` (Sections 1, 3, 4.1, 4.2, 6), `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`
- Scope: backend | frontend
- Status: Complete

## Objective

Eliminate the disconnected internal-only reply paths by routing both manual operator messages (`MessageInput` -> `sendMessageAction`) and approved AI Co-Pilot drafts (`AiResponsePreview` -> `saveAiResponseAction`) through verified Lazada delivery (`sendLazadaImMessage`) outside long DB transactions, enforcing Lazada's 5-day last-buyer-reply / 7-day order window and 5-message/24h anti-spam quota, exposing clear UI failures without discarding typed messages, and marking Lazada sessions read with `last_read_message_id` when operators open unread threads.

## Technical Context And Dependencies

- Pre-requisites: `TASK-02` (`sendLazadaImMessage`, `markLazadaSessionRead`, `openLazadaImSession`, validity/quota helpers), `TASK-03` (`messageType`/rich SSE events).
- Reusable Assets:
  - `sendOperatorMessage` in `src/services/agentSessionService.ts`
  - `applyAiDraftService` in `src/services/aiDraftService.ts`
  - `sendLazadaImMessage`, `markLazadaSessionRead`, `openLazadaImSession` in `src/services/connectors/lazada/lazadaImService.ts`
  - `getAuthenticatedSessionContextService` in `src/services/authentication/authSessionService.ts`
  - `ErrorBanner` in `src/components/molecules/ErrorBanner.tsx`
- Target Files:
  - `src/services/agentSessionService.ts`
  - `src/services/aiDraftService.ts`
  - `src/actions/conversationActions.ts`
  - `src/actions/agentSessionActions.ts`
  - `src/components/molecules/chat/MessageInput.tsx`
  - `src/components/organisms/copilot/AiResponsePreview.tsx`
  - `src/components/organisms/chat/ChatPanel.tsx`
  - `src/components/organisms/workspace/AgentWorkspace.tsx`
  - `src/messages/en.json`
  - `src/messages/vi.json`
  - `test/actions/agentSessionActions.test.ts`

## Checklist

- [x] Extract / harden a unified outbound delivery helper in `src/services/agentSessionService.ts` ensuring **no external HTTP calls execute inside `prisma.$transaction`** (`.agents/skills/backend-data-safety/SKILL.md`):
  - Phase 1 (short DB read/write): verify conversation belongs to caller's organization, evaluate Lazada session aging using latest **buyer** message timestamp (`<= 5 days`) or recent order (`<= 7 days`, calling `openLazadaImSession` if session has expired beyond 5 days and order <= 7 days exists), check 5-message/24h consecutive reply quota, and create placeholder `Message` with `status: 'SENDING'` (and if `draftId` supplied, run `applyAiDraftService` freshness, PII, internal-label, and voucher safety checks).
  - Phase 2 (outside transaction): if `conversation.platformSessionId` exists on a Lazada connection, call `sendLazadaImMessage(connectionId, platformSessionId, text)`.
  - Phase 3 (short DB commit):
    - On delivery success: update `Message` to `status: 'SENT'`, `platformMessageId: imResult.messageId`, `connectionId`, `timestamp`, set `conversation.lastMessageTime`, `unreadCount: 0`, transition `draft` -> `'applied'` (`approvedById`, `approvedAt`, `appliedMessageId`), resolve open escalation audit log or clear `humanApprovalRequired` if operator-sent, and publish SSE `chat:message_received` (including `orgId`).
    - On delivery failure: update `Message` to `status: 'FAILED'` (leaving draft `pending` so operator can retry!) and throw/return a structured error.
- [x] Route `sendMessageAction` (`src/actions/conversationActions.ts`) through the unified Lazada delivery pipeline when replying from `MessageInput` (instead of DB-only `createConversationMessage`).
- [x] Route `saveAiResponseAction` (`src/actions/conversationActions.ts`) through the unified Lazada delivery pipeline (preserving all `applyAiDraftService` strategy validation, freshness check, grounding/PII checks) so approving an AI draft actually sends the message to Lazada before marking the draft `applied`.
- [x] Fix `MessageInput.tsx`:
  - Inspect the `ActionResponse` returned by `sendMessageAction(conversationId, message)`.
  - When `res.success === false`, keep the typed text inside the textarea (do NOT clear `text`), show `res.error` in `ErrorBanner`, and do not treat the send as complete.
- [x] Add `markConversationReadAction` (in `agentSessionActions.ts` or `conversationActions.ts`) and service helper `markConversationAsRead`:
  - Find the latest incoming buyer/platform message (`platformMessageId`) in the conversation.
  - Call `markLazadaSessionRead(connectionId, platformSessionId, lastReadMessageId)` outside DB transaction when `platformSessionId` and `lastReadMessageId` exist, reset `conversation.unreadCount = 0` in DB, and publish `chat:session_updated`.
  - Wire `AgentWorkspace` (`selectConversation`) / `ChatPanel` to invoke `markConversationReadAction` automatically when selecting/viewing a conversation with `unreadCount > 0` (and pass `lastReadMessageId` inside `takeoverConversationSession` as well).
- [x] Fix `ChatPanel.tsx` 5-day expiration banner/block:
  - Compute `isExpired` and `remainingHours` from `lastBuyerMessageTime` (latest `buyer` message timestamp) rather than `latestMessage?.timestamp || updatedAt`, and account for recent-order 7-day openability cleanly.
- [x] Update `src/messages/en.json` and `src/messages/vi.json` with 100% key parity:
  - Update `chat.preview.approve` / `approveEdited` copy to accurately reflect "Approve & send" / "Duyệt & gửi" instead of internal-only wording.
  - Add localized error strings for expired 5-day window, 5-message/24h anti-spam quota limit, and Lazada send failure.
- [x] Update `test/actions/agentSessionActions.test.ts` (and cover `sendMessageAction` / `saveAiResponseAction`) to assert `SENDING -> SENT` & `SENDING -> FAILED` transitions, `last_read_message_id` forwarding, draft preservation on Lazada error, and anti-spam / 5-day checks.

## Acceptance Criteria

- Criterion 1: Submitting a manual reply in `MessageInput` calls Lazada `/im/message/send`, stores real `platformMessageId` and `status: 'SENT'`, resets `unreadCount: 0`, and preserves input text while showing an inline error if Lazada fails.
- Criterion 2: Approving an AI Co-Pilot draft in `AiResponsePreview` validates freshness & safety rules, sends the message to Lazada `/im/message/send`, marks the draft `'applied'` only on success, and keeps the draft `'pending'` if Lazada rejects.
- Criterion 3: Opening an unread conversation calls `/im/session/read` with `session_id` and `last_read_message_id`, syncing read status to Seller Center.
- Criterion 4: `isExpired` in UI and backend enforces the 5-day window from the customer's last reply (with 7-day recent order handling) and enforces the 5-message/24h anti-spam limit.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/actions/agentSessionActions.test.ts test/integration/chatEscalation.test.ts

