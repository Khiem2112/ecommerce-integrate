---
name: omnicart-command-whitelist
description: >
  Shared command and file-operation policy for every coding agent working in
  this repository.
alwaysApply: true
---

# Shared Agent Command Policy

This file is the provider-neutral source of truth. Every coding agent working
in this repository must follow it, even when its own permission engine uses a
different configuration format.

## Agent coverage

| Agent | Loads this policy through | Runtime enforcement |
| --- | --- | --- |
| Antigravity | This always-on workspace rule directly | Project Security Preset and Local Permissions |
| Codex | Root `AGENTS.md` | `.codex/rules/default.rules` in this trusted project |
| Claude Code | Root `CLAUDE.md` | `.claude/settings.json` |
| Cursor | Root `AGENTS.md` | `.cursor/cli.json` |

There is no shared cross-vendor permission-file format. This file gives every
agent the same behavioral policy; the small runtime mappings only enforce the
parts that each product can represent safely.

## Allowed routine operations

Agents may perform these operations without asking the user for confirmation
when the operation stays inside this repository:

- Read, search, and list project files, except secrets such as `.env` files.
- Create or edit source, test, documentation, and agent-policy files through a
  workspace-scoped edit or patch tool.
- Inspect Git with `git status`, `git diff`, and `git log`.
- Run `yarn lint` when linting is proportionate to the change.
- Run `yarn i18n:check` when user-facing text or translation dictionaries were
  changed.
- Run TypeScript without emitting files using `yarn exec tsc --noEmit` or
  `npx --no-install tsc --noEmit` when type checking is proportionate to the
  change.

Permission to run a check does not mean the check is required after every
edit. Select validation in proportion to the change; a documentation or
spacing-only change does not justify a full lint and TypeScript pass.

Invoke allowed commands directly and separately so permission engines can
match them. Do not wrap them in another shell, combine them with unrelated
commands, or reshape them solely to bypass approval.

## Operations that still require approval

- Installing or updating packages and refreshing lockfiles.
- Git mutations or remote access: commit, checkout, reset, clean, merge,
  rebase, pull, push, and equivalent operations.
- Database mutations: Prisma migrate, push, seed, or commands against a real
  database.
- Builds with material side effects, deployment, downloads, external API
  calls, publishing, or sending messages.
- File deletion, bulk moves, permission changes, process control, access
  outside the workspace, or reading secret files.
- Any operation not clearly covered by the routine-operation list.

## File-write rule

Use the agent's workspace-scoped edit or patch tool for normal code changes.
Do not use generic shell writers such as `Set-Content`, `Out-File`, shell
redirection, or arbitrary scripts merely to avoid an approval boundary.

## Runtime enforcement

This Markdown file tells agents what is authorized, but it cannot replace a
runtime permission engine. Provider-specific permission mappings must remain
narrow and must implement this policy without granting broader command access.

- Codex: `.codex/rules/default.rules` in this trusted project.
- Claude Code: `.claude/settings.json` and the root `CLAUDE.md` pointer.
- Cursor CLI: `.cursor/cli.json`; Cursor also reads the root `AGENTS.md`.
- Antigravity: this always-on workspace rule plus the project's Security Preset
  and Local Permissions.

Codex file reads and edits rely on its workspace sandbox and dedicated file
tools. Do not add a global `Get-Content`, `PowerShell`, `cmd`, or generic shell
prefix: current prefix rules cannot constrain an arbitrary later path token to
this workspace.

Cursor CLI currently grants shell permissions by command base. Allowing
`Shell(git)` or `Shell(yarn)` would be broader than this policy because it would
also allow operations such as `git push`, `git reset`, or package installation.
Its project mapping therefore auto-approves only the listed workspace paths;
approved shell inspections/checks may still prompt in Cursor.
