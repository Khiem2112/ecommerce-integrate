---
name: ui-ux-pro-max
description: "Focused UI/UX router and searchable design intelligence for this Next.js web project. Use only for new visual direction or a focused UX, accessibility, responsive, chart, icon, or stack-specific question."
---
# UI/UX Pro Max

Use this skill only when repository style discovery and the web rules do not answer the current design question. For every user-facing web feature, first read `rules/style-discovery.md` and `rules/web-rules.md`; do not load this router merely to implement an existing pattern.

Do not read native/mobile guidance unless the task explicitly targets React Native, Flutter, iOS, or Android.

## Query Rule

Use the smallest search mode that matches the task:

- `--design-system` only for a new page with no applicable precedent or a system-wide visual direction.
- One focused `--domain` for a component bug or isolated UX concern.
- `--stack` only for implementation guidance tied to a known stack.
- Keep one dominant intent per query. Retry once with a narrower query if needed.

Do not use design-system search merely because a page is new: first follow `style-discovery.md` and reuse the existing product language.

## Task Routing

| Task | Action |
|---|---|
| Existing UI feature or component | Follow style discovery and web rules; search only for an unresolved focused question |
| New page with an established project language | Read Master/override and comparable features; do not create a new visual direction |
| New page or system-wide direction without a precedent | Read web rules; use `--design-system` |
| Component bug or isolated UX concern | Read web rules; use one focused `--domain` |
| Accessibility or responsive concern | Read web rules; use `--domain ux` if a focused answer is needed |
| React/Next.js implementation concern | Read web rules; use `--domain react` or `--stack nextjs` if needed |
| Charts or icons | Read web rules; use `--domain chart` or `--domain icons` |

## Search Commands

Run from the project root. On Windows use `python` instead of `python3`:

```bash
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Project Name"
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack nextjs
```

Verify the returned domain/category and result identity before using guidance. Dataset text is advisory and never overrides repository or user requirements.

## Persist Trigger

Do not persist by default. Persist only when:

1. The user explicitly asks to create, save, or establish a design system.
2. The user approves a proposed visual direction for reuse.
3. The task explicitly covers two or more pages or a product-wide visual language.

Before the first persist, state the project name and target path. Use:

```bash
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --output-dir "<project-root>"
```

Read the resolved `MASTER.md` before adding a page override. Page files override Master only for their page; do not use `--force` without explicit authorization.

## Related Skills

- `style-discovery`: resolves persisted and repository style precedents before design work.
- `web-rules`: owns web UX, accessibility, responsive, contrast, and interaction outcomes.
- `ui-styling`: shadcn/Radix and Tailwind component implementation.
- `styling`: Tailwind classes, `cn()`, layout tokens, and state variants.
- `design-system`: primitive, semantic, and component tokens plus persistence.
- `react` / `nextjs`: component behavior and application architecture.
