# Code Review Report: <Task ID> - <Task Title>

- Review Target: `<Task ID or commit/working tree>`
- Mode: `both` (Functional + Convention)
- Scope: `<frontend | backend | database | security | all>`
- Review Verdict: `<PASS | PASS WITH WARNINGS | FAIL (REQUIRES FIX)>`

## Functional Review Pass

Traceability against governing requirements and acceptance criteria:

| Requirement / Criterion | Expected Behavior | Code Implementation Evidence | Status |
| :--- | :--- | :--- | :--- |
| `<Criterion 1>` | `<Expected behavior>` | `<file.ts:line>` | Satisfied / Partial / Missing |
| `<Criterion 2>` | `<Expected behavior>` | `<file.ts:line>` | Satisfied / Partial / Missing |

Functional Findings:
- <None or describe specific functional discrepancy>

## Convention Review Pass

Verification against project rules, architectural layering, and coding standards:

| Check Category | Standard / Rule | Verification Result |
| :--- | :--- | :--- |
| Architecture & Layering | 4-layer architecture (Components -> Server Actions -> Services -> Prisma) | Pass / Violation |
| Type Safety | Strict TypeScript, `type` over `interface`, explicit returns, no `any` | Pass / Violation |
| Internationalization | `next-intl` key parity, zero hardcoded user-facing strings | Pass / Violation |
| Code Hygiene | Zero emojis, zero icons, no numbered comments | Pass / Violation |
| Verification Gates | `npx tsc --noEmit` / `yarn lint` / `yarn i18n:check` exit 0 | Pass / Violation |

Convention Findings:
- <None or describe specific convention discrepancy>

## Consolidated Findings Table

| ID | Severity | File And Line | Rule / Requirement | Description | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `F-01` | Critical / High / Medium / Low | `<file:line>` | `<Rule reference>` | `<Description>` | `<Remediation>` |

## Fix And Re-Review History

| Finding ID | Remediation Applied | Automated Verification | Re-Review Status |
| :--- | :--- | :--- | :--- |
| `F-01` | `<Description of fix>` | `npx tsc --noEmit exit 0` | PASS |

## Final Gate Sign-Off

- Blocking Findings (Critical / High): 0
- Automated Checks Status: All exit code 0
- Authorization for Commit: Approved

