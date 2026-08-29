---
name: omnicart-vip-routing-rules
description: >
  Project-specific domain, privacy, and evidence-grounding guardrails for the
  OmniCart VIP Customer Care & Routing subsystem.
alwaysApply: true
---

# OmniCart VIP Customer Care and Routing Rules

Keep this always-applied rule limited to project-specific constraints. General Next.js, TypeScript, React, styling, comments, and workflow conventions belong to their dedicated skills.

## Project Scope

OmniCart Recover is an omni-channel e-commerce integration and recovery platform for Lazada, Shopee, TikTok Shop, and Shopify. This repository implements its VIP Customer Care and Routing subsystem:

- identify high-value buyers from pseudonymized marketplace order histories;
- provide evidence-grounded AI co-pilot support using three-layer RAG memory;
- route inquiries to Logistics, Refund, Product Info, or Escalation workflows; and
- support the Human Only, Co-Pilot, and Autonomous AI experiment under marketplace data scarcity.

## Project-Specific Safety Rules

- Treat customer, order, tracking, refund, and eligibility statements as evidence-bound claims. Do not present a claim as fact unless it is supported by the retrieved Layer 1-3 context or a verified system record.
- Do not de-anonymize buyers, reconstruct masked PII, or add identifiers that are not required for the requested workflow.
- Keep AI drafts distinguishable from verified facts and preserve the evidence needed for a human agent to review a recommendation.
- Treat status changes, sends, refunds, escalations, and other externally visible operations as consequential. Validate input, report failure clearly, and avoid duplicate execution.
- When policy evidence is absent, contradictory, or stale, surface the uncertainty and route the decision for human review instead of inventing a policy outcome.

## Project Boundaries

- Standard mutations and human approvals belong in Server Actions; streaming AI, marketplace webhooks, and external integrations belong in dedicated API routes.
- Business rules, RAG context assembly, database access, and integration orchestration belong in services. UI components and hooks must not access Prisma directly.
- Use TanStack Query for client-server data fetching and Jotai only for lightweight client UI state.
- Follow the project skills for generic implementation rules: `convention`, `nextjs`, `typescript`, `react`, `styling`, `business-logic`, and `implement-qa`.

## Requirement Gaps

When a domain requirement is materially ambiguous, do not guess. Use the `implement-qa` workflow and resolve the answer before encoding VIP tier, routing, refund, eligibility, or RAG policy behavior.
