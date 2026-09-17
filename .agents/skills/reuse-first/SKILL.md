---
name: reuse-first
description: >
  Verifies repository reuse before adding or duplicating services, utilities,
  hooks, schemas, types, models, or UI components. Load when implementation or
  review introduces a new abstraction, file, public export, or parallel code
  path that may already exist in OmniCart.
---

# Reuse-First Engineering

Use this skill to decide whether new code should reuse, extend, compose, or
replace an existing repository capability. It does not require reuse when the
existing abstraction has incompatible semantics or would create tighter
coupling than a small new implementation.

## Required Discovery

Before accepting a new abstraction or duplicated-looking implementation:

1. Identify the capability and layer being added: component, hook, schema,
   type, utility, service, Prisma model, query helper, or configuration.
2. Search the repository by business term and structural role, including the
   nearest feature, public barrel exports, and likely shared directories.
3. Inspect the closest candidates and their callers. A matching filename is
   not evidence of matching behavior.
4. Choose the smallest valid outcome:
   - reuse the existing API unchanged;
   - extend the existing API when responsibility and invariants are the same;
   - compose or adapt it when only the boundary differs;
   - add new code when the behavior or ownership is genuinely distinct.

Do not deep-import a private implementation merely to claim reuse. Respect the
existing public barrel or promote the capability deliberately when it is meant
to become shared.

## Layer-Specific Search Targets

| Changed area | Inspect before adding code |
| --- | --- |
| Backend | Existing services, service-private helpers, `src/utils`, validators, configuration, repository error/result types, and Prisma models |
| Frontend | `src/components/atoms`, `src/components/molecules`, feature components, `src/hooks`, TanStack Query hooks, and Jotai atoms |
| Forms | Existing Zod schemas, schema factories, form field components, error presentation, and shared form hooks |
| Types | Existing barrel exports, Prisma-generated types, Zod-inferred types, and shared result/payload types |
| Database | Existing models, relations, catalog/status tables, indexes, and persistence helpers before adding parallel concepts |

For visual UI changes, also follow `../ui-ux-pro-max/rules/style-discovery.md`;
it owns visual precedent and token reuse. This skill owns code-capability reuse.

## Review Standard

Treat duplication as a violation only when the review can cite:

- the existing capability and its public import path;
- the new overlapping implementation;
- why the existing contract satisfies the new use case; and
- the smallest reuse or extension that removes the duplication.

If compatibility is uncertain, report a question or suggestion rather than a
violation. Do not recommend a broad abstraction solely because two short code
blocks look similar.

---

## Examples: Good vs Bad Reuse Decisions

### 1. UI Components (Atoms & Molecules)

#### ❌ Wrong — Re-inventing styles and raw markup in a feature component
```tsx
export function UserStatusBadge({ status }: { status: string }) {
  // WRONG: Duplicating color schemes, typography, and rounded styles locally
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      {status}
    </span>
  );
}
```

#### ✅ Correct — Reusing existing atom from public barrel with variant prop
```tsx
import { StatusBadge } from '@/components/atoms';

export function UserStatusBadge({ status }: { status: 'active' | 'suspended' | 'pending' }) {
  const variantMap = {
    active: 'success',
    suspended: 'destructive',
    pending: 'warning',
  } as const;

  return <StatusBadge variant={variantMap[status]}>{status}</StatusBadge>;
}
```

---

### 2. Data Fetching & Hooks (TanStack Query / Custom Hooks)

#### ❌ Wrong — Hand-rolling ad-hoc fetch and local state in a component
```tsx
export function OrderListPanel({ connectionId }: { connectionId: number }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders?connectionId=${connectionId}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
        setIsLoading(false);
      });
  }, [connectionId]);

  // WRONG: Bypasses TanStack cache deduplication, retry policy, and shared invalidation
  ...
}
```

#### ✅ Correct — Reusing established TanStack Query hook from `@/hooks`
```tsx
import { useOrders } from '@/hooks';

export function OrderListPanel({ connectionId }: { connectionId: number }) {
  // Encapsulates caching, stale-time, parameter serialization, and error handling
  const { data: orders, isLoading, error } = useOrders({ connectionId });
  ...
}
```

---

### 3. Validation Schemas & Inferred Types (Forms & Actions)

#### ❌ Wrong — Redefining duplicate schema and manual type in action or service
```typescript
// in src/actions/userAccessActions.ts:
const manualUserUpdateSchema = z.object({
  userId: z.number(),
  roleId: z.number(),
  contactEmail: z.string().email(), // May silently diverge from form validation regex!
});
type ManualUserUpdateInput = { userId: number; roleId: number; contactEmail: string };
```

#### ✅ Correct — Reusing shared schema and deriving type via `z.infer`
```typescript
// in src/forms/schemas/userAccessSchema.ts:
export const userAccessUpdateSchema = z.object({
  userId: z.number().int().positive(),
  roleId: z.number().int().positive(),
  contactEmail: z.string().email().optional(),
});
export type UserAccessUpdateInput = z.infer<typeof userAccessUpdateSchema>;

// in src/actions/userAccessActions.ts:
import { userAccessUpdateSchema, type UserAccessUpdateInput } from '@/forms/schemas';
```

---

### 4. Barrel Imports vs Private Deep Imports

#### ❌ Wrong — Deep-importing internal implementation files
```typescript
import { Button } from '@/components/atoms/Button/Button';
import { formatCurrency } from '@/utils/helpers/currencyFormatter';
import { useDebounce } from '@/hooks/useDebounce';
```

#### ✅ Correct — Importing directly from public barrel exports
```typescript
import { Button } from '@/components/atoms';
import { formatCurrency } from '@/utils';
import { useDebounce } from '@/hooks';
```

---

### 5. Knowing When NOT to Force Reuse (False Abstractions)

#### ❌ Wrong — Cramming two divergent business flows into one bloated function
```typescript
// WRONG: Forcing webhook background sync and manual customer-care order creation together
export async function processOrder(
  data: unknown,
  mode: 'sync_webhook' | 'customer_care_manual',
  options?: { skipInventory?: boolean; notifyCustomer?: boolean; forceVipOverride?: boolean }
) {
  if (mode === 'sync_webhook') {
    // 50 lines of webhook idempotency & platform payload normalization
  } else {
    // 60 lines of agent authorization checks & manual payment overrides
  }
}
```

#### ✅ Correct — Separate services for distinct lifecycles, sharing only atomic helpers
```typescript
// in src/services/orderSyncService.ts:
export async function syncMarketplaceOrderService(payload: MarketplaceOrderWebhook, tx: DbClient): Promise<void> {
  // Webhook-specific idempotency, platform verification, and batch sync
}

// in src/services/orderService.ts:
export async function createManualCustomerOrderService(input: ManualOrderInput, tx: DbClient): Promise<Order> {
  // Agent permission checks, user session attribution, and customer notifications
}

// Shared atomic utilities (e.g. calculateTax, formatCurrency) are reused as pure functions.
```

