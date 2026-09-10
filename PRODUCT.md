# OmniCart Recover Product Context

## Product Definition

OmniCart Recover is an e-commerce operations tool for merchant teams. It is not a shopper-facing storefront, marketplace listing site, or checkout experience.

The product gives operators a unified workspace for marketplace integrations, order and customer context, recovery workflows, and evidence-grounded customer care. Current and planned integrations include Lazada, Shopee, TikTok Shop, and Shopify.

## Users And Jobs

| User | Primary job | What success means |
| --- | --- | --- |
| Integration operator | Connect a marketplace, inspect sync health, run or recover sync work | Data is current, traceable, and not duplicated or silently lost. |
| Customer-care or sales representative | Understand a buyer and resolve or recover an order | The representative can take the right action with evidence and clear ownership. |
| Operations manager | Monitor recovery, exceptions, workload, and business impact | Exceptions are visible, accountable, and recoverable. |
| Reviewer or approver | Review consequential AI or operational recommendations | The evidence, uncertainty, and next safe action are explicit. |

## Core Operational Work

1. Connect and monitor marketplace integrations.
2. Preview, synchronize, reconcile, and audit marketplace order data.
3. Detect abandoned checkout and recovery opportunities within platform constraints.
4. Prioritize VIP customer care, route support work, and keep AI assistance evidence-grounded.
5. Attribute recovery outcomes, investigate product friction, and manage operational follow-up.

## Product Truths

- Marketplace APIs are authoritative for their supported external order and item fields; OmniCart keeps a local operational read model, audit history, and internal metadata.
- Operational actions can have consequences. Sync, retries, sends, refunds, escalations, and approvals require explicit state, duplicate prevention, clear feedback, and recovery paths.
- Data is often incomplete or delayed. The interface must distinguish verified records, provisional data, stale data, and failed retrievals.
- Marketplace buyer data is pseudonymized or constrained. Do not infer, reconstruct, or expose unnecessary personal data.
- AI outputs are recommendations unless verified by system records or cited evidence. Uncertain, conflicting, stale, or policy-sensitive cases must remain reviewable by a human.
- Long-running work must survive browser refreshes and communicate truthful progress from persisted server-side state; do not simulate completion.

## Scope And Boundaries

In scope:

- Merchant and internal-team operations for integrations, orders, recovery, customer care, routing, audit, and analysis.
- Clear work queues, exception handling, approvals, ownership, progress, and outcomes.
- Marketplace-aware limitations, including official-channel communication and masked PII.

Out of scope unless explicitly requested:

- Consumer catalog browsing, product discovery, cart, checkout, payment, or storefront conversion flows.
- Claims about customer eligibility, delivery, refunds, incentives, or policy that lack verified evidence.
- Fully autonomous consequential actions without the applicable product safety and approval rules.

## Flow Design Priority

Design flows around an operator's decision and recovery loop:

1. Understand the current operational state and scope.
2. Identify the next safe action, its consequence, and its owner.
3. Execute or explicitly approve the action.
4. Observe truthful progress and the durable outcome.
5. Recover from partial failure, stale data, permissions, or external-platform constraints.

A flow should reduce ambiguity, preserve auditability, and make exception handling at least as deliberate as the happy path.

## Sources Of Detailed Rules

- Project-wide domain, privacy, and evidence constraints: `.agents/rules/RULE.md`.
- Recovery behavior: `.agents/skills/business-logic/features/omnicart_recovery.md`.
- VIP care and routing behavior: `.agents/skills/business-logic/features/vip_customer_routing.md`.
- Feature-specific approved flow specifications: `docs/flows/`.
