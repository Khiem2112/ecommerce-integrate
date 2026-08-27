# Phase 1 — Multi-Draft Response Implementation Plan

> **Feature goal:** Replace the current single RAG reply with one LLM completion that chooses, ranks, and safely returns 2–3 distinct customer-care drafts from the fixed Phase 1 retention-strategy catalog. The agent workspace must preselect the AI recommendation while allowing a human to compare, edit, approve, or reject a draft.
>
> **Scope boundary:** This is a Phase 1 static catalog. It does not add Phase 3 routing, executable actions, a database strategy catalog, audit/replay UI, or a second LLM “repair” call.

---

## 1. Requirements and implementation decisions

This plan implements the Phase 1 specification in `vip_customer_routing_plan.md`:

- Inject the default catalog of seven retention strategies into the same context-aware prompt.
- Make **one LLM completion request per Generate click**, not one request per strategy and not an LLM repair/regeneration call after validation.
- Let the model choose exactly 2–3 relevant strategies, rank them, and nominate one recommendation with a comparative rationale.
- Reject unsafe or unsupported drafts individually; never expose rejected draft text to the browser.
- Return a comparison set only when at least two safe, distinct drafts remain. Otherwise return a retriable safe-generation error rather than silently showing one draft.
- Keep all internal segmentation vocabulary out of `draftText`. Terms such as `VIP`, `Platinum`, `Gold`, `Silver`, `Standard`, `RFM`, tier names/codes, and scores remain internal-agent data only.
- Preserve the existing human approval flow. Selecting a different safe draft changes only the currently selected draft; no new LLM request is made.

### Important Phase 1 constraints

1. **Static strategies, no schema migration.** The seven definitions live in code. A future Phase 3 `retention_strategy_catalog` can replace this source without changing the public multi-draft contract.
2. **Strict single-completion behavior.** The multi-draft route selects the first configured provider and makes one completion call. If that request fails or produces invalid JSON, the route reports a retriable error. The existing retry/fallback helper remains available for other call paths, but is not used by this route because it would violate the Phase 1 one-call contract.
3. **Safety before completeness.** One unsafe candidate must not downgrade a comparison into a single-draft experience. If fewer than two candidates survive validation, no content is returned.
4. **No strategy-selection persistence yet.** The approved outgoing `Message` retains existing text, citations, confidence, and suggested-action metadata. Persisting strategy choice, edit distance, and acceptance analytics belongs to the future audit/evaluation work; do not overload `groundedFacts` or `referenceId` to store it.
5. **Edited text requires human ownership.** The selected generated draft is fully validated. Editing it invalidates the displayed AI-grounding guarantee; the UI must make this clear and the save action must still re-run deterministic safety checks (PII, classification labels, voucher policy, valid citation IDs). Semantic validation of new human-authored claims is deferred because there is no second LLM verification call.

---

## 2. Target contract

### 2.1 Static Phase 1 strategy catalog

Add `src/services/rag/strategyCatalog.ts` with a readonly, canonical set of seven entries. Each entry has a stable `id`, internal `type`, agent-facing `label`, `tone`, `retentionFocus`, and selection guidance for the prompt.

| ID | Type | Agent-facing label |
|---|---|---|
| `strat_goodwill` | `goodwill_deescalation` | Goodwill & De-escalation |
| `strat_whiteglove` | `white_glove_priority` | White-Glove Priority |
| `strat_concise` | `fast_friction_free` | Fast & Direct |
| `strat_consultative` | `consultative_value_add` | Consultative & Value-Add |
| `strat_reassurance` | `empathetic_reassurance` | Empathetic Reassurance |
| `strat_boundary` | `firm_professional` | Firm Professional |
| `strat_delight` | `proactive_delight` | Proactive Delight |

The LLM receives definitions and must choose from these IDs only. It does **not** control labels, types, tones, or retention descriptions; the server attaches canonical metadata after parsing. This prevents made-up tactics and inconsistent labels.

### 2.2 Multi-draft LLM JSON

Replace the single-response shape with a strict composite output:

```ts
type RawMultiDraftResponse = {
  readonly recommendedStrategyId: RetentionStrategyId;
  readonly recommendationReason: string;
  readonly recommendationGroundedFactsUsed: readonly string[];
  readonly strategies: readonly {
    readonly id: RetentionStrategyId;
    readonly rank: 1 | 2 | 3;
    readonly draftText: string;
    readonly groundedFactsUsed: readonly string[];
    readonly ungroundedClaims: readonly string[];
    readonly confidence: number;
    readonly suggestedAction: SuggestedAction;
    readonly proposedCompensation:
      | { readonly kind: 'none' }
      | { readonly kind: 'voucher'; readonly amountVnd: number };
  }[];
};
```

The API-enriched response adds the canonical strategy fields (`type`, `label`, `tone`, `retentionFocus`) and server-derived `isBestMatch`; it never accepts them from the model.

Validation rules before any model output is usable:

- exactly 2–3 strategies;
- catalog IDs and ranks are unique, and ranks form a contiguous sequence beginning at 1;
- `recommendedStrategyId` is the rank-1 strategy;
- all drafts contain non-empty, bounded text and a valid confidence/action value;
- normalized `draftText` values are not identical;
- compensation metadata is structurally valid;
- recommendation citations and per-draft citations are limited to known fact references.

### 2.3 Grounding reference catalog

Current validation only recognises numeric Layer 3 evidence IDs. That is incompatible with the planned examples such as order-status and customer-tier references, and allows arbitrary non-numeric strings to pass. Add a deterministic, in-memory fact catalog built from the already retrieved `FullCustomerContext`:

- `evidence:<id>` — Layer 3 `CustomerEvidence`, retaining evidence text, observation time, and its stored confidence;
- order/conversation/customer-profile references — only specific, prompt-exposed facts, with source entity, `updatedAt`/observed time, and deterministic confidence `1`;
- `policy:<code>` — applicable static store-policy references.

The LLM sees only these internal reference keys and their human-readable evidence. Customer-facing `draftText` must never reproduce the keys.

This lets every personalization claim cite a source from Layer 1, 2, or 3 while retaining traceability. It also lets the recommendation rationale cite the facts on which its ranking depends.

---

## 3. Backend implementation sequence

### A. Extend RAG contracts and Zod schemas

**Modify** `src/types/rag.ts`, `src/types/workspace.ts`, and `src/types/index.ts`.

- Add retention-strategy, compensation, multi-draft response, per-strategy grounding, and aggregate grounding types.
- Change `RagDraft` from one `response + grounding` pair to one multi-draft response plus a grounding result keyed by strategy ID.
- Keep `SuggestedAction` unchanged.
- Add `internal_label_exposure` to the grounding-violation union.

**Modify** `src/forms/ragForm.ts`.

- Keep `ragGenerateSchema` request validation unchanged.
- Replace `ragResponseSchema` with a strict raw multi-draft Zod schema and small logical validators for cross-field rules Zod cannot express cleanly (rank sequencing, recommendation match, unique draft text).
- Bound text, rationale, citation, and strategy-array sizes to prevent malformed provider output from becoming UI payload.

### B. Create catalog and context-to-fact adapter

**Add** `src/services/rag/strategyCatalog.ts` and a focused grounding-fact helper (either in `src/utils/rag/groundingUtils.ts` or a new `src/services/rag/groundingFacts.ts`).

- Export the catalog, its ID/type unions, prompt formatter, lookup helper, and duplicate guards.
- Build the allowed fact-reference map from `FullCustomerContext`; do not query Prisma again.
- Restrict profile references to facts useful in Phase 1 and prevent the prompt from treating raw buyer identifiers as a personalization source.

### C. Replace the prompt format

**Modify** `src/utils/rag/promptUtils.ts` (re-exported through `src/services/rag/promptTemplates.ts`).

- Replace `RESPONSE_JSON_FORMAT` with the multi-draft JSON contract.
- Add a `RETENTION STRATEGY CATALOG` section built from the static catalog.
- Add explicit generation instructions: choose 2–3 strategies, make each response materially different in approach, rank them, cite all customer-specific claims, and nominate rank 1.
- State that profile tiers, scores, RFM labels, strategy IDs, evidence IDs, and internal reasoning are never customer-facing text.
- Use customer-friendly alternatives such as “khách hàng thân thiết”, “khách hàng ưu tiên”, or appreciation for continued support only when the referenced data supports it.
- Require `proposedCompensation` to match every voucher/compensation commitment in a draft.
- Include the new allowed fact catalog rather than telling the model that only numeric Layer 3 IDs are valid.
- Ensure the top-level recommendation rationale is agent-facing, concise, evidence-cited, and does not include raw buyer identifiers.

### D. Generate once, parse once, validate each candidate

**Modify** `src/services/rag/llmService.ts`, `src/utils/rag/llmUtils.ts`, and `src/services/rag/index.ts`.

- Add a multi-draft single-completion method that selects one configured provider and calls it once.
- Parse with the new multi-draft schema; add `providerUsed` server-side.
- Rename/replace the single-response orchestrator with `generateGroundedMultiDraftResponse(conversationId)`.
- Correct the current latest-message selector: it must select the newest `senderType.code === 'buyer'`, not any human message. The existing predicate can accidentally use a seller reply as the prompt input.
- Build context once, construct prompts once, request one completion once, then validate all returned strategies against that same snapshot.

### E. Validate safety candidate by candidate

**Modify** `src/utils/rag/groundingUtils.ts` (re-exported by `src/services/rag/groundingValidator.ts`).

For every strategy independently:

- verify all cited references against the allowed fact catalog;
- reject a candidate that reports any `ungroundedClaims`;
- detect PII, internal segmentation/classification labels, and tier-cap policy violations in `draftText`;
- enforce voucher caps from the actual tier: Standard `0`, Silver `10,000`, Gold `25,000`, Platinum `50,000` VND;
- compare compensation-related amount wording to `proposedCompensation`, while not mistaking a product price for a compensation offer;
- calculate per-draft precision and downgrade unsafe candidates rather than merely changing their suggested action.

Reset or avoid global regular-expression state on every validation. The current global PII regexes use `.test()`, which can carry `lastIndex` across multiple drafts and miss violations after the first test.

Validate the recommendation citations too. Then:

1. retain only safe candidates;
2. if fewer than two remain, throw a typed safe-generation error that contains counts/reasons but no rejected text;
3. sort surviving drafts by their original rank;
4. if the original recommendation remains, retain its evidence-cited rationale;
5. if it was filtered out, select the highest-ranked safe candidate and replace the rationale with a deterministic agent-facing notice that safety filtering changed the recommendation;
6. enrich each remaining candidate from the canonical catalog and derive exactly one `isBestMatch`.

### F. API route and error behavior

**Modify** `src/app/api/rag/generate/route.ts` and `src/hooks/useRagGenerate.ts`.

- The request stays `{ conversationId }`; no client-side strategy input is accepted.
- Return the new multi-draft `RagDraft` response.
- Preserve `400` malformed request and `404` missing conversation.
- Return `422` for a valid model payload that cannot produce a safe set of at least two drafts, with an agent-safe error such as “No safe comparison set was generated. Try again or write a response manually.”
- Return a retriable provider/generation error for the single-completion failure without exposing provider output or prompt data.
- Update the hook’s response type and error handling without changing its mutation API to `ChatPanel`.

---

## 4. UI implementation sequence

### A. Make the preview a strategy comparer

**Modify** `src/components/chat/ChatPanel.tsx` and `src/components/copilot/AiResponsePreview.tsx`.

- Keep one local generated result per active conversation; clear it immediately when the active conversation changes.
- Initialize `selectedStrategyId` from `recommendedStrategyId` every time a new result arrives.
- Render accessible tab buttons/cards for each surviving strategy, using the canonical agent-facing label and tone.
- Display a clear “AI recommendation” badge on the recommended option and a rationale banner above the selected draft.
- Selecting a tab swaps the displayed text, action state, confidence, citations, and grounding result locally. It does not call the API again.
- Preserve mobile/keyboard accessibility: tab controls have an accessible selected state and action buttons operate on the selected strategy only.

### B. Grounding annotation and approval behavior

**Modify** `src/components/copilot/GroundingAnnotation.tsx`, `src/components/copilot/CopilotActions.tsx`, `src/actions/conversationActions.ts`, and relevant workspace types.

- Feed `GroundingAnnotation` the selected strategy’s validation result rather than the old aggregate single-result data.
- Show only citations for the selected strategy plus any safe recommendation citations in its rationale banner.
- Approve sends the selected strategy’s text, citations, confidence, and suggested action through the existing save action. It must never accidentally persist the recommended draft when an agent selected another tab.
- Switching drafts resets the text editor to that strategy’s original `draftText`.
- When edited text differs from the original, label it “Edited by agent — original AI grounding applies only to the unedited draft.” Do not leave a green “validated” statement attached to changed text.
- Before save, re-run deterministic outbound checks in the server action using a fresh context snapshot. Block PII, internal-label, voucher-cap, and unknown-citation failures. This does not claim to prove new human-written factual claims.
- Reject dismisses the complete multi-draft preview. Existing manual-send behavior remains unchanged.

No new database column is required for this Phase 1 UI. The existing `Message` metadata continues to preserve the approved draft’s citations, confidence, and suggested action.

---

## 5. Tests and verification

### Automated unit tests

Update existing RAG tests and add focused multi-draft tests under `test/rag/`:

1. **Catalog contract:** all seven IDs are unique, immutable, and map to canonical metadata.
2. **Schema/parser:** accepts 2–3 valid, distinct candidates; rejects duplicate IDs/ranks/text, unsupported IDs, mismatched recommendation/rank, malformed compensation, and invalid JSON.
3. **Prompt:** includes all seven strategy definitions, the multi-draft JSON contract, citation instructions, and the no-internal-label rule.
4. **Grounding:** validates each draft independently; rejects unknown references, self-reported unsupported claims, PII, tier labels, and excessive/mismatched compensation.
5. **Regex regression:** two consecutive draft validations both detect their own phone/email/card exposure, proving global regex state cannot leak between candidates.
6. **Filtering/reranking:** retains a safe set of two or three; safely reranks when a non-leading or leading candidate is removed; throws the typed safe-generation error when fewer than two survive.
7. **Orchestration:** mocks context and the LLM client; verifies the newest buyer message is used, context is built once, and exactly one completion method is invoked.
8. **LLM service:** updates the provider mock fixture to return the new composite JSON and verifies the strict single-completion path.

### Manual acceptance checks

1. Generate a delivery/complaint response with seeded VIP context. The UI shows 2–3 visibly different tactics, opens on the recommendation, and presents its rationale.
2. Switch all strategy tabs. Text, action badge, confidence, citations, and approval payload follow the selected tab.
3. Approve a non-recommended draft and confirm the saved message contains that draft’s text and metadata.
4. Edit a draft. Confirm the UI visibly removes the “validated original” implication and server-side deterministic checks still block unsafe content.
5. Force an invalid citation, exposed phone number, tier label, and over-cap voucher in one mock candidate. Confirm it never reaches the UI.
6. Force only one safe candidate. Confirm the UI receives an actionable error and no unsafe/single partial preview.
7. Confirm the generated customer text does not contain `VIP`, `Platinum`, `Gold`, `Silver`, `Standard`, `RFM`, raw evidence IDs, or strategy IDs.

Run:

```bash
npx vitest run
npm run lint
npm run build
```

---

## 6. Files affected

| File | Change |
|---|---|
| `src/types/rag.ts` | Multi-draft, strategy, compensation, and grounding types |
| `src/types/workspace.ts` | Browser-safe multi-draft contract |
| `src/types/index.ts` | Re-export new types |
| `src/forms/ragForm.ts` | Strict composite LLM output schema |
| `src/services/rag/strategyCatalog.ts` | **New** Phase 1 static strategy catalog |
| `src/services/rag/llmService.ts` | One-completion multi-draft generation path |
| `src/services/rag/index.ts` | Multi-draft orchestration and buyer-message correction |
| `src/utils/rag/llmUtils.ts` | Composite parser and strict call support |
| `src/utils/rag/promptUtils.ts` | Strategy/catalog/fact-citation prompt contract |
| `src/utils/rag/groundingUtils.ts` | Fact catalog, per-candidate filtering, jargon/voucher checks |
| `src/app/api/rag/generate/route.ts` | New response and safe error mapping |
| `src/hooks/useRagGenerate.ts` | Updated API payload type |
| `src/components/chat/ChatPanel.tsx` | Store/reset multi-draft preview state |
| `src/components/copilot/AiResponsePreview.tsx` | Strategy tabs, selected-draft actions, edit warning |
| `src/components/copilot/GroundingAnnotation.tsx` | Selected-draft annotations |
| `src/components/copilot/CopilotActions.tsx` | Selected-draft approval integration as needed |
| `src/actions/conversationActions.ts` | Fresh deterministic safety check before AI-draft save |
| `test/rag/*.test.ts` | Updated single-response tests and new multi-draft coverage |

## 7. Definition of done

- One Generate click produces one model completion and, on success, two or three safe, materially distinct tactics from the fixed seven-item catalog.
- The backend canonicalizes strategy metadata and validates every candidate independently against the same 3-layer context snapshot.
- No unsafe candidate, internal tier terminology, unsupported citation, PII leak, or over-cap compensation reaches the customer-facing draft UI.
- The recommended safe strategy is selected by default; agents can compare and approve any safe alternative without regeneration.
- Edited content is clearly distinguished from its original grounded draft and still receives deterministic outbound safety checks.
- Unit tests, lint, and production build pass.
