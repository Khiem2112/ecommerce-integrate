# Operational Flow Specifications

This directory contains implementation-neutral specifications for material OmniCart operator
journeys. They are the approval bridge between product intent and code.

## Lifecycle

1. Start a draft from `TEMPLATE.md`.
2. Apply `PRODUCT.md`, applicable business rules, and
   `.agents/skills/ecommerce-operations-flow/SKILL.md`.
3. Record the primary path, decisions, states, recovery behavior, and acceptance criteria.
4. Obtain explicit approval in the specification.
5. Implement only after its status is `Approved`.
6. Update the specification and re-approve it if the behavior materially changes.

## Status Values

- `Draft`: being defined; not implementation input.
- `In review`: ready for a decision; not implementation input.
- `Approved`: explicit product approval recorded; implementation may begin.
- `Superseded`: replaced by a newer approved specification.

Do not use this directory for UI mockups, component design, API contracts, database schemas, or
implementation plans. Link to those artifacts from an approved flow only when needed.
