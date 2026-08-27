# Handoff: Phase 1 Multi-Draft Response

## Goal

Replace the current single AI-generated RAG response with a **multi-draft co-pilot experience**:

- One LLM completion per customer turn.
- Model selects **2–3 distinct retention strategies** from a fixed Phase 1 catalog of seven.
- Model ranks strategies and recommends exactly one, with an agent-facing rationale.
- Every candidate is grounded and safety-validated independently.
- UI preselects the recommended draft but lets an agent compare, edit, approve, or reject any safe option.

Detailed implementation plan: [phase_1_multi_draft_response_implementation_plan.md](./phase_1_multi_draft_response_implementation_plan.md).

---

## Current Architecture

```text
ChatPanel / AiResponsePreview
  → useRagGenerate
  → POST /api/rag/generate
  → generateGroundedResponse
  → buildFullContext + prompts + LLM provider + grounding validation
```

Current implementation is single-draft:

```text
one LLM call
→ one RagResponse
→ one GroundingResult
→ one preview card
```

Target implementation:

```text
one LLM call
→ 2–3 strategy drafts + recommendation
→ per-strategy safety/grounding validation
→ filter unsafe candidates
→ re-rank recommendation if necessary
→ strategy switcher UI
→ approve/edit/reject selected draft
```

### Stack

- Next.js App Router, React 19, TypeScript strict mode
- Prisma/MySQL
- Zod for API and LLM-output contracts
- TanStack React Query
- Jotai
- Gemini/OpenAI-compatible provider adapters
- Vitest

---

## What Is Already Implemented

Only planning work has been completed.

- Created [phase_1_multi_draft_response_implementation_plan.md](./phase_1_multi_draft_response_implementation_plan.md).
- Reviewed current RAG, UI, persistence, seed, policy, and test structure.
- Identified existing safety and architecture gaps.

No application source code has been changed.

No migration, test, lint, build, dependency installation, commit, or external API action has been run.

---

## Key Decisions

### Phase 1 strategy source

Use a static in-code catalog of seven strategies. Do **not** add a Prisma strategy catalog or Phase 3 retrieval/scoring engine.

Proposed canonical IDs:

- `strat_goodwill`
- `strat_whiteglove`
- `strat_concise`
- `strat_consultative`
- `strat_reassurance`
- `strat_boundary`
- `strat_delight`

The LLM selects only IDs. Server attaches canonical `label`, `type`, `tone`, and `retentionFocus`; do not trust model-supplied strategy metadata.

### One LLM completion

The feature must use exactly one LLM completion per Generate action:

- no per-strategy calls;
- no LLM repair/retry call after invalid output;
- no fallback that makes a second completion for this route.

If the one completion fails or does not produce enough safe candidates, return a retriable error or safe-generation error.

### Safety over partial output

Validate each returned strategy independently.

- Unsafe/unsupported strategies must never reach the browser.
- If fewer than two safe drafts remain, return an error rather than presenting one partial draft.
- If the recommended draft is removed, promote the highest-ranked remaining safe draft.
- Server derives exactly one final `isBestMatch`.

### Internal labels are never customer-facing

Customer-facing `draftText` must not include:

- `VIP`
- tier names such as `Platinum`, `Gold`, `Silver`, `Standard`
- RFM labels/scores
- strategy IDs
- evidence IDs
- internal customer classification/routing terms

These values can be used as internal model context and agent-facing rationale inputs only.

### Edited drafts

A human-edited draft is no longer guaranteed to have the original AI grounding.

- UI must visibly mark edited content.
- Server must still apply deterministic outbound checks before save:
  - PII;
  - internal segmentation labels;
  - voucher cap;
  - unknown citations;
  - non-empty content.
- Do not imply complete semantic validation for new human-authored claims without another verification design.

### Persistence

Do not add database fields in Phase 1 solely for strategy selection analytics.

Existing message metadata is sufficient for approved selected text:

- `groundedFacts`
- `ungroundedClaims`
- `confidence`
- `suggestedAction`

Future audit/evaluation work can add strategy-choice and edit-state persistence deliberately.

---

## Implementation Plan

### Phase A — Domain contracts and catalog

Modify:

- `src/types/rag.ts`
- `src/types/workspace.ts`
- `src/types/index.ts`
- `src/forms/ragForm.ts`

Add:

- `src/services/rag/strategyCatalog.ts`

Implement:

- multi-draft response type;
- per-strategy draft type;
- recommendation metadata;
- compensation/voucher metadata;
- per-strategy grounding result;
- strict Zod schema for 2–3 unique, ranked, distinct strategies;
- canonical static strategy catalog.

### Phase B — Prompt and evidence references

Modify:

- `src/utils/rag/promptUtils.ts`
- `src/utils/rag/groundingUtils.ts`

Potentially add a dedicated grounding-fact helper.

Implement:

- catalog injection into prompt;
- strict multi-draft JSON instructions;
- ranking and diversity instructions;
- customer-facing internal-label prohibition;
- an allowed evidence-reference catalog spanning Layer 1, Layer 2, Layer 3, and policy facts.

Current grounding recognizes numeric Layer 3 evidence IDs only; this must be expanded safely to deterministic allowed references.

### Phase C — LLM orchestration and validation

Modify:

- `src/services/rag/index.ts`
- `src/services/rag/llmService.ts`
- `src/utils/rag/llmUtils.ts`
- `src/utils/rag/groundingUtils.ts`

Implement:

- one-completion multi-draft generation method;
- parse once, validate all strategies;
- individual PII, grounding, policy, tier-jargon, and voucher-cap checks;
- candidate filtering and recommendation reconciliation;
- typed error if fewer than two safe strategies survive.

Important existing bug to correct:

```text
The latest-message selection can choose a seller/agent message because it accepts
`senderType.isHuman`; generation should use the newest buyer message only.
```

Important validation bug to address:

```text
Global regular expressions used with `.test()` can retain `lastIndex` across
multiple drafts and miss later PII violations.
```

### Phase D — API and hook

Modify:

- `src/app/api/rag/generate/route.ts`
- `src/hooks/useRagGenerate.ts`

Keep request shape:

```json
{ "conversationId": 123 }
```

Keep outer response envelope:

```json
{ "success": true, "data": {} }
```

Change only `data` from one response/grounding pair to the multi-draft DTO.

Suggested behavior:

- `400`: malformed request;
- `404`: missing conversation;
- `422`: valid provider output but fewer than two safe candidates;
- retriable generation/provider error for the single completion failure.

### Phase E — Multi-draft UI

Modify:

- `src/components/chat/ChatPanel.tsx`
- `src/components/copilot/AiResponsePreview.tsx`
- `src/components/copilot/GroundingAnnotation.tsx`
- `src/components/copilot/CopilotActions.tsx`

Implement:

- local multi-draft state per active conversation;
- clear draft state on conversation switch;
- strategy tabs/segmented control;
- recommendation badge and rationale banner;
- selected strategy text, confidence, citations, and grounding display;
- approval/edit/reject actions scoped to selected strategy;
- editor reset when switching strategy;
- edited-text warning.

### Phase F — Server-side save protection

Modify:

- `src/actions/conversationActions.ts`
- relevant workspace input types

Implement deterministic outbound validation before persisting selected AI content or edited content.

Do not accidentally save the recommended draft’s metadata when the agent selected another strategy.

### Phase G — Tests

Update/add tests under `test/rag/`:

- strategy catalog uniqueness and canonical metadata;
- valid 2–3 strategy parsing;
- duplicate IDs/ranks/text rejection;
- unsupported strategy/recommendation rejection;
- prompt contains catalog and customer-facing label restrictions;
- per-strategy grounding;
- invalid candidate filtering;
- recommendation re-selection;
- fewer-than-two-safe failure;
- tier-specific voucher limits;
- internal segmentation label detection;
- PII regex state regression;
- newest buyer-message selection;
- exactly one LLM completion.

Verification commands:

```bash
npx vitest run
npm run lint
npm run build
```

---

## Existing Relevant Files

### RAG contracts and parsing

- `src/types/rag.ts` — current single `RagResponse`, grounding types.
- `src/types/workspace.ts` — browser-facing `RagDraft`.
- `src/forms/ragForm.ts` — single-response Zod output schema.
- `src/utils/rag/llmUtils.ts` — provider JSON parsing and validation.
- `src/services/rag/llmService.ts` — provider orchestration.

### Context, prompt, and validation

- `src/services/rag/index.ts` — current one-response orchestration.
- `src/services/rag/contextBuilder.ts` — existing three-layer context; should be reused.
- `src/utils/rag/promptUtils.ts` — current system/user prompt construction.
- `src/utils/rag/groundingUtils.ts` — current grounding/PII/voucher safety.
- `src/utils/rag/policyUtils.ts` — policy constants.

### API, UI, and persistence

- `src/app/api/rag/generate/route.ts`
- `src/hooks/useRagGenerate.ts`
- `src/components/chat/ChatPanel.tsx`
- `src/components/copilot/AiResponsePreview.tsx`
- `src/components/copilot/GroundingAnnotation.tsx`
- `src/actions/conversationActions.ts`
- `src/services/conversationService.ts`

---

## Constraints

- Use project layering:

```text
Component → Hook → API Route / Server Action → Service → Prisma
```

- API route is the correct boundary for LLM/RAG generation.
- Services must not call actions.
- Hooks must not call Prisma/services directly.
- Use TypeScript `type`, not `interface`.
- Do not use `any`; prefer Zod and `unknown` narrowing.
- Keep immutable updates and existing Tailwind/`cn()` conventions.
- Do not expose marketplace PII or reconstruct hidden customer data.
- Keep all personalized customer-facing claims grounded in the existing context snapshot.
- Do not implement Phase 3 catalog retrieval, scoring, routing engine, or autonomous dispatch early.

---

## Environment Gotchas

- Workspace is **not a Git repository**.
  - Worktree-based subagents cannot be created here.
  - Do not assume branch, commit, or worktree operations are available.
- Environment is Windows 11 with Git Bash shell semantics.
- No secrets were read. A `.env` file exists in the workspace but was intentionally not opened.
- `package.json` does not appear to define a `test` script; use:

```bash
npx vitest run
```

- Vitest configuration targets `test/rag/` tests.
- No test, lint, or build result is available yet.
