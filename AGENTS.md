# Project Agent Guidance

## Skill Loading Policy

Do not read all skills before starting a task. Load the smallest relevant set.

### Backend, API, data, or business logic

When the task changes VIP routing, customer/order claims, RAG evidence, privacy, or externally visible support operations, also read `.agents/rules/RULE.md` for project-specific guardrails.

Use:

- `.agents/skills/convention/SKILL.md`
- `.agents/skills/nextjs/SKILL.md`
- `.agents/skills/typescript/SKILL.md`
- `.agents/skills/business-logic/SKILL.md` when domain behavior is involved
- `.agents/skills/checklist/SKILL.md` for review or delivery

Do not load UI/UX skills unless the task also changes user-facing behavior.

### React or UI implementation

Before creating or visually changing a user-facing feature:

1. Read `.agents/skills/ui-ux-pro-max/rules/style-discovery.md` and reuse the closest persisted or repository style precedent.
2. Read `.agents/skills/ui-ux-pro-max/rules/web-rules.md` for UX, accessibility, responsive, interaction, and e-commerce requirements.
3. Use `design-system/*/MASTER.md` plus the matching page override when discovered; otherwise inspect `src/app/globals.css`, shared components, and the closest existing feature before inventing a new pattern.

Skill Loading:
- **Core Baseline (always load for UI):**
  - `.agents/skills/convention/SKILL.md`
  - `.agents/skills/styling/SKILL.md`
- **On-demand (load only when relevant):**
  - `.agents/skills/react/SKILL.md` when creating/refactoring components, managing state (Jotai), forms (RHF), effects, or loading/empty states.
  - `.agents/skills/typescript/SKILL.md` when defining complex types, interfaces, generics, or type-safe mappers.
  - `.agents/skills/ui-styling/SKILL.md` only for shadcn/Radix primitives or Tailwind theme customization.
  - `.agents/skills/ui-ux-pro-max/SKILL.md` only when focused design intelligence/search is needed.

### Web UI/UX design or review

Use:

- `.agents/skills/ui-ux-pro-max/rules/style-discovery.md`
- `.agents/skills/ui-ux-pro-max/rules/web-rules.md`
- `.agents/skills/ui-ux-pro-max/SKILL.md` when focused design intelligence/search is needed
- `.agents/skills/styling/SKILL.md` or `.agents/skills/ui-styling/SKILL.md` only when implementation is required

### Design system

Use:

- `.agents/skills/ui-ux-pro-max/rules/style-discovery.md`
- `.agents/skills/design-system/SKILL.md`
- `.agents/skills/ui-ux-pro-max/SKILL.md` when design intelligence/search is needed

Check `design-system/<project>/MASTER.md` and its relevant page override before creating new system-wide tokens. Do not persist a design system for an ordinary one-page feature unless a documented persist trigger applies.

### Ambiguous Requirements & QA

- `.agents/skills/implement-qa/SKILL.md` only when requirements are materially ambiguous.
