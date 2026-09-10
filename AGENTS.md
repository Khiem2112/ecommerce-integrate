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
- `.agents/skills/db-conventions/SKILL.md` when adding or modifying Prisma models

Do not load UI/UX skills unless the task also changes user-facing behavior.

### Product Context And Operational Flow Planning

For a new or materially changed user-facing operational journey, establish the product flow before coding:

1. Read `PRODUCT.md` to ground the work in OmniCart's merchant-operations scope; it is not a storefront.
2. Read `.agents/skills/ecommerce-operations-flow/SKILL.md` and the applicable domain rules.
3. Consult `jpoindexter/ux-flow-skills` selectively only as a generic pattern source for branches, loading, empty, error, and recovery states. It must not design the product flow, override local context, or create local files.
4. Consult `rampstackco/claude-skills` only when optional UX research or information-architecture guidance is still needed after project context and existing patterns are reviewed.
5. Write or update an implementation-neutral specification in `docs/flows/<feature-name>.md` using `docs/flows/TEMPLATE.md`.
6. Obtain explicit approval recorded in that specification before implementing the material flow change.
7. After approval, follow the existing React, Next.js, component, domain, and design-system rules. The flow phase does not decide visual language.
8. Use `.agents/skills/impeccable/SKILL.md` only afterward when a visual-quality, accessibility, responsive, or polish pass is requested.

Do not require a new flow specification for a behavior-preserving bug fix or a small visual-only refinement. When a feature changes operational states, decisions, consequences, recovery, or acceptance criteria, update and re-approve its flow specification before coding.
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
  - `.agents/skills/ui-styling/SKILL.md` for UI component primitives (shadcn/Radix), component installation, or Tailwind theme customization.
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

### Database / Prisma schema

When the task adds, modifies, or reviews Prisma models (`schema.prisma`), writes
migrations, or generates seed/fixture data:

- `.agents/skills/db-conventions/SKILL.md` — **always load first** for any DB schema work
- `.agents/skills/convention/SKILL.md`
- `.agents/skills/business-logic/SKILL.md` when the schema change encodes domain rules

### Ambiguous Requirements & QA

- `.agents/skills/implement-qa/SKILL.md` only when requirements are materially ambiguous.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
