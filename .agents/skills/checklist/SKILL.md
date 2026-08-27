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
- [ ] Do Server Actions (`src/actions/`) use `'use server'` and delegate database calls to Services?
- [ ] Do Services (`src/services/`) handle all Prisma queries and business workflows?
- [ ] Are utils extracted to `src/utils/<domain>/` only for services with numerous/complex helpers (otherwise kept inside the service file)?
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

## 3. Styling & UI
- [ ] Are all styles built with Tailwind CSS utility classes (no inline styles)?
- [ ] Is dynamic class merging handled using the `cn()` utility?
- [ ] Are loading skeletons and empty states handled explicitly?

---

## 4. State & Data Fetching
- [ ] Is client global state managed using Jotai atoms (no Redux)?
- [ ] Is client-side data fetching and revalidation managed via TanStack Query (no SWR)?

---

## 5. Domain Business Logic Verification
- [ ] **Check Domain Rules**: Consult the [business-logic skill](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/business-logic/SKILL.md) and verify that all feature-specific rules in `features/` are satisfied.
