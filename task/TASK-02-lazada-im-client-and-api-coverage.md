# Task: TASK-02 - Repair Lazada IM Client Token Lifecycle, Response Unwrapping, and Complete Open API Coverage

- Feature: Lazada IM Open API Connector (`lazadaImService.ts`, `lazadaClient.ts`)
- Governing Spec: `research/lazada/chat api/README.md` (Sections 3, 4.1, 4.2, 5, 6), `.agents/skills/business-logic/features/shop_platform_integration.md`
- Scope: backend
- Status: Complete

## Objective

Fix critical defects in `lazadaImService.ts` that prevent real Lazada IM API calls from succeeding (reading snake_case `access_token` instead of camelCase `accessToken` + token refresh, misinterpreting already-unwrapped `LazadaClient.post` payloads, hiding errors via dev fake-success fallback, omitting `last_read_message_id`), and implement the full set of Lazada IM endpoints and session validity/anti-spam rules.

## Technical Context And Dependencies

- Pre-requisites: Understand `LazadaClient.executeWithRetry` returns `json.data as T` directly (`src/services/connectors/lazada/lazadaClient.ts`) and `shopCredentialService.ts` stores `LazadaIntegrationData` with camelCase `accessToken`.
- Reusable Assets:
  - `LazadaClient`, `LazadaApiError`, `LazadaClientError` in `src/services/connectors/lazada/lazadaClient.ts`
  - `refreshShopTokenIfNeededService`, `getShopCredentialsService`, `LazadaIntegrationData` in `src/services/shopCredentialService.ts`
  - `prisma` in `src/lib/prisma.ts`, `appLogger` in `src/lib/logger.ts`
  - Existing client tests in `test/connectors/lazadaClient.test.ts` and `test/shopConnection/credentials.test.ts`
- Target Files:
  - `.env.example`
  - `src/services/connectors/lazada/lazadaClient.ts`
  - `src/services/connectors/lazada/lazadaImService.ts`
  - `src/types/lazada.ts`
  - `test/connectors/lazadaClient.test.ts`

## Checklist

- [x] Update `LazadaClient` constructor (`src/services/connectors/lazada/lazadaClient.ts`) so `apiScope === 'chat'` checks `LAZADA_CHAT_APP_KEY` / `LAZADA_CHAT_APP_SECRET` first before falling back to `LAZADA_APP_KEY` / `LAZADA_APP_SECRET`, while preserving custom `appKey`/`appSecret` overrides from `LazadaIntegrationData.customAppKey`/`customAppSecret`.
- [x] Add typed Lazada IM API DTOs in `src/types/lazada.ts` (and re-export via `src/types/index.ts` if needed) matching `research/lazada/chat api/README.md`:
  - Send response (`message_id`, `current_time`, `template_id`)
  - Session detail (`/im/session/get`: `session_id`, `buyer_id` / `user_account_id`, `title`/`buyer_name`, `head_url`/`avatar`, `unread_count`, `last_message_time`, `tags`)
  - Session list (`/im/session/list`: `session_list`, `has_more`, `next_start_time`, `last_session_id`)
  - Message list (`/im/message/list`: `message_list`, `has_more`, `next_start_time`, `last_message_id`)
  - Session open (`/im/session/open`: `session_id`)
- [x] Refactor credential resolution in `src/services/connectors/lazada/lazadaImService.ts`:
  - Create a shared helper `createLazadaChatClient(connectionId)` using `refreshShopTokenIfNeededService(connectionId)` so `accessToken` (camelCase), `customAppKey`, and `customAppSecret` are loaded and refreshed atomically with mutex protection.
  - Only permit simulated send (`LAZADA_IM_SIMULATE_SEND=true`) when explicitly requested by environment variable, removing all snake_case `integrations?.access_token` reads and silent `sim-fallback-...` error masking in `catch`.
  - Document `LAZADA_IM_SIMULATE_SEND=false` in `.env.example`.
- [x] Fix `sendLazadaImMessage` in `src/services/connectors/lazada/lazadaImService.ts`:
  - Construct `LazadaClient` with `apiScope: 'chat'` and resolved `accessToken`.
  - Expect unwrapped `json.data` return from `client.post<{ message_id?: string; current_time?: number }>('/im/message/send', ...)` instead of checking `response.code === '0'` or `response.data?.message_id`.
  - Support optional template payloads (`template_id = 1` default text `txt`, plus extensible support for `template_id = 3` image / `10006` item / `10007` order / `10008` voucher when provided) and propagate descriptive `LazadaApiError` codes/messages on failure.
- [x] Fix `markLazadaSessionRead` in `src/services/connectors/lazada/lazadaImService.ts`:
  - Accept `lastReadMessageId: string` as a required argument and pass `last_read_message_id: lastReadMessageId` alongside `session_id` to `POST /im/session/read`.
  - Return explicit `{ success: false, error }` if `lastReadMessageId` or `accessToken` is missing (unless `LAZADA_IM_SIMULATE_SEND === 'true'`).
- [x] Implement the remaining Lazada IM Open API methods in `src/services/connectors/lazada/lazadaImService.ts`:
  - `getLazadaImSession(connectionId, sessionId)` calling `POST /im/session/get`
  - `listLazadaImSessions(connectionId, { startTime?, lastSessionId?, pageSize? })` calling `POST /im/session/list` (enforcing `page_size <= 20`)
  - `listLazadaImMessages(connectionId, { sessionId, startTime?, lastMessageId?, pageSize? })` calling `POST /im/message/list` (enforcing `page_size <= 20`)
  - `openLazadaImSession(connectionId, orderId)` calling `POST /im/session/open`
  - `recallLazadaImMessage(connectionId, sessionId, messageId)` calling `POST /im/message/recall`
- [x] Add pure domain helpers (or service validation helper) implementing `research/lazada/chat api/README.md` Section 3 rules:
  - Session aging evaluation: valid if `lastBuyerMessageTime` is within 5 days, OR fallback eligible if customer has an active order within the last 7 days (`hasRecentOrderWithin7Days`).
  - Anti-spam quota evaluation: block outbound send if customer has not replied within the last 24 hours AND consecutive seller/bot replies since last buyer reply reached `>= 5` (if buyer replied within 24h or count < 5, allow).
- [x] Update/add Vitest coverage (`test/connectors/lazadaClient.test.ts` and a dedicated IM client verification check) confirming `apiScope: 'chat'`, unwrapped response extraction, camelCase `accessToken` + refresh usage, and `/im/session/read` requiring `last_read_message_id`.

## Acceptance Criteria

- Criterion 1: `sendLazadaImMessage` uses `refreshShopTokenIfNeededService`, sends `session_id`, `template_id`, and `txt` via `LazadaClient.post`, extracts `message_id` directly from unwrapped `json.data`, and returns `{ success: false, error }` whenever Lazada rejects or errors (never silently returning `{ success: true, messageId: 'sim-fallback-...' }` unless `LAZADA_IM_SIMULATE_SEND=true`).
- Criterion 2: `markLazadaSessionRead` passes both `session_id` and `last_read_message_id` using a valid refreshed `accessToken`.
- Criterion 3: `getLazadaImSession`, `listLazadaImSessions`, `listLazadaImMessages`, `openLazadaImSession`, and `recallLazadaImMessage` are implemented with strict parameter validation (`page_size <= 20`), camelCase token refresh, and typed returns.
- Criterion 4: Session aging and 5-message/24h anti-spam quota helpers accurately enforce Lazada policy rules from `research/lazada/chat api/README.md`.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/connectors/lazadaClient.test.ts test/shopConnection/credentials.test.ts

