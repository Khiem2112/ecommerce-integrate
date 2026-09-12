---
name: ecommerce-operations-flow
description: >
  Defines project-specific operational user-flow design for OmniCart Recover. Use before
  implementing a new or materially changed operator journey, state-changing workflow,
  exception flow, approval flow, or long-running integration flow.
---

# E-commerce Operations Flow

Use this skill to turn a product request into an implementation-neutral, project-specific
flow specification before coding. It designs how an OmniCart operator understands, decides,
acts, observes progress, and recovers. It does not select a visual language, component API,
route structure, data schema, or implementation architecture.

## Required Context

Before designing a flow, read:

1. `PRODUCT.md`.
2. The closest applicable business-rule file under `.agents/skills/business-logic/features/`.
3. `.agents/rules/RULE.md` when the work affects VIP routing, customer or order claims, RAG
   evidence, privacy, or externally visible support operations.
4. Existing approved specifications in `docs/flows/` and the closest existing feature when
   changing an established journey.

Treat `PRODUCT.md` and the project rules as higher authority than generic UX guidance.

## Workflow

1. Define the operational problem, actor, trigger, intended outcome, scope, and non-goals.
2. Identify durable states, state transitions, decision owners, permissions, and consequential
   actions. Include the normal path and every meaningful branch.
3. Specify what the operator sees while data loads, when no work exists, when data is stale,
   and when partial or total failure occurs.
4. Specify recovery: retry eligibility, duplicate prevention, resume behavior, escalation,
   and the audit or history needed to understand the outcome.
5. Write `docs/flows/<feature-name>.md` from `docs/flows/TEMPLATE.md`. Keep it
   implementation-neutral.
6. Obtain explicit approval and record it in the specification. Do not treat a draft, an
   implementation plan, or a verbal preference as approved.
7. Only after approval, implement the flow under the existing React, Next.js, component,
   design-system, domain, and technical rules.
8. If requested after implementation, use `impeccable` to audit or refine visual quality,
   accessibility, responsive behavior, and polish. This is a follow-up quality pass, not a
   replacement for product-flow design.

## Interaction and Analysis Skills

Use the project's local specialized flow skills on-demand to enrich the specification:

### 1. Discovery & Analysis
- `.agents/skills/jtbd-framing/SKILL.md`: Uncover the operator's core job, struggling moments, and decision criteria.
- `.agents/skills/journey-mapping/SKILL.md`: Map multi-step operator workflows, identify friction points, and delineate handoffs.
- `.agents/skills/information-architecture/SKILL.md`: Structure navigation, page hierarchy, and module taxonomy.

### 2. Interaction Patterns & Recovery
- `.agents/skills/flow-tables/SKILL.md`: Design data-heavy tables, filters, sort persistence, pagination, and bulk actions.
- `.agents/skills/flow-forms/SKILL.md`: Design credential inputs, sync configuration, inline validation, and work preservation.
- `.agents/skills/flow-errors/SKILL.md`: Error anatomy, actionable recovery steps, retry eligibility, and undo over confirm.
- `.agents/skills/flow-empty-states/SKILL.md`: Contextual empty states, first-run orientation, zero-result search recovery.
- `.agents/skills/flow-settings/SKILL.md` & `.agents/skills/flow-permissions/SKILL.md`: Channel connection settings, danger zones, and role-based permissions.
- `.agents/skills/flow-app-shell/SKILL.md` & `.agents/skills/flow-navigation/SKILL.md`: Dashboard layout, master-detail views, responsive navigation.

Adapt any generic pattern to OmniCart's merchant-operations constraints, authority rules, and idempotency guarantees. The local specification in `docs/flows/` is the authoritative project artifact produced by this workflow.

## Flow Specification Standard

A flow specification must include:

- The actor, trigger, job, intended outcome, scope, and explicit non-goals.
- Preconditions, source of truth, permissions, and relevant operational constraints.
- A state model with durable states and terminal outcomes.
- The primary path in ordered, user-observable steps.
- Decision branches, including user choices, system checks, and ownership handoffs.
- Loading, empty, stale, partial-success, error, cancellation, and retry or resume behavior.
- Duplicate-submission, idempotency, confirmation, and audit/history expectations for
  consequential actions.
- Acceptance criteria written as observable outcomes, not implementation tasks.
- An approval record with status, approver, and date.

Use concise language. Describe behavior and information needs, not JSX, CSS, endpoint names,
component names, database fields, or library choices.

## Approval Gate

A flow is approved only when its `Approval` section says `Approved` and identifies the
approver and approval date. If a requirement changes the flow's actors, decisions, state model,
consequential actions, recovery behavior, or acceptance criteria, return the specification to
`Draft` and seek approval again before implementing that change.

Small visual-only refinements and behavior-preserving bug fixes do not require a new flow
specification. A new specification is required for a new or materially changed operational
journey.

## Handoff To Implementation

After approval, implementation work must:

- Follow the approved behavior exactly or update the specification before changing it.
- Apply the project's UI style-discovery and web rules before changing a user-facing surface.
- Reuse the existing design system; the flow phase must not invent a visual language.
- Follow applicable domain, privacy, evidence, and technical architecture rules.
- Preserve an operator-visible path to understand state, failure, and recovery.
