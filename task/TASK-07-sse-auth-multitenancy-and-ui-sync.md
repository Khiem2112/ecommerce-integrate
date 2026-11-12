# Task: TASK-07 - Enforce SSE Auth & Multi-Tenant Organization Isolation and Fix Workspace UI Sync

- Feature: Multi-Tenancy Security (`/api/chat/stream`, Inbox Queries) & Workspace UI Realtime State
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`, `.agents/skills/i18n-check/SKILL.md`
- Scope: security | backend | frontend
- Status: Complete

## Objective

Eliminate cross-organization data leaks in SSE streaming and conversation queries by authenticating `/api/chat/stream` via NextAuth session context and strictly scoping all conversation/RAG queries by active `organizationId`, and fix the remaining UI realtime bugs (`AgentSessionList` tab priority hiding `in_progress` under `escalated`, `useAgentSession` ignoring cold sessions and mislabeling ASC `seller` replies as "Hệ thống", plus rich message/unread/displayName rendering).

## Technical Context And Dependencies

- Pre-requisites: `TASK-03` (`Customer.displayName` / `avatarUrl`, `RECALLED` SSE, rich `messageType` events), `TASK-04` (`lastBuyerMessageTime`, `unreadCount`, read sync).
- Reusable Assets:
  - `getAuthenticatedSessionContextService` in `src/services/authentication/authSessionService.ts`
  - `useAgentSession` in `src/hooks/useAgentSession.ts`
  - `AgentSessionList` in `src/components/organisms/chat/AgentSessionList.tsx`
  - `ConversationRow` in `src/components/molecules/inbox/ConversationRow.tsx`
  - `MessageBubble` in `src/components/molecules/chat/MessageBubble.tsx`
  - Existing tests in `test/api/chatStream.test.ts`, `test/services/chatBroadcaster.test.ts`, `test/hooks/useAgentSession.test.ts`
- Target Files:
  - `src/app/api/chat/stream/route.ts`
  - `src/services/chatBroadcaster.ts`
  - `src/services/conversationService.ts`
  - `src/actions/conversationActions.ts`
  - `src/actions/agentSessionActions.ts`
  - `src/app/api/rag/context/route.ts`
  - `src/app/api/rag/generate/route.ts`
  - `src/app/[locale]/(app)/conversations/page.tsx`
  - `src/components/organisms/workspace/AgentWorkspace.tsx`
  - `src/hooks/useAgentSession.ts`
  - `src/components/organisms/chat/AgentSessionList.tsx`
  - `src/components/organisms/chat/ChatPanel.tsx`
  - `src/components/molecules/inbox/ConversationRow.tsx`
  - `src/components/molecules/chat/MessageBubble.tsx`
  - `src/types/conversation.ts`
  - `src/types/workspace.ts`
  - `src/messages/en.json`
  - `src/messages/vi.json`
  - `test/api/chatStream.test.ts`
  - `test/services/chatBroadcaster.test.ts`
  - `test/hooks/useAgentSession.test.ts`

## Checklist

- [x] Secure `GET /api/chat/stream` (`src/app/api/chat/stream/route.ts`) and `ChatBroadcasterManager` (`src/services/chatBroadcaster.ts`):
  - Resolve session context via `getAuthenticatedSessionContextService()`. Reject unauthenticated requests with HTTP `401` and requests without `activeOrganization.organizationId` with HTTP `403` (removing arbitrary unauthenticated `?orgId=` acceptance).
  - Update `ChatBroadcasterManager.dispatchToListeners`: NEVER broadcast events to listeners whose `registration.orgId === undefined` (`if (registration.orgId === undefined || eventOrgId === undefined || registration.orgId !== eventOrgId) return;`), guaranteeing strict tenant boundary even for local fallback delivery.
  - Ensure all callers of `publishChatEvent` include `organizationId` so `eventOrgId` is always scoped.
- [x] Enforce `organizationId` isolation across Inbox, Conversation, Agent Session, and RAG endpoints:
  - Update `getInboxConversations(organizationId, filters)` and `getConversationById(id, organizationId)` in `src/services/conversationService.ts` to filter strictly by `connection: { organizationId, isActive: true }`.
  - Authenticate and pass `session.activeOrganization.organizationId` in `fetchInboxAction`, `fetchConversationAction`, `takeoverSessionAction`, `sendApprovedDraftAction`, `handbackToBotAction`, `resolveSessionAction`, `GET /api/rag/context`, and `POST /api/rag/generate` (rejecting cross-org access cleanly).
- [x] Pass server-resolved `organizationId` from `src/app/[locale]/(app)/conversations/page.tsx` into `AgentWorkspace` and `useAgentSession({ orgId: organizationId, activeConversationId: selectedConversationId })`.
- [x] Fix `src/hooks/useAgentSession.ts` real-time cache and label bugs:
  - In `case 'chat:message_received'`: if `prevList` in `['conversations']` does not contain `event.conversationId` (Cold Session!), trigger `queryClient.invalidateQueries({ queryKey: ['conversations'] })` so new customer threads appear automatically without F5.
  - Fix `senderCode === 'seller'` handling: render operator sender metadata cleanly (`isHuman: true`, localized/role operator label instead of `'Hệ thống'` / `isHuman: false`), and map `messageType`, `mediaUrl`, `referenceId`, `status` into `WorkspaceMessage`.
  - In `case 'chat:operator_takeover'`: stop setting `humanApprovalRequired: true` (`status.code: 'in_progress'`, `humanApprovalRequired: false`), matching human-handling workflow.
  - Handle message recall updates (`chat:message_recalled` / `chat:message_updated`) updating `status: 'RECALLED'` and `text` inside active `['conversation', conversationId]` and `['conversations']` caches.
  - In `case 'chat:session_updated'`: update `unreadCount` and `lastMessageTime` for both `['conversations']` and active `['conversation', conversationId]`.
- [x] Fix `src/components/organisms/chat/AgentSessionList.tsx` tab classification priority:
  - Evaluate `c.status.code === 'in_progress'` BEFORE `c.priority === 'urgent' || c.humanApprovalRequired` (and exclude `in_progress`, `resolved`, `closed` from `escalated` unless `c.status.code === 'escalated'`), so taken-over sessions move cleanly from Escalated/Bot to the In Progress tab in both `counts` and `filteredConversations`.
- [x] Upgrade workspace DTOs (`src/types/workspace.ts`, `conversationActions.ts`) and UI components (`ConversationRow.tsx`, `ChatPanel.tsx`, `MessageBubble.tsx`):
  - Add `customerDisplayName`, `customerAvatarUrl`, `unreadCount`, and `lastBuyerMessageTime` to `ConversationSummary` / `ConversationDetail`, plus `mediaUrl`, `referenceId`, `status`, `processMsg` to `WorkspaceMessage`.
  - Display `customerDisplayName || customerIdentifier` and `unreadCount` badge on `ConversationRow.tsx` and header of `ChatPanel.tsx`.
  - Render non-text templates (`IMAGE`, `ITEM`, `ORDER`, `VOUCHER`, `VIDEO`, `EMOJI`, `SYSTEM`, `RECALLED`, and `FILTERED` moderation `processMsg` notices) in `MessageBubble.tsx` with `vi.json` / `en.json` parity.
- [x] Update `test/api/chatStream.test.ts`, `test/services/chatBroadcaster.test.ts`, and `test/hooks/useAgentSession.test.ts` to verify `401`/`403` auth enforcement, strict `orgId` tenant filtering (zero cross-org leaks), cold session cache invalidation, `seller` role formatting, and `in_progress` tab placement.

## Acceptance Criteria

- Criterion 1: Calling `GET /api/chat/stream` unauthenticated returns 401; listeners cannot subscribe globally (`orgId: undefined`) or spoof `?orgId=` to receive another organization's messages.
- Criterion 2: Operators in Organization A cannot view, reply to, generate RAG drafts for, or escalate conversations belonging to Organization B.
- Criterion 3: When a cold session triggers `chat:message_received`, `useAgentSession` invalidates `['conversations']` so the new customer row renders automatically in the inbox with display name and `unreadCount` badge.
- Criterion 4: When an operator takes over a session (`chat:operator_takeover`), `AgentSessionList` counts and displays it under `In Progress` (`in_progress`), and seller messages pushed from Lazada ASC show as human operator messages rather than `"Hệ thống"`.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/api/chatStream.test.ts test/services/chatBroadcaster.test.ts test/hooks/useAgentSession.test.ts

