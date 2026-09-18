---
name: code-review
description: >
  Routes OmniCart code reviews by independently selected review mode and code
  scope. Use for functional verification, convention audits, phase gates,
  pre-commit review, or delegated read-only review.
argument-hint: "[mode:functional|convention|both] [scope:auto|backend|frontend|database|i18n|security|all] [target]"
---

# Code Review Router

This skill selects the review method and the authoritative sources to load. It
does not define business logic, security rules, or coding conventions.

## Mode And Scope Are Independent

- **Mode** answers: _What kind of correctness is being reviewed?_
- **Scope** answers: _Which part of the change is included?_

Select one mode and one or more scopes. A scope never implies a mode.

Examples:

- `mode=functional scope=backend`: verify backend behavior against requirements.
- `mode=convention scope=backend`: verify backend code against existing rules.
- `mode=both scope=frontend`: run separate functional and convention passes on
  frontend files.

## Modes

| Mode | Purpose | Required skill |
| --- | --- | --- |
| `functional` | Verify requirements, observable behavior, branches, failures, recovery, and regressions. Do not report convention-only findings. | [functional-review](../functional-review/SKILL.md) |
| `convention` | Verify code against existing project rules. Do not claim functional completeness. | [convention](../convention/SKILL.md) and [checklist](../checklist/SKILL.md) |
| `both` | Run `functional` first and `convention` second as independent passes. | Load [functional-review](../functional-review/SKILL.md), [convention](../convention/SKILL.md), and [checklist](../checklist/SKILL.md) |

Use `both` when the user, approved plan, or delivery gate explicitly asks for
both, or when a general review request does not narrow the review to behavior
or conventions. If mode is omitted, infer it from the request:

- spec, acceptance criteria, functionality, bugs, or edge cases → `functional`;
- convention, architecture, TypeScript, styling, or i18n rules → `convention`;
- full review, general code review, PR review, pre-commit review, or both →
  `both`.

If the request remains unclear, use `both` and disclose the assumption. An
unspecified general review must not silently skip either behavioral correctness
or project conventions.

## Scopes

`be`, `fe`, and `db` are accepted aliases for `backend`, `frontend`, and
`database`.

| Scope | Included area |
| --- | --- |
| `auto` | Only areas touched by the review target; this is the default. |
| `backend` | Actions, route handlers, services, integrations, jobs, and server utilities. |
| `frontend` | Pages, React components, hooks, client state, forms, and styling. |
| `database` | Prisma schema, migrations, persistence behavior, and seed/fixture data. |
| `i18n` | Locale routing, translation usage, dictionaries, and localized behavior. |
| `security` | Authentication, authorization, privacy, tenant isolation, secrets, and unsafe external actions. |
| `all` | Every affected scope, not every file or skill in the repository. |

TypeScript is a convention source used inside applicable scopes, not a scope.

## Skill Routing Matrix

First load the required skill for the selected mode. Then add only the sources
whose trigger matches the selected scope and changed files.

| Scope | Functional pass additions | Convention pass additions |
| --- | --- | --- |
| `backend` | [business-logic](../business-logic/SKILL.md) for domain behavior; [RULE.md](../../rules/RULE.md) when its guardrails apply | [nextjs](../nextjs/SKILL.md), [typescript](../typescript/SKILL.md), and [reuse-first](../reuse-first/SKILL.md); then apply the backend triggers below |
| `frontend` | [business-logic](../business-logic/SKILL.md) and approved flow/spec sources when user-visible behavior depends on them | [react](../react/SKILL.md), [styling](../styling/SKILL.md), [typescript](../typescript/SKILL.md), and [reuse-first](../reuse-first/SKILL.md); then apply the frontend triggers below |
| `database` | [business-logic](../business-logic/SKILL.md) when persistence encodes domain behavior | [db-conventions](../db-conventions/SKILL.md) and [reuse-first](../reuse-first/SKILL.md); add [backend-data-safety](../backend-data-safety/SKILL.md) and [typescript](../typescript/SKILL.md) for changed TypeScript persistence code, Prisma-derived types, or transactions |
| `i18n` | The requirement/spec defining localized behavior | [i18n-check](../i18n-check/SKILL.md); add [form-conventions](../form-conventions/SKILL.md) when validation messages or form schemas are affected |
| `security` | [RULE.md](../../rules/RULE.md) and applicable feature business rules | The exact existing security/privacy source that applies; add [nextjs](../nextjs/SKILL.md), [typescript](../typescript/SKILL.md), and [backend-data-safety](../backend-data-safety/SKILL.md) when the affected code uses those boundaries |
| `auto` or `all` | Expand to the applicable rows above | Expand to the applicable rows above |

Repository specs, approved flow documents, `PRODUCT.md`, and source code are
evidence sources rather than skills. Never copy their rules into this router.

### Backend Convention Triggers

Load these additions whenever the changed files or call graph match the
trigger, even when the caller selected only `scope=backend`.

| Trigger in the review target | Additional source |
| --- | --- |
| `schema.prisma`, migrations, seeds, fixtures, Prisma CRUD, soft-delete (`isActive`), mandatory audit fields (`createdAt`, `updatedAt`), or model/table naming conventions (`id` as PK, `*Catalog`, `*Status`) | [db-conventions](../db-conventions/SKILL.md) |
| Any type definition in `src/types/`, any DTO/payload shape representing persisted data, any manual type copying Prisma model fields, or use of `prisma.$transaction` | [backend-data-safety](../backend-data-safety/SKILL.md) |
| Interactive transaction callback (`prisma.$transaction`) or any service called from one; trace and prohibit indirect external I/O (HTTP fetch/axios, email, webhooks, file I/O) | [backend-data-safety](../backend-data-safety/SKILL.md) |
| Server Actions executing direct `prisma.*` queries (except `$transaction`), executing domain business logic instead of delegating to Services, or missing Zod validation | [nextjs](../nextjs/SKILL.md) |
| Service functions executing domain logic, accepting optional `tx?: Prisma.TransactionClient`, or calling Server Actions (strictly prohibited) | [nextjs](../nextjs/SKILL.md) |
| Utils layer (`src/utils/`) placing DB, API, or File I/O (strictly prohibited); small 1–2 line private helpers kept inside service vs complex/reused helpers in `src/utils/` | [nextjs](../nextjs/SKILL.md) |
| Next.js framework code | The installed Next.js guide required by `AGENTS.md`, limited to the affected API or convention |

### Frontend Convention Triggers

User-facing text includes validation messages in `.ts` schema files, not only
strings inside TSX/JSX.

| Trigger in the review target | Additional source |
| --- | --- |
| Visual UI, layout, or styling changes | [style-discovery](../ui-ux-pro-max/rules/style-discovery.md) and [web-rules](../ui-ux-pro-max/rules/web-rules.md); enforce strict adherence to `src/app/globals.css`, semantic tokens, zero arbitrary hex (`bg-[#...]`), and no invented styles |
| Button/action presentation, icon-only controls, action groups, or overflow menus: choosing between full text `Button` vs `Button size="icon"` + `Tooltip` + localized `aria-label` + `aria-hidden` icon; moving infrequent or destructive secondary actions to overflow menu `⋯` | [web-rules](../ui-ux-pro-max/rules/web-rules.md), [ui-styling](../ui-styling/SKILL.md), and [flow-tables](../flow-tables/SKILL.md) |
| Display format decision: choosing between `Table` (>10 records, multi-attribute, cross-column compare) vs `List` (vertical scan, 1 primary attribute) vs `Cards` (visual IS content) vs simple row items (≤5 items) | [flow-tables](../flow-tables/SKILL.md) |
| Surface presentation form: choosing between routed page vs dialog/modal vs drawer/sheet (task ≤ 4–5 fields, quick in-and-out, preserve background -> Modal/Sheet; multi-step, deep work, low-density page -> Routed page) | [flow-app-shell](../flow-app-shell/SKILL.md) |
| Raw markup or primitive UI authoring: any raw HTML control (`<button>`, `<input>`, `<select>`, `<textarea>`, `<table...>`, custom styled `<span>`/`<badge>`, raw dialog/sheet/tooltip/popover markup) instead of importing from `@/components/atoms` or `@/components/molecules`. Reviewer MUST inspect `src/components/atoms/index.ts` and `src/components/molecules/index.ts` to require reuse or extension | [reuse-first](../reuse-first/SKILL.md) and [ui-styling](../ui-styling/SKILL.md) |
| Custom hooks or client state: inspecting `src/hooks/` and TanStack Query / Jotai atoms before rolling ad-hoc fetch or state | [reuse-first](../reuse-first/SKILL.md) and [nextjs](../nextjs/SKILL.md) |
| Form component, form hook, or user-facing Zod schema: RHF + Zod authority, `<form noValidate>` to suppress browser-native unlocalized bubbles, accessible errors (`aria-invalid`, `aria-describedby`), and schema factory for localized messages | [form-conventions](../form-conventions/SKILL.md), [flow-forms](../flow-forms/SKILL.md), and [i18n-check](../i18n-check/SKILL.md) |
| New visual tokens, arbitrary colors/radii/shadows/spacing, one-off component variants, or an unexplained visual direction not grounded in `globals.css`, the resolved Master/page override, or repository precedent | [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md), but only after style discovery and web rules; use its smallest focused mode when those sources leave a genuine design question unresolved |
| Loading, skeleton, first-use, no-results, or empty states | [flow-empty-states](../flow-empty-states/SKILL.md) |
| Error recovery, offline behavior, destructive actions, retry, undo, or confirmation | [flow-errors](../flow-errors/SKILL.md) |
| Navigation hierarchy, breadcrumbs, deep links, sidebar, tabs, or back behavior | [flow-navigation](../flow-navigation/SKILL.md) |
| Settings, account management, preferences, sessions, or danger zones | [flow-settings](../flow-settings/SKILL.md) |
| Permission requests or notification strategy | [flow-permissions](../flow-permissions/SKILL.md) |
| User-facing strings across all diff files (TSX, JSX, .ts schemas, server errors, toasts, option lists): Zero hardcoded strings, 100% dictionary key parity (`vi.json` and `en.json`), `@/i18n/navigation` | [i18n-check](../i18n-check/SKILL.md) |
| Server/Client Component, route, Action, or framework boundary: verifying 4-layer separation (UI cannot call services/DB directly) | [nextjs](../nextjs/SKILL.md) and the applicable installed Next.js guide |

Do not use `ui-ux-pro-max` to legitimize an invented style. When an existing
token or precedent already satisfies the same role, report the violation
against style discovery or styling conventions. UI/UX search is advisory and
is only for a focused question that remains after repository reuse has been
checked.

### Auto-Scope Detection

For `scope=auto`, infer every affected scope from both file location and code
behavior. A file may activate more than one scope.

- Actions (`src/actions/`), route handlers (`src/app/api/`), services (`src/services/`),
  integrations, jobs, and server utilities activate `backend`.
- Domain types (`src/types/`) activate `backend`; if they describe persisted
  entities or Prisma payloads, they also activate `database`.
- Prisma schema (`prisma/schema.prisma`), migrations, seeds, Prisma queries,
  generated Prisma payload types, or transaction callbacks activate `database`;
  server TypeScript containing them also activates `backend`.
- Pages (`src/app/[locale]/`), components (`src/components/`), hooks (`src/hooks/`),
  atoms (`src/atoms/`), styles, and form UI activate `frontend`.
- Form schemas and validation logic (`src/forms/`) activate both `frontend`
  and `i18n`.
- Pure utilities (`src/utils/`) activate `backend` or `frontend` depending on
  caller domain.
- Dictionaries (`src/messages/`) and any user-visible text or validation message activate
  `i18n`, including messages declared in form schemas or server responses.
- Authentication, authorization, privacy, tenant isolation, secrets, or unsafe
  external actions activate `security` in addition to their technical scope.

## Mandatory Convention Review Checklist

When executing a convention review pass (`mode=convention` or the convention pass of `mode=both`), every reviewer MUST verify the changed files against these 7 mandatory domain checklists:

### 1. Architectural Layering & Reuse
- [ ] **4-Layer Flow Respected**: UI Components → Custom Hooks/Atoms → Server Actions/API Routes → Services → Utils → Prisma/DB. UI components and hooks MUST NOT call Services or Prisma directly.
- [ ] **Server Actions Orchestration**: Actions validate input (Zod), orchestrate Services, initiate `prisma.$transaction` when atomic coordination is needed, and return `{ success, data, error }`. Server Actions MUST NOT contain direct `prisma.*` queries or direct business logic.
- [ ] **Services Hub (SRP)**: All business logic, DB queries (accepting optional `tx`), external APIs, and file I/O live in Services with single-responsibility functions. Services MUST NOT call Server Actions.
- [ ] **Utils Pure & Stateless**: Functions in `src/utils/` MUST NOT touch DB, call external APIs, or do file I/O. Small 1–2 line private service helpers are kept directly inside the service file rather than prematurely extracted into `src/utils/`.
- [ ] **Reuse-First**: Existing repository atoms, molecules, custom hooks, schemas, types, and utility functions were searched and prioritized before creating new code ([reuse-first](../reuse-first/SKILL.md)).

### 2. TypeScript & Commenting Standards
- [ ] **Types Over Interfaces**: All object shapes, props, state, and payloads use `type` (strictly NO `interface`).
- [ ] **No `any`**: Completely avoided; `unknown` with type narrowing/guards or Zod parsing is used.
- [ ] **Explicit Return Types**: Exported functions, server actions, API handlers, and public service methods have explicit return types.
- [ ] **Barrel Imports**: Clean barrel imports used (`import { ... } from '@/types'`), no deep internal file path imports.
- [ ] **No Positional / Step Comments**: Strictly NO positional comment numbering or step markers (no `// 1. ...`, `// Step X`, `// Part A`). Code block comments must explain domain intent, business rules, or algorithmic "why".

### 3. Backend Data & Transaction Safety
- [ ] **Prisma-Derived DTOs**: Payload and result types derive from Prisma generated types (`Prisma.<Model>GetPayload<{ select/include: ... }>`, `Pick`, `Omit`), never parallel hand-copied duplicate types.
- [ ] **No External I/O Inside Transactions**: HTTP fetch/axios calls, emails, webhooks, third-party API SDKs, and file I/O are strictly prohibited inside interactive `prisma.$transaction` callbacks.

### 4. Database & Persistence Conventions
- [ ] **Primary Key `id`**: PK field is always named exactly `id Int @id @default(autoincrement())` (never `<model>Id`).
- [ ] **Mandatory Audit Fields**: Mutable models have `isActive Boolean @default(true)`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @default(now()) @updatedAt` placed in exact order at the bottom of the field list.
- [ ] **Naming Standards**: Models in PascalCase, fields in camelCase, `@@map("snake_case")`, FKs named `<relation>Id`.
- [ ] **Table Categories & Scoping**: Shop-scoped entities link to `connectionId` (`PlatformConnection`), NOT `platformId`. Catalog tables end with `*Catalog`, status tables with `*Status`. Append-only audit models document their immutable exception in a model comment.

### 5. UI, Styling & Flow Patterns
- [ ] **Grounded in `globals.css`**: Strict adherence to existing CSS variables and semantic tokens. Zero arbitrary hex colors (`bg-[#...]`) or invented styling variants.
- [ ] **Atomic Primitives & Zero Raw Controls**: Generic components (Button, Table, Input, Dialog, Tooltip, Badge, DropdownMenu) MUST be imported from `@/components/atoms` (built on shadcn/Radix) or `@/components/molecules`. Higher-level feature components compose existing atoms/molecules; authoring one-off raw HTML controls or ad-hoc badge/button wrappers without reuse evidence is prohibited.
- [ ] **Action Presentation**: Primary actions use visible text `Button`. Space-constrained secondary actions use compact `Button size="icon"` with a `Tooltip`, localized `aria-label`, and `aria-hidden="true"` icon. Infrequent/destructive actions reside in an overflow menu `⋯`.
- [ ] **Display Choice**: Data table used for >10 records requiring cross-column comparison and sorting/filtering. Simple lists or cards used for ≤5 items or vertical scanning without cross-attribute comparison.
- [ ] **Surface Choice**: Quick atomic tasks (≤4–5 fields) use Dialog/Modal or right-side Sheet to preserve background table context. Multi-step, complex, or low-density workflows use a routed page (never a mega-modal).

### 6. Forms & Validation Conventions
- [ ] **RHF + Zod Authority**: Form state and submission managed via React Hook Form with `zodResolver`.
- [ ] **Browser Validation Suppressed**: `<form noValidate>` is present so unlocalized browser bubbles do not override RHF error handling.
- [ ] **Accessible Error Feedback**: Errors from `formState.errors` are connected to inputs via `aria-invalid` and `aria-describedby`.
- [ ] **Localized Validation Schemas**: Validation messages in Zod schemas use localized schema factories or translation error codes (no hardcoded English or Vietnamese text in schema files).

### 7. Internationalization (i18n) Verification
- [ ] **Zero Hardcoded Strings**: All user-facing text, button labels, placeholders, titles, and error toasts use `useTranslations` or `getTranslations`.
- [ ] **100% Dictionary Key Parity**: All newly added keys exist at the identical path in both `src/messages/vi.json` and `src/messages/en.json`.
- [ ] **Language Purity**: `en.json` contains no Vietnamese; `vi.json` contains no raw English text.
- [ ] **Navigation Import**: All links and routing use `Link`, `useRouter`, `usePathname` from `@/i18n/navigation` (no direct `next/link` or `next/navigation`).
- [ ] **Automated Check**: `yarn i18n:check` passes with 0 errors.

## Review Flow

1. **Declare inputs:** state mode, scope, target, and baseline. Never silently
   expand either mode or scope.
2. **Establish the review set:** inspect the requested files or the applicable
   staged, unstaged, and untracked changes. Exclude unrelated user changes.
3. **Load sources:** load the mode skill, then the base row and every matching
   trigger source from the routing matrix. If a source does not apply, do not
   load it.
4. **Review:** execute each selected mode independently. For `both`, complete
   the functional pass before starting the convention pass.
5. **Validate proportionately:** follow
   [command-whitelist.md](../../rules/command-whitelist.md). Run only checks that
   can confirm the reviewed behavior or finding.
6. **Report before fixing:** review-only work is read-only. Apply fixes only
   when the user or parent task explicitly authorizes them.

## Findings Contract

Every violation must cite both the authoritative requirement/rule and the
file-line evidence. Unsupported concerns must be labeled as questions or
suggestions, not violations.

Lead with findings ordered by impact. Include mode, scope, source, evidence,
impact, and smallest remediation. End with checks run or skipped and a status:
`PASS`, `PASS WITH WARNINGS`, or `FAIL`.

For `both`, keep Functional Findings and Convention Findings separate. The
parent agent owns any authorized fixes and targeted re-checks.
