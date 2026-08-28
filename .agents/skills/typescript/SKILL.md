---
name: typescript-convention
description: >
  Pure TypeScript coding standards and type-safety rules. Covers types vs interfaces, no any, explicit returns, naming conventions, immutability, barrel imports, nullish coalescing, and const/let.
---

# TypeScript Coding Standards

This skill defines pure TypeScript rules. Domain business rules must not be placed here; refer to `business-logic` skill for business rules.

---

## 1. Types Over Interfaces
Always use `type` instead of `interface` for props, state, payloads, and object shapes.

```typescript
// ✅ CORRECT
type UserProfile = {
  id: string;
  name: string;
  email: string;
};

// ❌ INCORRECT
interface UserProfile {
  id: string;
  name: string;
  email: string;
}
```

---

## 2. No `any` — Use `unknown` + Type Guards
Never use `any`. Use `unknown` and narrow types using type guards, Zod schemas, or generic type parameters.

```typescript
// ✅ CORRECT
function parseApiResponse(data: unknown): UserProfile {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    return data as UserProfile;
  }
  throw new Error('Invalid payload structure');
}

// ❌ INCORRECT
function parseApiResponse(data: any): any {
  return data;
}
```

---

## 3. Explicit Return Types for Public Functions & Services
Always provide explicit return types on exported functions, services, server actions, and API handlers to prevent unintended type inference drift.

```typescript
// ✅ CORRECT
export async function calculateMetrics(userId: string): Promise<UserMetricsResult> {
  // ...
}

// ❌ INCORRECT
export async function calculateMetrics(userId: string) {
  // ...
}
```

---

## 6. Naming Conventions
- **PascalCase**: Types, Enums, Component files (`CustomerOrder`, `TierType`, `UserCard.tsx`).
- **camelCase**: Variables, functions, hook files, service methods (`getUserById`, `useCustomerData`).
- **UPPER_CASE**: Module-level constants and configuration values (`MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`).

```typescript
// ✅ CORRECT
const MAX_TIMEOUT_MS = 5000;
type OrderFilter = { status: string };
function fetchOrderList() {}
```

---

## 8. Immutability & Spread Syntax
Never mutate objects or arrays directly. Use spread syntax or immutable operations. Do not use `Object.assign`.

```typescript
// ✅ CORRECT
const updatedList = [...originalList, newItem];
const updatedRecord = { ...existingRecord, status: 'active' };

// ❌ INCORRECT
originalList.push(newItem);
Object.assign(existingRecord, { status: 'active' });
```

---

## 9. Modular & Barrel Imports
Import types and utilities through clean barrel files (`index.ts`) instead of deep internal directory paths.

```typescript
// ✅ CORRECT
import { Customer, Order } from '@/types';
import { formatDate } from '@/lib/utils';

// ❌ INCORRECT
import { Customer } from '@/types/subfolder/customer/model/Customer';
```

---

## 10. Nullish Coalescing & Optional Chaining
Use `??` (nullish coalescing) and `?.` (optional chaining) instead of `||` (logical OR) to avoid accidental bugs with falsy values like `0` or `""`.

```typescript
// ✅ CORRECT
const displayCount = count ?? 0;
const userName = user?.profile?.name ?? 'Guest';

// ❌ INCORRECT
const displayCount = count || 0; // Bugs when count is 0
```

---

## 11. No `var` — Use `const` and `let`
Always use `const` by default. Use `let` only when a variable needs reassignment. Never use `var`.

```typescript
// ✅ CORRECT
const maxLimit = 100;
let currentIndex = 0;

// ❌ INCORRECT
var total = 0;
```

---

## 12. Commenting Guidelines: Descriptive Block Comments Recommended, Positional Numbering & Trivial Comments Prohibited
Adding comments to code blocks to clarify domain intent, business rationale, safety rules, and complex algorithms is **highly recommended**. However, assigning positional numbers, step sequences, section indices, or trivial syntax restatements is **prohibited**.

- **Recommended — Purpose & Intent Comments**: Write concise comments above logical code blocks explaining **what domain goal** it accomplishes or **why** specific logic exists.
- **Prohibited — Positional & Sequence Markers**: Do **NOT** prefix comments with step numbers or positional indicators (e.g., no `// 1. ...`, `// Step X`, `// Part A`).
- **Prohibited — Trivial Syntax Comments**: Do **NOT** write redundant comments that merely restate what code syntax does (e.g., `// Check regex`, `// Call API`).

```typescript
// ❌ INCORRECT: Trivial syntax restatement without domain intent
// Check phone regex
if (PHONE_REGEX.test(text)) { ... }

// ✅ CORRECT: Descriptive block comments explaining purpose without positional numbering
// Validate text against sensitive PII exposure patterns (phone, email, payment cards)
if (PHONE_REGEX.test(text)) { ... }
```

> 📖 **Full Example**: See [`examples/commenting_guidelines.md`](file:///c:/University/Study/Programming/Web_React/ecommerce_integrate/.agents/skills/typescript/examples/commenting_guidelines.md).



