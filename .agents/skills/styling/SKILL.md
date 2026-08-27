---
name: styling-convention
description: >
  Pure styling conventions using Tailwind CSS and cn() utility. Covers utility classes, class merging, layout & spacing consistency, and component state variants.
---

# Styling & UI Conventions

This skill defines pure styling rules. Domain business rules must not be placed here; refer to `business-logic` skill for business rules.

---

## 1. Tailwind CSS Utility Classes (No Inline Styles)
Always use Tailwind CSS utility classes. Never use inline styles (`style={{ ... }}`) except for dynamic CSS variables (e.g. calculated runtime positions).

```tsx
// ✅ CORRECT
<div className="flex items-center gap-4 rounded-lg bg-neutral-900 p-4 shadow-sm" />

// ❌ INCORRECT
<div style={{ display: 'flex', alignItems: 'center', padding: '16px', background: '#171717' }} />
```

---

## 2. Dynamic Class Merging with `cn()`
Always use the `cn()` utility (`clsx` + `tailwind-merge`) when applying conditional or merged class names. Never use manual string concatenation or template literal interpolation.

```tsx
// ✅ CORRECT
import { cn } from '@/lib/utils';

<button
  className={cn(
    'rounded-md px-4 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700',
    className
  )}
/>

// ❌ INCORRECT
<button className={`px-4 py-2 ${isActive ? 'bg-blue-600' : 'bg-neutral-800'} ${className}`} />
```

---

## 5. Layout & Spacing Consistency
Use Tailwind's standard design tokens for spacing, padding, margins, and flex/grid gaps (`p-2`, `p-4`, `p-6`, `gap-3`, `gap-6`). Avoid arbitrary values like `p-[17px]` unless specifically required by pixel-perfect designs.

```tsx
// ✅ CORRECT
<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
  <aside className="space-y-4 p-4" />
  <main className="col-span-2 space-y-6 p-6" />
</div>
```

---

## 6. Component States & Interactive Variants
Always provide clear interactive states (hover, focus-visible, active, disabled) using Tailwind modifiers:

```tsx
// ✅ CORRECT
<button
  disabled={isDisabled}
  className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
>
  Submit
</button>
```
