# Claude Project Instructions

Read and follow `AGENTS.md` and `.agents/rules/RULE.md` before making any changes.

- **Conventions & Skills:** Follow the **Skill Loading Policy** in `AGENTS.md` to load the minimal relevant skills directly from `.agents/skills/`. Do not copy or duplicate skills.
- **Command & Operations Policy:** `@.agents/rules/command-whitelist.md` is the source of truth (enforced via `.claude/settings.json`). Use workspace edit tools instead of arbitrary shell write scripts.
