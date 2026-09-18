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

### Action Presentation: Text, Icon, or Overflow

- Use a visible text button for the primary action, an unfamiliar action, or an
  action whose icon would be ambiguous. Label it with a concise verb and
  outcome. A long translated label alone is not a reason to hide the primary
  action behind an icon.
- Use an icon-only button only for a familiar secondary action in a
  space-constrained surface. It must have a Tooltip, a localized `aria-label`,
  and an `aria-hidden="true"` decorative icon. If the symbol is not immediately
  recognizable, use visible text instead.
- Keep at most one primary text action prominent on a compact surface. When
  there are more than two or three secondary actions, move the infrequent ones
  into an overflow menu instead of wrapping several text buttons or exposing a
  wall of icons.
- Keep destructive or rarely used secondary actions in the overflow menu when
  possible. Apply the recovery or confirmation rule from
  [flow-errors](../../flow-errors/SKILL.md); hiding an action in a menu is not a
  substitute for destructive-action safety.
- Preserve the same action hierarchy across responsive layouts. Controls may
  collapse into icons or overflow on narrow screens only when their accessible
  names and discoverability remain intact.

### Floating Overlay Architecture: Dropdown Menus and Comboboxes in Tables or Constrained Sections

- **Portaled Overlay Requirement**: When a `DropdownMenu`, row action menu, `Combobox`, or inline `Select` popover is rendered inside a table row (`<TableCell>`), list item, or constrained card/section (e.g., containers with `overflow-auto`, `overflow-x-auto`, `overflow-hidden`, or `max-h-*`), the expanded menu/options content **MUST portal outside** the container (e.g., via `createPortal(content, document.body)`) using fixed/floating overlay positioning.
- **Overlay Without Layout Reflow or Gaps**: The expanded popup must float cleanly directly above (`đè lên`) the enclosing table, card, or section container. It must not occupy layout space within the parent DOM tree or expand parent dimensions.
- **Strict Prohibition on In-Container Absolute Popups**:
  - ❌ **Forbidden**: Rendering inline `position: absolute` popups directly inside scrollable table/section containers (`overflow-auto`). Doing so causes the browser to expand the container's `scrollHeight`/`scrollWidth` to fit the popup, creating jarring empty whitespace beneath rows and triggering unnecessary, distracting vertical or horizontal scrollbars.
  - ✅ **Correct**: Portaling the popup to `document.body` with `position: fixed` computed from the trigger's `getBoundingClientRect()`. The table or section retains 100% layout and scroll stability with zero phantom whitespace.
- **Boundary & Viewport Detection**:
  - Automatically flip popup orientation (e.g., open upward instead of downward) if the popup would extend beyond the bottom edge of the viewport.
  - Keep popup position synchronized on scroll/resize and automatically dismiss if the trigger scrolls out of the visible viewport.

## E-commerce Checks

- Product cards expose a clear title, price, availability, and primary action.
- Filters and sorting expose their current state and remain usable on narrow screens.
- Cart and checkout actions provide immediate feedback and prevent duplicate submission.
- Validation explains how to fix the field, not only that it is invalid.
- Destructive or irreversible actions require clear confirmation and recovery where feasible.

## Dialog and Modal Architecture

- **Separation of Concerns (Outer Dialog vs. Inner Form)**:
  When creating a Dialog/Modal with form or interactive mutation content, decouple the modal container from the form component:
  - **Outer Dialog Wrapper**: Responsible solely for open/close state orchestration (`isOpen`, `onOpenChange`), accessibility wrapper (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`), viewport sizing/scroll constraints (e.g., `max-w-xl max-h-[90vh] overflow-y-auto`), and container padding (e.g., `p-6 sm:p-7`).
  - **Inner Form Component**: A self-contained organism managing its own input controls, React Hook Form state, Zod validation schema, submission mutation, error banners, and action buttons (Submit/Cancel). The form accepts an `embedded?: boolean` prop and callbacks (`onSuccess`, `onCancel`) so it can be reused cleanly on a standalone page or embedded in a dialog.
```tsx
// 1. Outer Dialog Wrapper (controls visibility, layout constraints, header & padding)
export function CreateUserDialog({ isOpen, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const t = useTranslations('users.form');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <UserAccessForm
          mode="create"
          embedded
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// 2. Inner Form Organism (encapsulates fields, RHF, Zod validation, submission & actions)
export function UserAccessForm({ embedded, onSuccess, onCancel }: UserAccessFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    await submitMutation(values);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input {...register('email')} aria-invalid={Boolean(errors.email)} />
      {errors.email && <p className="text-xs text-semantic-error">{errors.email.message}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Submit
        </Button>
      </div>
    </form>
  );
}
```

## Web Review Criteria Summary

Use this summary during review to verify UX outcomes (formal verification gate is in `.agents/skills/checklist/SKILL.md`):

- [ ] Semantic controls, accessible names, keyboard navigation, and visible focus states work.
- [ ] Forms have labels, inline errors, loading states, and useful recovery guidance.
- [ ] Dialogs decouple the outer modal shell/padding from the inner self-contained form organism.
- [ ] Decorative icons are hidden; meaningful icons have text alternatives.
- [ ] Responsive behavior works at small phone, desktop, and landscape widths.
- [ ] Sticky/fixed UI does not obscure content or focus.
- [ ] Contrast (WCAG AA 4.5:1 for normal text) and interaction states work in every supported theme.
- [ ] Reduced motion is respected and no interaction depends on motion alone.
- [ ] Loading skeletons and empty states preserve layout stability and provide clear next actions.
- [ ] Dropdown menus and combobox popovers in tables or scrollable sections portal outside the container to overlay cleanly without expanding whitespace or spawning scrollbars.
