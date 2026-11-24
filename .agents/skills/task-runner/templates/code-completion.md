# Code Completion Report: <Task ID> - <Task Title>

- Status: Implementation Complete, Pending Review
- Scope: <frontend | backend | database | security | shared>
- Completion Timestamp: <ISO-8601 or date-time>

## Summary Of Changes

<Concise narrative describing the completed implementation and how it satisfies the task objective.>

## Touched Files

| File Path | Operation | Description |
| :--- | :--- | :--- |
| `<path/to/file-1>` | Created / Modified / Deleted | <Brief explanation of changes and purpose> |
| `<path/to/file-2>` | Created / Modified / Deleted | <Brief explanation of changes and purpose> |

## Architecture And Compliance Checks

- 4-Layer Architecture: <Yes / NA> (UI -> Server Actions with Zod -> Services -> Prisma)
- State Management: <Jotai atoms / TanStack Query hooks / React Hook Form with Zod>
- Internationalization: <next-intl used, 100% key parity across vi.json and en.json>
- Typing Discipline: <Strict TypeScript, type over interface, no any, explicit returns>
- Forbidden Patterns Audit: Zero emojis, zero icons, zero numbered comment chains.

## Automated Verification Results

| Command | Exit Code | Outcome |
| :--- | :--- | :--- |
| `npx tsc --noEmit` | `0` | PASS |
| `yarn lint` | `0` | PASS |
| `yarn i18n:check` | `0` | PASS |
| `<targeted test command>` | `0` | PASS |

## Next Phase

Trigger Stage 4: Dual-Pass Review (Functional Review + Convention Review).

