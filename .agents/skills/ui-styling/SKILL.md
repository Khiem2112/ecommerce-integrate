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

### Primitive State Contracts

- Button variants must express action hierarchy through semantic tokens: one solid primary action per compact context, neutral secondary actions, and a destructive variant only for destructive consequences. Do not create accent-coloured variants for every verb.
- A primary button label uses medium-to-semibold weight. Icon-only actions remain secondary unless their role is unmistakable and still require the tooltip/accessibility pattern below.
- Badge primitives use medium or semibold text and expose their meaning in text or another accessible cue; colour alone must not encode state. Keep badges resilient to long localized labels and text scaling.
- For menus, listbox options, combobox options, and navigation items, implement selected state with the component's semantic selected attributes and a persistent selected treatment. Hover is a lighter affordance; active/pressed is stronger, and neither may suppress `focus-visible`.
- Implement hover, active, selected, disabled, and focus states with existing semantic background, foreground, border, and shadow tokens. State changes must not change an element's layout bounds.

### Accessible Icon Button + Tooltip Pattern

Any button rendered without visible text (`size="icon"`) must be accessible to both mouse hover users (via Tooltip) and screen reader users (via `aria-label`).

```tsx
// ❌ BAD: Naked icon button without tooltip or accessible name
<Button variant="ghost" size="icon" onClick={handleReset}>
  <KeyRound className="size-4" />
</Button>

// ❌ BAD: Tooltip without aria-label (screen readers will announce unlabelled button)
<Tooltip content="Reset password">
  <Button variant="ghost" size="icon" onClick={handleReset}>
    <KeyRound className="size-4" />
  </Button>
</Tooltip>

// ✅ GOOD: Accessible composition with Tooltip, aria-label, and aria-hidden icon
<Tooltip content={t('resetPassword')}>
  <Button
    type="button"
    variant="ghost"
    size="icon"
    aria-label={t('resetPassword')}
    onClick={handleReset}
    className="size-8 text-muted hover:text-foreground"
  >
    <KeyRound className="size-4" aria-hidden="true" />
  </Button>
</Tooltip>
```


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
