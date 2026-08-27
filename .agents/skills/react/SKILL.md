---
name: react-convention
description: >
  Pure React conventions. Covers function components, props typing, handler callbacks, stable keys, Jotai & RHF state, useEffect dependencies, and loading/empty states.
---

# React Component Conventions

This skill defines pure React development standards. Domain business rules must not be placed here; refer to `business-logic` skill for business rules.

---

## 1. Function Components Only
Always use standard named Function Components. Never use class components.

```tsx
// ✅ CORRECT
export function UserProfileCard({ user, onSelect }: UserProfileCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <h3>{user.name}</h3>
    </div>
  );
}

// ❌ INCORRECT
export class UserProfileCard extends React.Component { ... }
```

---

## 2. Props Typing with `type`
Define component props using `type` (not `interface`), placed immediately above the component or imported from types.

```tsx
// ✅ CORRECT
type UserProfileCardProps = {
  user: User;
  onSelect?: (id: string) => void;
  className?: string;
};
```

---

## 4. Handler Naming & `useCallback`
- Prefix handler functions with `handle` (e.g. `handleClick`, `handleSubmit`) and prop callbacks with `on` (e.g. `onClick`, `onSelect`).
- Wrap handlers in `useCallback` when passed as props to child components to maintain stable references.

```tsx
// ✅ CORRECT
const handleSelect = useCallback((id: string) => {
  onSelect?.(id);
}, [onSelect]);
```

---

## 5. Stable Keys in List Rendering
Always use unique, stable string/number IDs for `key` props. Never use array index as `key` for dynamic or filterable lists.

```tsx
// ✅ CORRECT
{items.map((item) => (
  <ListItem key={item.id} data={item} />
))}

// ❌ INCORRECT
{items.map((item, index) => (
  <ListItem key={index} data={item} />
))}
```

---

## 6. State Management: Jotai for Global Atoms & React Hook Form (RHF) for Forms
- Use **Jotai** atoms (`useAtom`, `useSetAtom`, `useAtomValue`) for lightweight, decoupled client state across components.
- Use **React Hook Form (RHF)** + Zod for all form state, validation, and submission. **Do not use Redux or Formik.**

```tsx
// ✅ Jotai Atom Usage
import { useAtom } from 'jotai';
import { activeItemIdAtom } from '@/atoms/itemAtom';

const [activeId, setActiveId] = useAtom(activeItemIdAtom);

// ✅ React Hook Form Usage
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { itemFormSchema, type ItemFormValues } from '@/forms/itemForm';

const { register, handleSubmit, formState: { errors } } = useForm<ItemFormValues>({
  resolver: zodResolver(itemFormSchema),
});
```

---

## 7. Clean `useEffect` Lifecycle & Dependencies
- Never omit required dependencies from the `useEffect` dependency array.
- Avoid unnecessary effects when state can be derived directly during rendering.

```tsx
// ✅ Derived state during render (no effect needed)
const fullName = `${firstName} ${lastName}`;

// ✅ Correct effect with dependencies
useEffect(() => {
  const timer = setTimeout(() => {
    onDebouncedSearch(query);
  }, 300);
  return () => clearTimeout(timer);
}, [query, onDebouncedSearch]);
```

---

## 8. Loading Skeletons & Empty States
Always handle asynchronous loading and empty data states explicitly with dedicated UI components:

```tsx
// ✅ CORRECT
if (isLoading) return <TableSkeleton rows={5} />;
if (!items || items.length === 0) {
  return <EmptyState title="No records found" description="Try adjusting your filter criteria." />;
}
return <DataTable data={items} />;
```
