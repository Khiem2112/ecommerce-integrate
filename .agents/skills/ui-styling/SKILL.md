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

---

## 1. Component Architecture & Atomic Placement

This project uses an Atomic UI component hierarchy centered around shadcn UI:

```
[ Domain / Business Feature Components (src/components/chat/, workspace/, etc.) ]
                                  ↓ (composes)
[ Universal Primitive Atoms (src/components/atoms/) ]
  ├── shadcn UI / Radix UI primitives (Button, Table, Badge, Autocomplete/Combobox, Input, Dialog, etc.)
  ├── Placed & exported via barrel file: src/components/atoms/index.ts
  └── Styled strictly with CSS variables & @theme inline tokens from src/app/globals.css
```

### Core Architecture Rules:
1. **Universal Primitive Atoms (`src/components/atoms/`)**:
   - Universal, generic interactive components (Button, Table, Badge, Autocomplete/Combobox, Input, Dialog, Popover, Tooltip, etc.) are built on **shadcn UI** (Radix UI primitives).
   - **Installation Target**: Any shadcn UI component installed or created in the project **must reside in the `atoms` layer** under `src/components/atoms/` (e.g. `src/components/atoms/Button/`, `src/components/atoms/Table/`).
   - Export all primitive atoms through `src/components/atoms/index.ts`.
2. **CSS Token Customization (`globals.css`)**:
   - All primitive atoms must be styled and customized using the CSS variables and Tailwind v4 `@theme inline` design tokens already established in [`src/app/globals.css`](src/app/globals.css) (e.g. `--primary`, `--canvas`, `--surface-*`, `--hairline-*`, `--status-*`, `--badge-*`).
   - Do **NOT** use arbitrary hex colors (e.g. `bg-[#292524]`) or unmapped default colors.
   - Always use the project's class merging helper: `import { cn } from '@/lib/cn'`.
3. **Business Custom Components (Higher Layers)**:
   - Higher-level components (molecules, organisms, feature-specific modules in `src/components/chat/`, `workspace/`, `copilot/`, `inbox/`) **compose** these primitive atoms from `src/components/atoms/`.
   - Business custom components combine primitive atoms with React Hook Form + Zod, TanStack Query, Jotai state, and domain business logic.

---

## 2. When To Use

- Build, extend, or install a shadcn/Radix primitive component into `src/components/atoms/`.
- Customize a primitive atom (Button, Table, Badge, Combobox/Autocomplete, Input, Dialog, etc.) to match `globals.css` design tokens.
- Implement accessible dialogs, drawers, popovers, menus, forms, tables, or command palettes.
- Configure Tailwind theme, CSS variables, responsive utilities, or dark-mode behavior.

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

---

## Boundary

This skill owns shadcn UI component library installation, primitive atom placement in `src/components/atoms/`, and Tailwind styling details. `web-rules.md` owns UX outcomes, accessibility criteria, and interaction quality. `design-system` owns persisted token documentation.
