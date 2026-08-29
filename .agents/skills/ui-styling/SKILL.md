---
name: ui-styling
description: Focused shadcn/Radix and Tailwind component implementation guidance for this Next.js project. Use only when a task changes reusable UI primitives, complex accessible components, Tailwind theme configuration, or shadcn components.
argument-hint: "[component or layout]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---
# UI Styling

Use this as a component-implementation router, not as a source of product visual direction. Before creating or changing a user-facing feature, follow `.agents/skills/ui-ux-pro-max/rules/style-discovery.md` and apply `.agents/skills/ui-ux-pro-max/rules/web-rules.md`.

## When To Use

- Build or extend a shadcn/Radix component.
- Implement an accessible dialog, drawer, popover, menu, form, table, or command palette.
- Configure Tailwind theme, CSS variables, responsive utilities, or dark-mode behavior.
- Resolve a component-specific accessibility or composition question.

Do not load this skill for backend, API, data, business-logic-only work, or a simple existing-component composition that needs no primitive guidance.

## Implementation Rules

- Reuse repository components and semantic tokens before adding a new primitive or visual variant.
- Prefer semantic HTML and existing shadcn/Radix primitives over custom generic interactive containers.
- Use Tailwind utilities and `cn()` according to `.agents/skills/styling/SKILL.md`.
- Keep component behavior, keyboard handling, focus management, and state semantics aligned with `rules/web-rules.md`.
- Read only the reference that answers the current implementation question.

## Focused References

| Need | Read |
|---|---|
| Component composition or installation | `references/shadcn-components.md` |
| Dialog, menu, form, and screen-reader behavior | `references/shadcn-accessibility.md` |
| Theme variables and dark mode | `references/shadcn-theming.md` |
| Core Tailwind utilities | `references/tailwind-utilities.md` |
| Breakpoints or container queries | `references/tailwind-responsive.md` |
| Tailwind theme/custom utilities | `references/tailwind-customization.md` |
| Canvas/poster/brand-art output only | `references/canvas-design-system.md` |

## Optional Tools

Use scripts only when the user asks to install/configure components or generate Tailwind configuration. Inspect the project configuration first; do not run installation or overwrite commands by default.

```bash
python scripts/shadcn_add.py button dialog form
python scripts/tailwind_config_gen.py --colors brand:blue
```

## Boundary

This skill owns component-library and Tailwind implementation details. `web-rules.md` owns UX outcomes, accessibility review criteria, responsive behavior, contrast, and interaction quality. `design-system` owns persisted token documentation and page overrides.
