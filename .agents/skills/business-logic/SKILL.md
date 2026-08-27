---
name: business-logic-check
description: >
  Master business logic verification skill. Routes agents to feature-specific business rules and validates domain completeness before declaring work done.
---

# Business Logic Verification Skill

Before completing a feature or reviewing code, always verify that the implementation adheres to the specific business rules for that domain feature.

---

## Feature Business Logic Catalog

When working on a feature, consult the corresponding specification in `features/`:

| Feature Area | Specification File | Key Rules Covered |
| :--- | :--- | :--- |
| **VIP Customer Care & Routing** | [`features/vip_customer_routing.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/business-logic/features/vip_customer_routing.md) | RFM Tiers, 3-layer memory RAG, anti-hallucination fact citation, specialized agent routing, 3-arm experiment. |
| **OmniCart Order Recovery** | [`features/omnicart_recovery.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/business-logic/features/omnicart_recovery.md) | Abandoned checkout triggers, sequence pacing, multi-channel constraints. |

---

## Universal Business Logic Checklist

Regardless of the feature, always ensure:

1. **Rule Completeness**: All required branches from the feature specification are covered (happy path, error cases, edge conditions).
2. **Error Handling**: Exceptions are caught at the service/action boundary and mapped to clear, user-friendly error messages.
3. **Data Integrity**: Database mutations maintain foreign keys, status progression history, and audit records.
4. **Safety & Grounding**: AI-generated content never hallucinates external facts or violates platform policies.
