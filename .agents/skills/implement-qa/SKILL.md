---
name: implement-qa
description: >
  Q&A workflow when implementing features with ambiguous requirements:
  write questions into QA/QA-<open-project-code>.md, wait for
  the user to answer, then read the file before continuing to code.
  Use alongside convention for features/refactors; it does not replace the convention.
---

# Implement QA (File‑Based Q&A Workflow)

## Purpose

- When there is a **missing spec**, **multiple interpretations**, or **unclear business rules / scope** → **do not guess**.
- Record questions in **a QA file keyed by the project/feature code**, and let the user answer directly in that file.
- In a later session (or the same one after the user saves the file), the agent **reads `QA-<code>.md`** before continuing implementation.

Code conventions (TypeScript, React, Next.js, Styling) still follow the **`convention`** skill and its relevant sub‑skills.

---

## Location & File Naming

- **Folder**: `QA/` (`QA` in uppercase for consistency).
- **File name**: `QA-<open-project-code>.md`
  - `<open-project-code>` is a **unique identifier for the current session/feature** chosen or confirmed by the user, for example:
    - Feature slug: `QA-vip-copilot-draft.md`, `QA-order-status-sync.md`
    - Short module code: `QA-rag-grounding.md`, `QA-lazada-webhook.md`
  - **Naming rules**: letters, digits, and dashes only; no spaces, no `/` or `\`.

If the user **has not provided** `<open-project-code>` when starting an ambiguous feature, the agent should **ask one short question**: *"Which code/slug should we use for the QA file?"* Only create/write the file after a code is confirmed.

---

## When This Skill Is Required

- **Ambiguous requirements**: "make it look nice", "optimize the flow", "handle edge cases" without clear acceptance criteria.
- **Two valid implementation approaches** but no documentation or preference on which one to pick.
- **Missing business information**: specific discount thresholds, carrier retry policies, escalation rules, UI error copies, DB schema details.
- **Rule "do not guess" is in effect** → prefer QA files over speculative coding.

> **Note:** You do **NOT** need to create a QA file when the specification and acceptance criteria are already clear and complete.

---

## Step-by-Step Workflow for the Agent

### 1. Identify the Code & Path
- Confirm `<open-project-code>` from the task context or ask briefly.
- Target path: `QA/QA-<open-project-code>.md`.

### 2. Before Writing Questions — Read Existing QA File
- If the file **already exists**: read it fully; prioritize the **Answered** sections filled by the user.
- If an older question has already been answered → **do not ask it again** unless the answer is contradictory or incomplete.

### 3. When Clarification Is Needed — Append to the File
- **Create a new file** if it does not exist yet, using the template below.
- **Append** new questions with clear structure:
  - Context (feature, affected files, edge condition).
  - Concrete question(s), with **A/B/C options** so the user can choose quickly.
- **STOP** implementing the parts that depend on these answers: do not write guessed code for open decisions.

### 4. After the User Fills in Answers
- The user edits `QA-<code>.md` directly (in the **Answer** section).
- The agent **re‑reads the file**, briefly summarizes the agreed decisions, and **continues** implementation following `convention` and technical skills.

### 5. Multiple Features in Parallel
- Each feature or ticket gets its **own file** `QA-<code>.md`.
- Do not mix unrelated features into the same file to avoid conflicts and keep reviews focused.

---

## Template for `QA/QA-<open-project-code>.md`

```markdown
# QA — <open-project-code>

Feature / Context: <short description>
Last updated: <YYYY-MM-DD>

## Open Questions

### Q1 — <Short Descriptive Title>
- **Context**: <Brief background on the ambiguity or affected components>
- **Question**: <Specific question that needs a decision>
- **Suggested Options**:
  - **Option A (Recommended)**: <Description of Option A>
  - **Option B**: <Description of Option B>
  - **Option C**: <Description of Option C>
- **Answer**: _(filled by user)_

### Q2 — <Second Question Title>
- **Context**: ...
- **Question**: ...
- **Answer**: _(filled by user)_

---

## Agreed Decisions (Summary for the Agent)

- [ ] Decision 1: ...
- [ ] Decision 2: ...
```

---

## Guardrails

- **Do not** delete or overwrite **Answer** content that the user has written.
- **Do not** paste long code conventions into the QA file — conventions belong in `skills/convention/SKILL.md`.
- If the answer is still ambiguous after reading, **append a follow-up question**; do not guess.

---

## Related Skills

- Technical Standards: [`skills/convention/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/convention/SKILL.md)
- Pre-Commit Checklist: [`skills/checklist/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/checklist/SKILL.md)
- Domain Business Logic: [`skills/business-logic/SKILL.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/business-logic/SKILL.md)
