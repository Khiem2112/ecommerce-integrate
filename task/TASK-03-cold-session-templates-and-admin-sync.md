# Task: TASK-03 - Fix Cold Session Hydration, Rich Message Template Parsing, and Lazada Seller Center Sync

- Feature: Worker Ingestion, Cold Session Creation, and ASC Admin Synchronization
- Governing Spec: `research/lazada/chat api/README.md` (Sections 2, 4.2, 5, 6), `.agents/skills/db-conventions/SKILL.md`
- Scope: database | backend
- Status: Complete

## Objective

Fix all database and synchronization defects inside `chatQueueWorker.ts`: hydrate new buyers cleanly via `/im/session/get` and atomic `Customer.upsert` (eliminating `P2002` race conditions), parse non-text Lazada message templates into `MessageType`/`mediaUrl`/`referenceId`, stop incrementing `unreadCount` when ASC admin replies, prevent false takeover on `auto_reply: true` or system messages (`type: 2`), emit SSE updates on recalled messages, and ensure cold sessions link recent orders and fail safely on missing seed catalogs.

## Technical Context And Dependencies

- Pre-requisites: `TASK-01` (FIFO queue partitioning), `TASK-02` (`getLazadaImSession` in `lazadaImService.ts`).
- Reusable Assets:
  - `getLazadaImSession` in `src/services/connectors/lazada/lazadaImService.ts`
  - `chatBroadcaster` in `src/services/chatBroadcaster.ts`
  - `MessageType` enum (`TEXT`, `IMAGE`, `ITEM`, `ORDER`, `VOUCHER`, `VIDEO`, `EMOJI`, `SYSTEM`) in `src/model/schema.prisma`
  - `test/services/chatQueueWorker.test.ts`
- Target Files:
  - `src/model/schema.prisma`
  - `src/services/chatQueueWorker.ts`
  - `src/types/conversation.ts`
  - `src/types/index.ts`
  - `test/services/chatQueueWorker.test.ts`

## Checklist

- [x] Update `model Customer` in `src/model/schema.prisma` following `.agents/skills/db-conventions/SKILL.md`:
  - Add nullable marketplace display fields `displayName String?` and `avatarUrl String?` placed above the bottom audit fields (`isActive`, `createdAt`, `updatedAt`).
  - Run `yarn prisma:generate` (TS client types regenerated in `node_modules/.prisma/client/index.d.ts` and schema validated cleanly; `query_engine-windows.dll.node` rename hit Windows `EPERM` lock from a running host process; `prisma:push` not run).
- [x] Replace `parseMessageText` in `src/services/chatQueueWorker.ts` with a pure template parser `parseLazadaMessageContent(payload)` handling all templates from `research/lazada/chat api/README.md` Section 5:
  - `template_id = 1` -> `messageType: 'TEXT'`, extracting `txt` (preserving `translateTxt` when present)
  - `template_id = 2` (or `type = 2`) -> `messageType: 'SYSTEM'`, extracting `recallContent` or `txt`
  - `template_id = 3` -> `messageType: 'IMAGE'`, extracting `mediaUrl: parsed.imgUrl` and descriptive fallback label/caption
  - `template_id = 4` -> `messageType: 'EMOJI'`, extracting `txt` (`[emoji]`) and `mediaUrl: parsed.imgUrl ?? parsed.smallImgUrl`
  - `template_id = 6` -> `messageType: 'VIDEO'`, extracting `referenceId: parsed.video_id` / `mediaUrl`
  - `template_id = 10006` -> `messageType: 'ITEM'`, extracting `referenceId: parsed.itemId`
  - `template_id = 10007` -> `messageType: 'ORDER'`, extracting `referenceId: parsed.orderId`
  - `template_id = 10008` -> `messageType: 'VOUCHER'`, extracting `referenceId: parsed.promotionId`
  - `template_id = 10010` / `10011` / `10015` -> map cleanly to `SYSTEM` or `TEXT` without dumping raw JSON strings into `Message.text` when a human-readable field exists.
- [x] Fix Cold Session initialization in `handlePushMessage` (`src/services/chatQueueWorker.ts`):
  - Replace `prisma.customer.findFirst` + `prisma.customer.create` with atomic `prisma.customer.upsert` using `where: { connectionId_platformBuyerId: { connectionId, platformBuyerId: buyerIdentifier } }`.
  - When a session is new (`!conversation`) or `customer.displayName` is missing, call `getLazadaImSession(connectionId, sessionId)` (gracefully handling non-fatal API failures without dropping the incoming message) to populate `Customer.displayName` and `Customer.avatarUrl`.
  - Look up the most recent active `Order` for `customer.id` (e.g., within 30 days) so `Conversation.orderId` is automatically linked on cold sessions when an existing order exists for that `platformBuyerId`.
  - Also look up recent order matching `externalOrder` when buyer already bought prior to first chat.
  - Replace hardcoded `?? 1` fallbacks (`vipTierId`, `statusId`, `senderTypeId`) with explicit catalog validation throwing a descriptive error if required seed rows (`standard` VIP tier, `open` status, `buyer`/`seller`/`system` senderType) are missing.
- [x] Fix Lazada Seller Center (ASC) message sync bugs in `handlePushMessage`:
  - Fix `unreadCount` corruption: ONLY set/increment `unreadCount` when `payload.from_account_type === 1` (`payload.status !== 1`); when `payload.from_account_type === 2`, reset `unreadCount: 0`!
  - Ensure `conversation.lastMessageTime` advances monotonically (`incomingTime > existingLastMessageTime ? incomingTime : existingLastMessageTime`).
  - Differentiate real ASC human operator replies vs Lazada auto-reply / system messages:
    - Set `senderCode` to `'system'` when `payload.type === 2 || payload.template_id === 2`, else `'buyer'` when `from_account_type === 1`, else `'seller'`.
    - ONLY perform operator takeover (`statusId -> in_progress`, `redis.del(debounceKey)`, publish `chat:operator_takeover`) when `payload.from_account_type === 2 && payload.auto_reply !== true && payload.type !== 2 && payload.template_id !== 10015 && payload.template_id !== 2`.
- [x] Fix recall and session update SSE emission:
  - When `existingMessage` is updated to `status: 'RECALLED'` (`payload.status === 1`), publish a `ChatStreamEvent` (e.g., `chat:message_updated` / `chat:message_recalled` added to `src/types/conversation.ts`) so open workspaces reflect recalled text in real time.
  - In `handlePushMessage`, include `messageType`, `mediaUrl`, `referenceId`, and `status` in the published `chat:message_received` payload.
  - In `handlePushSessionUpdate`, look up matched `Conversation` so `chat:session_updated` includes `conversationId`, `unreadCount`, and `lastMessageTime` (allowing active thread views and inbox rows to sync cleanly even when `unread_count === 0`).
- [x] Update `test/services/chatQueueWorker.test.ts` to cover:
  - Cold session creation with `Customer.upsert` + `/im/session/get` displayName/avatar hydration + `orderId` auto-link
  - Rich template parsing (`IMAGE`, `ITEM`, `ORDER`, `VOUCHER`, `RECALLED`, `FILTERED`)
  - Seller reply from ASC resetting `unreadCount` to `0` and NOT misclassifying `auto_reply: true` or `type: 2` as operator takeover
  - Recall event emitting SSE update to client listeners.

## Acceptance Criteria

- Criterion 1: A cold session initiated by a brand-new Lazada buyer atomically upserts `Customer` without `P2002` race errors, enriches `displayName`/`avatarUrl` when `/im/session/get` responds, links the latest matching order when available, and creates the `Conversation` with accurate `unreadCount` and catalog FKs.
- Criterion 2: When an admin replies from Lazada Seller Center (`from_account_type === 2`, `auto_reply: false`, `type: 1`), `unreadCount` becomes `0`, `status` transitions to `in_progress`, and `chat:operator_takeover` + `chat:message_received` (`senderCode: 'seller'`) are broadcast.
- Criterion 3: When Lazada sends `auto_reply: true`, `template_id: 10015`, or `type: 2` with `from_account_type === 2`, the conversation does NOT falsely switch to human takeover and `unreadCount` is not incremented.
- Criterion 4: Recalling a message (`status === 1`) updates DB `status: 'RECALLED'` and broadcasts an SSE update for live UI rendering.

## Verification Commands

- Command 1: npx prisma generate
- Command 2: npx tsc --noEmit
- Command 3: yarn lint
- Command 4: yarn i18n:check
- Command 5: npx vitest run test/services/chatQueueWorker.test.ts

