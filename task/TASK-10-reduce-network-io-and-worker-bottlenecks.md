# Task: TASK-10 - Reduce Network Timeout Stalls, Redundant DB Queries, and Queue Worker Bottlenecks

- Feature: RAG & Messaging Latency Optimization - Network, I/O, and Concurrency
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/rules/RULE.md`, `.agents/skills/convention/SKILL.md`
- Scope: backend
- Status: Complete

## Objective

Eliminate network/provider stall cascades, redundant uncached database queries, and worker/connection bottlenecks across `src/services/rag/llmService.ts`, `src/services/rag/contextBuilder.ts`, `src/services/rag/strategyCatalog.ts`, `src/services/conversationService.ts`, `src/services/orderService.ts`, and `src/services/chatQueueWorker.ts` so single-turn processing stays predictably within SLA even under concurrent customer load and intermittent upstream provider failures.

## Technical Context And Dependencies

- Pre-requisites: `TASK-09` (if executed sequentially via `run_tasks.ps1`, so `LlmGenerationOptions` changes in `src/services/rag/llmService.ts` and `src/types/rag.ts` compose cleanly without conflict; safe alongside `TASK-05`).
- Reusable Assets:
  - `getConversationMessages` and `getConversationCount` in `src/services/conversationService.ts`
  - `getCustomerById` and `getCustomerEvidences` in `src/services/customerService.ts`
  - `getOrderByIdService` in `src/services/orderService.ts`
  - `redis` in `src/lib/redis.ts`
  - `withDistributedLock` in `src/lib/redlock.ts`
  - `appLogger` in `src/lib/logger.ts`
- Target Files:
  - `.env.example`
  - `src/services/rag/llmService.ts`
  - `src/services/rag/contextBuilder.ts`
  - `src/services/rag/strategyCatalog.ts`
  - `src/services/rag/index.ts`
  - `src/services/conversationService.ts`
  - `src/services/orderService.ts`
  - `src/services/chatQueueWorker.ts`
  - `src/instrumentation.ts`
  - `test/rag/llmService.test.ts`
  - `test/services/chatQueueWorker.test.ts`
  - `test/rag/contextBuilder.test.ts` (new)

## Checklist

- [x] Replace long 60s timeout/retry stalls in `src/services/rag/llmService.ts` and document env tuning in `.env.example`:
  - Lower default `CLIENT_TIMEOUT_MS` from `60_000` to fast SLA-aligned defaults (e.g. `8_000`ms default / `12_000`ms for `'complex'` tier, configurable via `LLM_TIMEOUT_MS`) and add a total cross-provider deadline (`LLM_TOTAL_BUDGET_MS`, e.g. `15_000`ms) so fallback cascades never exceed SLA.
  - Update `PROVIDER_CONFIGS` / `getAvailableProvidersForTier` so low-latency direct providers (`gemini`, `deepseek`, `openai`, `grok`) always take priority ahead of slower proxy/gateway hops (`opencode`) across all tiers including `'complex'`.
  - Refactor `callWithRetry`: fail fast without sleeping/retrying on non-transient errors (`400`, `401`, `403`, `404`, schema validation errors, or abort/timeout errors when backup providers are available); allow at most 1 short jittered retry (`~300ms`) only when needed and remaining budget permits.
  - Add a short-TTL in-memory provider health cooldown (circuit-breaker state, e.g., skip a provider for 30s-60s after consecutive timeouts or auth/5xx failures, with clean reset/bypass helper for tests) so concurrent turns immediately route to healthy providers.
  - Remove pre-existing emoji characters inside `llmService.ts` logs and ensure zero emojis or numbered step comments in all modified files.
- [x] Eliminate unbounded history queries and redundant relation joins in `src/services/rag/contextBuilder.ts`, `src/services/conversationService.ts`, and `src/services/orderService.ts`:
  - Add a bounded snapshot loader in `src/services/conversationService.ts` (e.g., `getConversationForRagContext(conversationId, messageLimit, tx)`) that fetches conversation header (`intent`, `status`, `priority`, `orderId`, `customerId`, nested `customer` + `vipTier`), only the latest `messageLimit` active messages (ordered `desc` with `take: messageLimit` and reversed chronologically, reusing `getConversationMessages` pattern), and total active message count without downloading the entire thread message history; preserve `getConversationById` for full thread inspection callers.
  - Replace `getUnresolvedConversations(customerId, tx)` in `buildCustomerDossier` (`src/services/rag/contextBuilder.ts`) with a `count`-only service `getUnresolvedConversationCount(customerId, tx)` in `src/services/conversationService.ts` (`tx.conversation.count(...)`) instead of loading full rows and relations only to read `.length`.
  - Add a lightweight order loader in `src/services/orderService.ts` (`getOrderForRagContextService`) excluding redundant deep `customer` and unused relation re-joins while keeping `currentStatus`, `connection.platform`, `items` (with `category`), and `statusHistory` fields required by `formatLinkedOrder` and `buildGroundingFactCatalog`.
  - Reuse the customer loaded with conversation where safe or fetch remaining order, past intents, conversation counts, and customer evidences concurrently in `buildFullContext`, avoiding sequential waterfalls after conversation metadata is resolved.
- [x] Add short-TTL caching for active retention strategies in `src/services/rag/strategyCatalog.ts`:
  - Cache `getActiveRetentionStrategies()` results in memory with a configurable short TTL (e.g., 60s) when using the default `prisma` client, bypassing cache automatically when an explicit transaction `tx !== prisma` is passed and exposing `invalidateRetentionStrategyCache()` for writes/tests.
- [x] Add latency telemetry and worker concurrency controls across `src/services/rag/index.ts`, `src/services/chatQueueWorker.ts`, `src/instrumentation.ts`, and `.env.example`:
  - Instrument `generateGroundedResponse` in `src/services/rag/index.ts` to record structured stage timings (`contextBuildMs`, `llmMs`, `groundingMs`, `totalMs`, `providerUsed`) via `appLogger.info` without leaking PII or prompt contents.
  - Make BullMQ worker concurrency in `startChatQueueWorker` (`src/services/chatQueueWorker.ts`) configurable via `CHAT_WORKER_CONCURRENCY` (validated integer with safe bounds) instead of hardcoded `5`, and add optional `ENABLE_IN_APP_WORKERS` toggle (default preserving existing dev startup in `src/instrumentation.ts`) so high-load deployments can isolate background workers from Next.js web request serving.
  - Ensure Redis cache/lock error paths inside worker processing fail gracefully and verify no LLM network calls are placed inside `prisma.$transaction`.
- [x] Add automated regression tests in `test/rag/llmService.test.ts`, `test/rag/contextBuilder.test.ts` (new), and `test/services/chatQueueWorker.test.ts`:
  - `test/rag/llmService.test.ts`: test fast failover without 1000ms retry delay on 401/400/timeout errors, provider speed ordering for `'complex'` tier, total budget cutoff, and circuit-breaker temporary skip behavior after repeated failures.
  - `test/rag/contextBuilder.test.ts`: test bounded message loading (`take` limit respected), `count`-only unresolved conversation query (no full `findMany`), and strategy catalog TTL cache hit vs invalidation.
  - `test/services/chatQueueWorker.test.ts`: test configurable worker `CHAT_WORKER_CONCURRENCY` parsing/bounds alongside existing webhook FIFO processing tests.

## Acceptance Criteria

- Criterion 1: `llmService.ts` enforces bounded per-attempt timeouts (default <= 12s, configurable via `LLM_TIMEOUT_MS`), skips retries on non-transient/auth/timeout errors when backup providers exist, routes `'complex'` tier using fast direct providers first, and trips a temporary cooldown after consecutive provider failures.
- Criterion 2: `buildFullContext` fetches at most the configured window of recent messages (`take: MAX_RECENT_MESSAGES`) instead of unbounded `findUnique` message arrays and uses `prisma.conversation.count` for unresolved conversation counts.
- Criterion 3: Consecutive `getActiveRetentionStrategies()` calls within TTL hit the in-memory cache (1 DB query instead of N) while transaction-scoped calls (`tx !== prisma`) bypass cache cleanly.
- Criterion 4: `startChatQueueWorker` respects `CHAT_WORKER_CONCURRENCY` with safe default/bounds, and `generateGroundedResponse` logs structured stage latency metrics (`contextBuildMs`, `llmMs`, `groundingMs`, `totalMs`).
- Criterion 5: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and targeted Vitest suites exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/rag/llmService.test.ts test/rag/contextBuilder.test.ts test/services/chatQueueWorker.test.ts

