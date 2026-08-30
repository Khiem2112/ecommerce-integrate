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
| **TypeScript** | [`.agents/skills/typescript/SKILL.md`](.agents/skills/typescript/SKILL.md) | `type` over `interface`, no `any`, explicit returns, naming conventions, immutability, barrel imports. |
| **Styling** | [`.agents/skills/styling/SKILL.md`](.agents/skills/styling/SKILL.md) | Tailwind CSS utility classes, `cn()` helper, layout tokens, component state variants. |
| **UI Styling** | [`.agents/skills/ui-styling/SKILL.md`](.agents/skills/ui-styling/SKILL.md) | shadcn/Radix primitive implementation in `src/components/atoms/`, accessible primitives, Tailwind theming. |
| **React** | [`.agents/skills/react/SKILL.md`](.agents/skills/react/SKILL.md) | Function components, props typing, atomic architecture, stable keys, Jotai & RHF, skeletons/empty states. |
| **Next.js** | [`.agents/skills/nextjs/SKILL.md`](.agents/skills/nextjs/SKILL.md) | Layered flow (`Component → Hook → Action/Route → Service → DB`), Server Actions, API routes, TanStack Query. |
| **Checklist** | [`.agents/skills/checklist/SKILL.md`](.agents/skills/checklist/SKILL.md) | Technical pre-commit and PR completion checklist. |
| **Ambiguous Specs** | [`.agents/skills/implement-qa/SKILL.md`](.agents/skills/implement-qa/SKILL.md) | File-based Q&A workflow (`QA/QA-<topic>.md`) when requirements are unclear. |
| **Business Logic** | [`.agents/skills/business-logic/SKILL.md`](.agents/skills/business-logic/SKILL.md) | Domain business logic catalog (`features/vip_customer_routing.md`, `features/omnicart_recovery.md`). |

---

## 2. Universal Layered Architecture

```
[ UI / React Components (src/components/) ]
                    ↓
[ Custom Hooks & TanStack Query (src/hooks/) ]   +   [ Jotai Atoms (src/atoms/) ]
                    ↓
[ Server Actions (src/actions/) ]     /   [ Dedicated API Routes (src/app/api/) ]
                    ↓ (orchestrates & passes `tx` context if in a transaction)
[ Services & Business Logic (src/services/) ]
  ├── DB operations (via `prisma` or injected `tx`)
  ├── External APIs (Payment, AI, Logistics)
  ├── File I/O (Logs, Reports, PDFs)
  └── Orchestrates Sub-Services
                    ↑ (can be called anywhere)
[ Pure Utils (src/utils/) ] (Pure, stateless functions — NO DB, NO API, NO File I/O)
                    ↓
[ Prisma Client Singleton (src/lib/prisma.ts) ]
                    ↓
[ Database ]
```

### Core Layer Responsibilities
- **UI Components (`src/components/`)**: Houses all UI layers (universal primitive atoms in `src/components/atoms/` and domain/feature components). For component primitives, shadcn UI installation, and styling conventions, refer to [`ui-styling`](.agents/skills/ui-styling/SKILL.md) and [`styling`](.agents/skills/styling/SKILL.md).
- **Server Actions (`src/actions/`)**: Orchestrates Services, validates input payloads (Zod), manages atomic transactions via `prisma.$transaction` passing `tx` to Services, handles cache revalidation, and returns standardized `{ success, data, error }`.
- **Services (`src/services/`)**: Execution hub for ALL business logic. Single-responsibility functions. Performs DB queries (accepting optional `tx`), calls external APIs, reads/writes files, and orchestrates sub-services.
- **Utils (`src/utils/`)**: Pure and stateless functions ONLY. Used strictly for formatting (currency/dates), regex validations, string parsing, and prompt building. **MUST NOT** touch DB, call APIs, or perform File I/O.

---

## 3. Quick Reference — Technical Violations to Avoid

| Violation | Correct Approach | Reference Skill |
| :--- | :--- | :--- |
| `any` type | Use `unknown` + type narrowing | `typescript` |
| `interface` for props/shapes | Use `type Props = { ... }` | `typescript` |
| Direct `prisma.*` in Action | Move query to a Service in `src/services/` | `nextjs` |
| Multiple DB operations in Action without transaction | Wrap in `prisma.$transaction` in Action and pass `tx` to Services | `nextjs` |
| Service calling Action | Services are self-contained; Actions call Services | `nextjs` |
| Monolithic multi-task Service | Break into single-responsibility service functions | `nextjs` |
| Over-fragmenting simple helpers into `utils/` | Keep small 1–2 line private helpers directly inside the service file; only extract to `src/utils/` when complex/reused | `nextjs` |
| DB / API / File I/O inside `src/utils/` | Utils must be pure & stateless; move all I/O to `src/services/` | `nextjs` |
| Creating ad-hoc primitives outside `src/components/atoms/` | Place/install generic shadcn primitive components in `src/components/atoms/` | `ui-styling` / `react` |
| Arbitrary hex colors in primitives (`bg-[#...]`) | Use semantic CSS tokens from `src/app/globals.css` via Tailwind v4 `@theme inline` | `styling` |
| Inline styles `style={{ ... }}` | Use Tailwind CSS utility classes | `styling` |
| String interpolation for classes | Use `cn('base-class', condition && 'active')` from `@/lib/cn` | `styling` |
| Redux / Formik | Use Jotai for atoms and React Hook Form + Zod for forms | `react` / `nextjs` |
| SWR for data fetching | Use TanStack Query (`@tanstack/react-query`) | `nextjs` |
| Array index as React `key` | Use unique, stable IDs | `react` |
| Missing error handling in Action | Catch exceptions and return `{ success: false, error }` | `nextjs` |
| Positional / Step marker comments (`// 1. ...`, `// Step X`) | Use descriptive intent comments on code blocks without positional numbering | `typescript` |



