---
name: convention
description: >
  Master coding convention controller for Next.js App Router, TypeScript, Server Actions, TanStack Query, Jotai, React Hook Form (RHF), and Prisma MySQL.
---

# Master Coding Conventions Skill

This skill acts as the master index for all engineering, architectural, and coding standards in the project.

---

## 1. Sub-Skills Directory

When writing, refactoring, or reviewing code, consult the dedicated technical skills:

| Area | Skill File | Topics Covered |
| :--- | :--- | :--- |
| **TypeScript** | [`skills/typescript/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/typescript/SKILL.md) | `type` over `interface`, no `any`, explicit returns, naming conventions, immutability, barrel imports. |
| **Styling** | [`skills/styling/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/styling/SKILL.md) | Tailwind CSS utility classes, `cn()` helper, layout tokens, component state variants. |
| **React** | [`skills/react/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/react/SKILL.md) | Function components, props typing, `useCallback`, stable keys, Jotai & RHF, skeletons/empty states. |
| **Next.js** | [`skills/nextjs/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/nextjs/SKILL.md) | Layered flow (`Component → Hook → Action/Route → Service → DB`), Server Actions, API routes, TanStack Query. |
| **Checklist** | [`skills/checklist/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/checklist/SKILL.md) | Technical pre-commit and PR completion checklist. |
| **Ambiguous Specs** | [`skills/implement-qa/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/implement-qa/SKILL.md) | File-based Q&A workflow (`QA/QA-<topic>.md`) when requirements are unclear. |
| **Business Logic** | [`skills/business-logic/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/business-logic/SKILL.md) | Domain business logic catalog (`features/vip_customer_routing.md`, `features/omnicart_recovery.md`). |

---

## 2. Universal Layered Architecture

```
[ UI / React Components (src/components/) ]
                    ↓
[ Custom Hooks & TanStack Query (src/hooks/) ]   +   [ Jotai Atoms (src/atoms/) ]
                    ↓
[ Server Actions (src/actions/) ]     /   [ Dedicated API Routes (src/app/api/) ]
                    ↓
[ Services & Business Logic (src/services/) ]   ↔   [ Complex Domain Utils (src/utils/) ]
                    ↓
[ Prisma Client Singleton (src/lib/prisma.ts) ]
                    ↓
[ Database ]
```

---

## 3. Quick Reference — Technical Violations to Avoid

| Violation | Correct Approach | Reference Skill |
| :--- | :--- | :--- |
| `any` type | Use `unknown` + type narrowing | `typescript` |
| `interface` for props/shapes | Use `type Props = { ... }` | `typescript` |
| Direct `prisma.*` in Action | Move query to a Service in `src/services/` | `nextjs` |
| Service calling Action | Services are self-contained; Actions call Services | `nextjs` |
| Over-fragmenting simple helpers into `utils/` | Only extract `src/utils/<domain>/` for services with many/complex helpers; keep simple 1–2 helpers inside the service file | `nextjs` |
| Inline styles `style={{ ... }}` | Use Tailwind CSS utility classes | `styling` |
| String interpolation for classes | Use `cn('base-class', condition && 'active')` | `styling` |
| Redux / Formik | Use Jotai for atoms and React Hook Form + Zod for forms | `react` / `nextjs` |
| SWR for data fetching | Use TanStack Query (`@tanstack/react-query`) | `nextjs` |
| Array index as React `key` | Use unique, stable IDs | `react` |
| Missing error handling in Action | Catch exceptions and return `{ success: false, error }` | `nextjs` |
| Positional / Step marker comments (`// 1. ...`, `// Step X`) | Use descriptive intent comments on code blocks without positional numbering | `typescript` / `ponytail` |


