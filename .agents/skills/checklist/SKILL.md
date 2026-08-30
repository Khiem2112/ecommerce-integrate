---
name: pre-commit-checklist
description: >
  Pre-commit technical and architectural checklist. Verifies layering, type safety, error boundaries, data integrity, and references business-logic skill.
---

# Feature Completion & Pre-Commit Checklist

Before declaring any feature or task complete, verify the technical implementation against these architectural standards:

---

## 1. Architectural Layering
- [ ] Do React components live in `src/components/` and use named Function Components?
- [ ] Do Server Actions (`src/actions/`) orchestrate services, validate input schemas (Zod), and manage atomic transactions via `prisma.$transaction` passing `tx` down to Services?
- [ ] Do Services (`src/services/`) handle all business logic, DB queries (accepting optional `tx`), external API calls, and file I/O with single-responsibility functions?
- [ ] Are Utils (`src/utils/`) strictly pure and stateless functions (formatting, regex, math, prompts) with NO database access, NO external API calls, and NO file I/O (with small, single-service helpers kept directly inside the service file to avoid over-fragmentation)?

- [ ] Are dedicated API Routes (`src/app/api/`) used for streaming, RAG generation, or webhooks?
- [ ] Are form schemas and validation placed in `src/forms/` using Zod?
- [ ] Are domain types modularized in `src/types/`?


---

## 2. TypeScript & Coding Standards
- [ ] Are all object shapes and props typed with `type` (no `interface`)?
- [ ] Is `any` completely avoided (`unknown` + type guards used instead)?
- [ ] Are public service/action functions explicitly typed with return promises?
- [ ] Are constants in `UPPER_CASE` and variables/functions in `camelCase`?
- [ ] Are code blocks commented with meaningful domain intent without positional numbering / step markers (no `// 1. ...`, `// Step X`)?



---

## 3. Styling, UI & Accessibility
- [ ] Are universal primitive components (Button, Table, Badge, Autocomplete/Combobox, Input, Dialog, etc.) placed in `src/components/atoms/` using shadcn/Radix foundations?
- [ ] Are all UI components styled using Tailwind CSS utility classes and design tokens from `src/app/globals.css` (no inline styles or ad-hoc hex values)?
- [ ] Is dynamic class merging handled using the `cn()` utility from `@/lib/cn`?
- [ ] Do higher-level business components compose primitive atoms cleanly with domain logic?
- [ ] Are interactive elements accessible (visible labels/`aria-label`, visible `:focus-visible` rings, semantic controls)?
- [ ] Does the UI adapt responsively across mobile (~375px) and desktop layouts without overflow?
- [ ] Are loading skeletons and empty states handled explicitly (layout-stable, clear next actions)?
- [ ] Do contrast (WCAG AA 4.5:1 for text) and interaction states (hover/active/disabled) work properly?

---

## 4. State & Data Fetching
- [ ] Is client global state managed using Jotai atoms (no Redux)?
- [ ] Is client-side data fetching and revalidation managed via TanStack Query (no SWR)?

---

## 5. Domain Business Logic Verification
- [ ] **Check Domain Rules**: Consult the [business-logic skill](.agents/skills/business-logic/SKILL.md) and verify that all feature-specific rules in `features/` are satisfied.
