---
name: pre-commit-checklist
description: >
  Pre-commit technical and architectural checklist. Verifies layering, type safety, error boundaries, data integrity, and references business-logic skill.
---

# Feature Completion & Pre-Commit Checklist

Before declaring any feature or task complete, verify the technical implementation against these architectural standards:

---

## 1. Architectural Layering & Reuse
- [ ] Do React components live in `src/components/` and use named Function Components?
- [ ] Do Server Actions (`src/actions/`) orchestrate services, validate input schemas (Zod), and manage atomic transactions via `prisma.$transaction` passing `tx` down to Services?
- [ ] Are Server Actions free of direct `prisma.*` queries and direct domain business logic?
- [ ] Do Services (`src/services/`) handle all business logic, DB queries (accepting optional `tx`), external API calls, and file I/O with single-responsibility functions (SRP)?
- [ ] Are Utils (`src/utils/`) strictly pure and stateless functions (formatting, regex, math, prompts) with NO database access, NO external API calls, and NO file I/O?
- [ ] Are small 1–2 line private service helpers kept directly inside the service file rather than prematurely extracted into `src/utils/`?
- [ ] Were existing repository atoms, molecules, hooks, schemas, types, and utilities searched and reused before creating new code ([reuse-first](.agents/skills/reuse-first/SKILL.md))?
- [ ] Are dedicated API Routes (`src/app/api/`) used exclusively for streaming, RAG generation, or webhooks?
- [ ] Are form schemas and validation placed in `src/forms/` using Zod?
- [ ] Are domain types modularized in `src/types/`?

---

## 2. TypeScript & Coding Standards
- [ ] Are all object shapes, props, state, and payloads typed with `type` (strictly NO `interface`)?
- [ ] Is `any` completely avoided (`unknown` + type guards or Zod parsing used instead)?
- [ ] Are public service/action functions explicitly typed with return promises?
- [ ] Are clean barrel imports used (`import { ... } from '@/types'`), avoiding deep internal paths?
- [ ] Are constants in `UPPER_CASE` and variables/functions in `camelCase`?
- [ ] Are code blocks commented with meaningful domain intent/why without positional numbering or step markers (strictly NO `// 1. ...`, `// Step X`, `// Part A`)?

---

## 3. Backend Data & Transaction Safety
- [ ] Do DTOs and query return types derive from Prisma generated types (`Prisma.<Model>GetPayload<{ select/include: ... }>`, `Pick`, `Omit`), never manual duplicate types?
- [ ] Is interactive `prisma.$transaction` free of external I/O (NO HTTP fetch/axios, NO email, NO webhooks, NO file I/O)?

---

## 4. Database & Persistence Conventions
- [ ] Is the primary key always named exactly `id` (`id Int @id @default(autoincrement())`), never `<model>Id`?
- [ ] Do all mutable models include mandatory audit fields in exact order at bottom: `isActive Boolean @default(true)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @default(now()) @updatedAt`?
- [ ] Are naming standards respected: PascalCase model, camelCase fields, `@@map("snake_case")`, `<relation>Id` for FKs?
- [ ] Do shop-scoped entities link to `connectionId` (`PlatformConnection`), NOT `platformId`?
- [ ] Do catalog tables end with `*Catalog`, status tables with `*Status`, and append-only audit models document their immutable exception in a model comment?

---

## 5. Styling, UI & Flow Patterns
- [ ] Are universal primitive components (Button, Table, Badge, Autocomplete/Combobox, Input, Dialog, Tooltip, etc.) placed in `src/components/atoms/` using shadcn/Radix foundations?
- [ ] Are all UI components styled using Tailwind CSS utility classes and design tokens from `src/app/globals.css` (zero inline styles, zero ad-hoc hex values like `bg-[#...]`, no invented styles)?
- [ ] Is dynamic class merging handled using the `cn()` utility from `@/lib/cn`?
- [ ] Do higher-level business components compose primitive atoms and molecules cleanly with domain logic?
- [ ] **Action Presentation**: Do primary actions use visible text `Button`? Do space-constrained secondary actions use compact `Button size="icon"` with a `Tooltip`, localized `aria-label`, and `aria-hidden="true"` icon? Are infrequent/destructive actions kept in an overflow menu `⋯`?
- [ ] **Display Choice**: Is a data table used for >10 records requiring cross-column comparison? Are simple lists or cards used for ≤5 items or vertical scanning?
- [ ] **Surface Choice**: Do quick atomic tasks (≤4–5 fields) use Dialog/Modal or right-side Sheet to preserve background table context? Do multi-step or complex workflows use a routed page (no mega-modals)?
- [ ] Are interactive elements accessible (visible labels/`aria-label`, visible `:focus-visible` rings, semantic controls)?
- [ ] Does the UI adapt responsively across mobile (~375px) and desktop layouts without overflow?
- [ ] Are loading skeletons and empty states handled explicitly (layout-stable, clear next actions)?
- [ ] Do contrast (WCAG AA 4.5:1 for text) and interaction states (hover/active/disabled) work properly?

---

## 6. Forms & Validation Conventions
- [ ] Are React Hook Form and Zod with `zodResolver` the single validation authority?
- [ ] Is `<form noValidate>` present on forms to prevent unlocalized browser-native validation bubbles from overriding RHF?
- [ ] Are form errors connected to inputs via `aria-invalid` and `aria-describedby`?
- [ ] Do Zod schemas use localized schema factories or translation error codes (no hardcoded English or Vietnamese text in schema files)?

---

## 7. State & Data Fetching
- [ ] Is client global state managed using Jotai atoms (no Redux)?
- [ ] Is client-side data fetching and revalidation managed via TanStack Query (no SWR)?

---

## 8. Domain Business Logic Verification
- [ ] **Check Domain Rules**: Consult the [business-logic skill](.agents/skills/business-logic/SKILL.md) and verify that all feature-specific rules in `features/` are satisfied.

---

## 9. Internationalization (i18n) Verification
- [ ] **Zero Hardcoded Strings**: Are all UI texts, labels, button labels, placeholders, titles, error toasts, and schema validation messages localized using `useTranslations` (or `getTranslations`)?
- [ ] **Dictionary Parity**: Do all newly added keys exist in both `src/messages/vi.json` and `src/messages/en.json` at identical paths?
- [ ] **Language Purity**: Is `en.json` free of Vietnamese text and `vi.json` fully translated into Vietnamese?
- [ ] **Navigation**: Are all internal links using `Link`, `useRouter`, `usePathname` imported from `@/i18n/navigation` (no direct `next/link` or `next/navigation`)?
- [ ] **Automated Validation**: Does `yarn i18n:check` run cleanly without errors? (Consult the [i18n-check skill](.agents/skills/i18n-check/SKILL.md)).
