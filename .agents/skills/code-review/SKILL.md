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
| `convention` | Verify code against existing project rules. Do not claim functional completeness. | [convention](../convention/SKILL.md) |
| `both` | Run `functional` first and `convention` second as independent passes. | Load both skills above |

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
| `schema.prisma`, migrations, seeds, fixtures, Prisma CRUD, soft-delete/audit behavior, or persistence naming | [db-conventions](../db-conventions/SKILL.md) |
| Prisma-generated payload/input types, new DTOs that mirror persisted data, or `prisma.$transaction` | [backend-data-safety](../backend-data-safety/SKILL.md) |
| Interactive transaction callback or any service called from one | [backend-data-safety](../backend-data-safety/SKILL.md); trace indirect external I/O as well as direct calls |
| Next.js framework code | The installed Next.js guide required by `AGENTS.md`, limited to the affected API or convention |

### Frontend Convention Triggers

User-facing text includes validation messages in `.ts` schema files, not only
strings inside TSX/JSX.

| Trigger in the review target | Additional source |
| --- | --- |
| Visual UI, layout, or styling changes | [style-discovery](../ui-ux-pro-max/rules/style-discovery.md) and [web-rules](../ui-ux-pro-max/rules/web-rules.md) |
| Button/action presentation, icon-only controls, action groups, or overflow menus | [web-rules](../ui-ux-pro-max/rules/web-rules.md); add [ui-styling](../ui-styling/SKILL.md) when the change affects Tooltip, Button, menu, or accessible primitive composition |
| New visual tokens, arbitrary colors/radii/shadows/spacing, one-off component variants, or an unexplained visual direction not grounded in `globals.css`, the resolved Master/page override, or repository precedent | [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md), but only after style discovery and web rules; use its smallest focused mode when those sources leave a genuine design question unresolved |
| Reusable atoms/molecules, shadcn/Radix primitives, dialogs, menus, tooltips, or accessible component composition | [ui-styling](../ui-styling/SKILL.md) |
| Form component, form hook, or user-facing Zod schema | [form-conventions](../form-conventions/SKILL.md), [flow-forms](../flow-forms/SKILL.md), and [i18n-check](../i18n-check/SKILL.md) |
| Table, list, feed, row actions, bulk actions, sorting, filtering, or pagination | [flow-tables](../flow-tables/SKILL.md) |
| Choosing or reviewing a routed page, dialog, sheet, inspector, master-detail view, or application shell | [flow-app-shell](../flow-app-shell/SKILL.md) |
| Loading, skeleton, first-use, no-results, or empty states | [flow-empty-states](../flow-empty-states/SKILL.md) |
| Error recovery, offline behavior, destructive actions, retry, undo, or confirmation | [flow-errors](../flow-errors/SKILL.md) |
| Navigation hierarchy, breadcrumbs, deep links, sidebar, tabs, or back behavior | [flow-navigation](../flow-navigation/SKILL.md) |
| Settings, account management, preferences, sessions, or danger zones | [flow-settings](../flow-settings/SKILL.md) |
| Permission requests or notification strategy | [flow-permissions](../flow-permissions/SKILL.md) |
| User-facing strings, labels, placeholders, accessibility names, toasts, option text, or validation errors | [i18n-check](../i18n-check/SKILL.md) |
| Server/Client Component, route, Action, or framework boundary | [nextjs](../nextjs/SKILL.md) and the applicable installed Next.js guide |

Do not use `ui-ux-pro-max` to legitimize an invented style. When an existing
token or precedent already satisfies the same role, report the violation
against style discovery or styling conventions. UI/UX search is advisory and
is only for a focused question that remains after repository reuse has been
checked.

### Auto-Scope Detection

For `scope=auto`, infer every affected scope from both file location and code
behavior. A file may activate more than one scope.

- Actions, route handlers, services, integrations, jobs, and server utilities
  activate `backend`.
- Prisma schema/migrations/seeds, Prisma calls, generated Prisma payload types,
  or transaction callbacks activate `database`; server TypeScript containing
  them also activates `backend`.
- Pages, components, hooks, atoms, forms, and styles activate `frontend`.
- Dictionaries and any user-visible text or validation message activate
  `i18n`, including messages declared in form schemas or server responses.
- Authentication, authorization, privacy, tenant isolation, secrets, or unsafe
  external actions activate `security` in addition to their technical scope.

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
