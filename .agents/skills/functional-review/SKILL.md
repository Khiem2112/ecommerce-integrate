---
name: functional-review
description: >
  Verifies implementation behavior against existing OmniCart requirements and
  acceptance criteria without applying coding-convention rules. Use through
  code-review when mode=functional or mode=both.
---

# Functional Review

This skill defines a traceability method, not product behavior. Never invent,
copy, or extend business rules here.

## Authoritative Inputs

Load only sources applicable to the review target, in instruction-precedence
order:

1. The current user request and approved acceptance criteria.
2. The target document under `docs/specs/`.
3. The approved document under `docs/flows/` and `PRODUCT.md` when required by
   `AGENTS.md`.
4. [business-logic](../business-logic/SKILL.md) and the feature file it routes
   to when domain behavior is involved.
5. [RULE.md](../../rules/RULE.md) when `AGENTS.md` says its guardrails apply.

Tests, fixtures, API contracts, schema, and existing code provide
implementation evidence. Treat existing behavior as a requirement only when
the task explicitly requires backward compatibility or names it as the
baseline.

If requirements are materially ambiguous, use
[implement-qa](../implement-qa/SKILL.md). Do not convert an assumption into a
finding.

## Functional Review Flow

1. Extract each applicable requirement or acceptance criterion from its source.
2. Trace it to the implementing code path and relevant test evidence.
3. Classify it as `satisfied`, `partial`, `missing`, or `ambiguous`.
4. Check only the branches, failures, recovery behavior, and regressions
   required by those sources or by an explicit compatibility contract.
5. Report a finding only when both requirement evidence and implementation
   evidence support it.

Maintain a private trace while reviewing:

| Requirement source | Expected behavior | Code evidence | Test evidence | Status |
| --- | --- | --- | --- | --- |

Do not treat absent tests as a functional defect unless a source requires the
test or the missing coverage prevents reasonable verification. State the
confidence limitation instead.

## Functional Output

Return:

1. Functional findings ordered by user or system impact.
2. A concise requirement coverage summary.
3. Ambiguities or source conflicts as questions.
4. Targeted validations run, skipped checks, and remaining confidence limits.

Do not emit style, naming, architecture, or type-preference findings. Those
belong to `mode=convention`.
