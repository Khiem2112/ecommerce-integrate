---
name: task-runner
description: >
  Autonomous task execution loop: creates structured tasks with checklists, executes bounded implementation via task-implementer subagent, conducts dual-pass reviews via task-reviewer subagent, executes automated verification gates via task-tester subagent, remediates defects, creates clean git commits, and updates progress. Supports single-agent execution and multi-subagent orchestration.
argument-hint: "[action:create|run|orchestrate] [plan-or-task-path:optional] [phase-id:optional]"
---

# Autonomous Task Runner

This skill guides the autonomous cycle of defining, executing, reviewing, fixing, and committing development tasks. It enforces strict separation between functional requirements and code conventions, guarantees automated pre-commit gate verification, and maintains complete traceability through standardized templates. It can operate in single-agent sequential mode or as an Orchestrator commanding dedicated subagents.

## Operational Constraints

- Zero icons and emojis: Commit messages, review notes, completion summaries, code comments, and log entries must never contain icons or emojis.
- Zero numbered comment chains: Do not write comments indicating chronological step numbers (such as `// 1.`, `// Step 1`, `<!-- Bước 1 -->`). Use descriptive technical explanations instead.
- Minimal blast radius: Modify only files directly required for the selected task. Do not perform opportunistic refactoring outside the task scope.
- Hard commit gate: A commit is strictly blocked if any automated verification check fails or if any Critical/High review finding remains unresolved.

## Standardized Templates

The skill utilizes three core templates located in `.agents/skills/task-runner/templates/`:

- Task Definition Template (`templates/task.md`): Used to specify scope, dependencies, granular checklists, and acceptance criteria.
- Code Completion Template (`templates/code-completion.md`): Used by the implementation subagent to report touched files, architectural choices, and automated test outcomes before review.
- Code Review Template (`templates/code-review.md`): Used during the review phase to record functional and convention findings, fix verifications, and gate decisions.

## Execution Lifecycle

The lifecycle consists of standard stages covering task definition through to automated commit and status update.

### Stage 0: Task Definition And Checklist Creation

When instructed to create a task list or when breaking down a specification:
- Consult the governing feature spec (`docs/<feature>/specs/v1.md`) or user requirement.
- Structure the task using templates/task.md:
  - Define Task ID, Feature name, and Scope (`frontend`, `backend`, `database`, `security`, or `shared`).
  - Identify pre-requisites and reusable assets via reuse-first discipline.
  - List affected target files.
  - Break down implementation into an atomic checklist with `[ ]` items.
  - Define concrete, testable acceptance criteria and specific verification commands.
- If managing a multi-phase feature, append or integrate the task into the feature implementation plan.

### Stage 1: Task Inspection And Scope Bounding

- Identify the pending task. If a specific phase-id argument was supplied, select that phase.
- Extract task boundaries: target scope, expected file changes, dependencies, acceptance criteria, and verification commands.
- Set task status in the tracking document to `In progress`.

### Stage 2: Technical Analysis And Pre-Check

- Consult repository precedents before modifying code:
  - Check existing Radix UI primitives, Jotai atoms, TanStack Query hooks, Zod schemas, or backend services.
  - Verify design system standards in `src/app/globals.css` and shared components.
  - Verify domain rules in `.agents/skills/business-logic/`.
- Confirm the exact set of files to create or edit.

### Stage 3: Task Implementation

- Dispatch the worker subagent (`task-implementer`):
  - Delegate implementation bounded strictly to the assigned task checklist.
  - Worker modifies only files in the declared scope.
  - Worker enforces Next.js 4-layer architecture, strict TypeScript (`type` over `interface`, explicit returns, no `any`), and next-intl key parity.
- Worker runs targeted pre-checks and produces a code completion report based on `templates/code-completion.md`.

### Stage 4: Dual-Pass Code Review

- Dispatch the independent reviewer subagent (`task-reviewer`):
  - Pass A (Functional Review): Trace implemented logic against task acceptance criteria, boundary conditions, and error recovery.
  - Pass B (Convention Review): Inspect 4-layer architecture, type safety, next-intl parity, zero emojis/icons, and zero numbered comments.
- Reviewer outputs a structured review report based on `templates/code-review.md`.

### Stage 5: Remediation (If Blockers Found)

- If any Critical or High severity findings are reported:
  - Re-assign remediation to the worker subagent (`task-implementer`).
  - Worker applies targeted fixes and verifies regression.
  - Reviewer re-checks remediation until all blocking findings are cleared.

### Stage 6: Automated Pre-Commit Verification Gates

- Dispatch the verification subagent (`task-tester`):
  - Execute TypeScript check: `npx tsc --noEmit`
  - Execute Linting check: `yarn lint`
  - Execute Internationalization parity: `yarn i18n:check`
  - Execute targeted unit/integration tests
- Confirm all verification commands exit with code 0.

### Stage 7: Worktree Consolidation And Commit

- Stage only the files touched within the task scope.
- Generate a Conventional Commit message in plain text without emojis or numbered comments.
- Mark task checklist items as completed `[x]` and update task status to `Complete`.

## Subagent Delegation Architecture

When operating in multi-subagent orchestration mode:

- Concurrency Cap: Maximum 2 to 3 worker subagents concurrently. Never dispatch excessive parallel subagents.
- Zero Recursive Spawning: Subagents are leaf workers; they are strictly forbidden from spawning child subagents.
- Implementation Subagent (`.agents/agents/task-implementer.md`): Dispatched with edit and write tools, assigned specific task boundaries.
- Reviewer Subagent (`.agents/agents/task-reviewer.md`): Dispatched in read-only sandbox to conduct independent Pass A and Pass B checks.
- Verification Subagent (`.agents/agents/task-tester.md`): Dispatched to run automated repository verification commands and report exact exit codes.

