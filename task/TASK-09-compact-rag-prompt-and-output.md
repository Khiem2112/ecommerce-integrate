# Task: TASK-09 - Compact RAG System Prompt, Context Pruning, and Output Budget Optimization

- Feature: RAG Latency Optimization - Prompt & Token Reduction
- Governing Spec: `docs/autonomous-chat-escalation/specs/v1.md`, `.agents/skills/business-logic/features/vip_customer_routing.md`, `.agents/rules/RULE.md`
- Scope: backend
- Status: Complete

## Objective

Eliminate unnecessary input prompt bloat and excessive LLM output token generation in the 3-layer RAG pipeline (`src/utils/rag/promptUtils.ts`, `src/services/rag/index.ts`, `src/services/rag/llmService.ts`) so that customer-facing responses consistently target 5-10 seconds on initial product/order inquiries and 4-6 seconds on follow-up turns, maximize LLM provider prefix-cache hits by ordering static instructions ahead of dynamic context, and strictly preserve fact-grounding and anti-jargon safety guarantees.

## Technical Context And Dependencies

- Pre-requisites: None (designed to compose cleanly before or after `TASK-05`; `/api/rag/generate` already invokes `generateGroundedResponse`).
- Reusable Assets:
  - `resolveIntentTier` and `filterStrategiesForTier` in `src/services/rag/intentRouter.ts`
  - `getPoliciesByIntent` in `src/utils/rag/policyUtils.ts`
  - `buildGroundingFactCatalog` in `src/services/rag/groundingFacts.ts`
  - `validateMultiDraftGrounding` and `evaluateAutonomousGrounding` in `src/services/rag/groundingValidator.ts`
  - `parseAndValidateResponse` in `src/utils/rag/parseUtils.ts`
  - `rawMultiDraftResponseSchema` and `createRawMultiDraftResponseSchema` in `src/forms/ragForm.ts`
- Target Files:
  - `src/types/rag.ts`
  - `src/utils/rag/promptUtils.ts`
  - `src/utils/rag/policyUtils.ts`
  - `src/services/rag/index.ts`
  - `src/services/rag/llmService.ts`
  - `src/services/rag/strategyCatalog.ts`
  - `test/rag/policyAndPrompt.test.ts`
  - `test/rag/llmService.test.ts`
  - `test/rag/multiDraftContracts.test.ts`

## Checklist

- [x] Add structured RAG generation control types in `src/types/rag.ts`:
  - Define `RagResponseMode = 'copilot_multi' | 'fast_single'` and `GenerateGroundedOptions` (`mode?: RagResponseMode`, `maxOutputTokens?: number`).
  - Define `LlmGenerationOptions` (`maxOutputTokens?: number`, `timeoutMs?: number`, `tier?: 'simple' | 'standard' | 'complex'`) so `llmService.ts` accepts explicit output token caps cleanly without `any`.
- [x] Restructure `src/utils/rag/promptUtils.ts` for prefix caching and minimum input token footprint while keeping utils strictly pure and stateless:
  - Separate a deterministic, byte-identical static prefix (role, grounding/privacy/no-jargon safety rules, compact JSON contract, compact strategy summary when fixed or ordered consistently) at the top of system prompts, placing dynamic turn/order/customer data strictly at the tail of the prompt or inside `buildUserPrompt`.
  - Remove duplicate `RETENTION STRATEGY CATALOG` injection between system prompt and `buildUserPrompt` so strategy codes are provided once per completion.
  - Compress `MULTI_DRAFT_RESPONSE_JSON_FORMAT` and prose instructions (remove repeated instructional filler and add a concise single-draft JSON mode instruction for `fast_single` / `simple` tier).
  - Compact `formatRetentionStrategyCatalogForPrompt` in `src/utils/rag/promptUtils.ts` into dense single-line entries (`code | strategyType | tone | guidance`) instead of verbose multi-line blocks.
- [x] Apply tier-aware context and citation pruning across `buildLiteSystemPrompt`, `buildStandardSystemPrompt`, and `buildSystemPrompt` in `src/utils/rag/promptUtils.ts`:
  - `simple` tier (`buildLiteSystemPrompt`): include only recent messages capped at the last 4 turns with message text trimmed to safe preview length, minimal order summary fields (`order:id`, `order:status`, `order:total_value`, primary item name/sku), top 3 high-confidence (`>= 0.85`) evidence facts, and intent-relevant policy rules only (via `getPoliciesByIntent`), omitting bulky behavioral dossier fields not required for FAQ/simple queries.
  - `standard` tier (`buildStandardSystemPrompt`): limit recent messages to the last 6 turns, evidence facts to top 5, use filtered strategies from `filterStrategiesForTier('standard', activeStrategies)`, and format sections using dense single-line `key: value` pairs.
  - `complex` tier (`buildSystemPrompt`): retain full 3-layer Turn, Dossier, Evidence, and Policy citations needed for high-stakes disputes while eliminating duplicated instructional text and redundant whitespace.
  - Support `mode: 'fast_single'` (and default `simple` tier single-strategy target) instructing the model to emit 1 ranked draft (`rank: 1`, concise Vietnamese `draftText` <= 3 sentences, `recommendationReason` <= 20 words) rather than 2-3 separate drafts, remaining 100% compatible with `rawMultiDraftResponseSchema` (`.min(1).max(3)`).
- [x] Wire generation options and token caps through `src/services/rag/index.ts` and `src/services/rag/llmService.ts`:
  - Update `generateGroundedResponse(conversationId, options?)` in `src/services/rag/index.ts` to accept optional `GenerateGroundedOptions` (defaulting to `'copilot_multi'` so `/api/rag/generate` and existing callers continue working without signature breakage) and apply tier-appropriate `maxOutputTokens` budgets (e.g., compact budget for `simple`/`fast_single`, balanced budget for `standard`, higher budget for `complex`).
  - Pass `maxOutputTokens` cleanly in `src/services/rag/llmService.ts` to both OpenAI-compatible clients (`max_tokens`) and `@google/genai` (`config.maxOutputTokens`).
  - Ensure zero emojis/icons and zero numbered step comments are introduced across all touched files.
- [x] Update and expand unit tests in `test/rag/policyAndPrompt.test.ts`, `test/rag/llmService.test.ts`, and `test/rag/multiDraftContracts.test.ts`:
  - Update `buildUserPrompt` / `buildSystemPrompt` assertions if duplicate catalog text in `buildUserPrompt` is removed, while preserving assertions covering VIP tier injection, allowed fact citations (`[order:status]`, `[order:id]`, `[customer:tier]`, `[customer:spend]`, `[evidence:42]`, `[policy:PII_PROHIBITION]`), and internal jargon prohibition.
  - Add unit tests verifying static prefix identity across two distinct customers/contexts (confirming prompt-cache compatibility).
  - Add unit tests confirming `buildLiteSystemPrompt` and `fast_single` prompts stay significantly smaller than `buildSystemPrompt` (`complex`) and produce valid 1-strategy payloads passing `parseAndValidateResponse` and `validateMultiDraftGrounding`.
  - Add unit tests in `test/rag/llmService.test.ts` verifying `max_tokens` / `maxOutputTokens` propagation when generation options are supplied.

## Acceptance Criteria

- Criterion 1: `buildLiteSystemPrompt` and `buildStandardSystemPrompt` eliminate duplicated strategy catalogs and verbose prose, keeping `simple`-tier system+user prompt length less than 50% of the legacy unpruned complex prompt on the same fixture while retaining required grounding fact IDs and internal-jargon prohibitions.
- Criterion 2: For consecutive requests on the same tier/strategy subset, the leading static instruction prefix of the generated system prompt is byte-identical across different customer contexts to enable provider prefix caching.
- Criterion 3: `generateResponse` accepts and forwards `maxOutputTokens`, and `fast_single` mode yields single-draft JSON (`strategies` length `1`) validated cleanly by `createRawMultiDraftResponseSchema` and `validateMultiDraftGrounding` without relaxing any safety or grounding check.
- Criterion 4: `npx tsc --noEmit`, `yarn lint`, `yarn i18n:check`, and all tests under `test/rag/` exit with code 0.

## Verification Commands

- Command 1: npx tsc --noEmit
- Command 2: yarn lint
- Command 3: yarn i18n:check
- Command 4: npx vitest run test/rag/policyAndPrompt.test.ts test/rag/llmService.test.ts test/rag/multiDraftContracts.test.ts test/rag/groundingValidator.test.ts

