# Web UI/UX Rules

These rules apply to Next.js, React, and Tailwind web interfaces in this project. They describe UX outcomes and review criteria; they do not replace implementation conventions.

Before implementing or visually changing a user-facing feature, follow `style-discovery.md` to find and reuse the existing product style.

For Tailwind class composition and state variants, read `.agents/skills/styling/SKILL.md`. For shadcn/Radix primitives, read `.agents/skills/ui-styling/SKILL.md`. For token architecture and persisted design-system files, read `.agents/skills/design-system/SKILL.md`.

## Scope

- Prefer semantic HTML and native web controls before generic containers.
- Do not apply native-only safe areas, haptics, Dynamic Type, or iOS/Android unit rules to desktop web by default.
- Use the existing project design system when one exists; do not introduce per-screen visual tokens casually.

## Accessibility

- Give every form control a visible label or an equivalent accessible name.
- Give icon-only buttons and links an accessible name; hide decorative icons with `aria-hidden="true"`.
- Preserve keyboard navigation and provide visible `:focus-visible` states.
- Keep focus order aligned with visual and reading order.
- Manage focus when opening and closing dialogs, drawers, and error summaries.
- Do not let sticky headers, drawers, or overlays obscure keyboard focus.
- Use semantic states such as `disabled`, `aria-expanded`, `aria-selected`, and `aria-pressed` when applicable.
- Do not use color as the only indicator of status, validation, or selection.
- Provide inline field errors; for multi-error forms, link and focus a useful error summary after submit.
- Provide keyboard/button alternatives for drag-, swipe-, or hover-only interactions.
- Respect `prefers-reduced-motion` and avoid motion that blocks task completion.

## Responsive Layout

- Build mobile-first and verify at approximately 375px, common desktop widths, and landscape orientation.
- Use consistent responsive gutters and avoid one fixed width that breaks narrow screens.
- Keep long-form content at a readable measure on large screens.
- Ensure fixed or sticky UI has enough content inset so it does not hide scroll content.
- Preserve hierarchy and task order when columns collapse or controls wrap.
- Keep compact labels, badges, and controls from causing accidental layout shifts.

## Contrast and Themes

- Verify normal text contrast at 4.5:1 or better where applicable; large text and non-text UI have their own thresholds.
- Make borders, dividers, focus rings, disabled states, and selected states visible in every supported theme.
- Use semantic color tokens rather than ad-hoc page-level hex values.
- Check composed modal/scrim contrast against the real background, not the token in isolation.

## Interaction and Motion

- Provide clear hover, focus, active, loading, success, error, and disabled states.
- Keep feedback responsive and do not change layout bounds during hover or press states.
- Use motion to communicate cause, state, and hierarchy; do not animate every element.
- Ensure loading and empty states preserve layout stability and explain the next useful action.
- Avoid nested interactions with conflicting click, drag, keyboard, or scroll behavior.

## E-commerce Checks

- Product cards expose a clear title, price, availability, and primary action.
- Filters and sorting expose their current state and remain usable on narrow screens.
- Cart and checkout actions provide immediate feedback and prevent duplicate submission.
- Validation explains how to fix the field, not only that it is invalid.
- Destructive or irreversible actions require clear confirmation and recovery where feasible.

## Web Review Criteria Summary

Use this summary during review to verify UX outcomes (formal verification gate is in `.agents/skills/checklist/SKILL.md`):

- [ ] Semantic controls, accessible names, keyboard navigation, and visible focus states work.
- [ ] Forms have labels, inline errors, loading states, and useful recovery guidance.
- [ ] Decorative icons are hidden; meaningful icons have text alternatives.
- [ ] Responsive behavior works at small phone, desktop, and landscape widths.
- [ ] Sticky/fixed UI does not obscure content or focus.
- [ ] Contrast (WCAG AA 4.5:1 for normal text) and interaction states work in every supported theme.
- [ ] Reduced motion is respected and no interaction depends on motion alone.
- [ ] Loading skeletons and empty states preserve layout stability and provide clear next actions.
