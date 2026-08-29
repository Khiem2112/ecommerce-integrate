---
name: nextjs-convention
description: >
  Pure Next.js App Router conventions. Covers strict layered architecture, Server Actions, dedicated API routes, TanStack Query for data fetching, Services, and Custom Hooks.
---

# Next.js App Router Conventions

This skill defines pure Next.js architectural standards. Domain business rules must not be placed here; refer to `business-logic` skill for business rules.

---

## 1. Strict Layered Architecture

Always maintain strict separation across architectural boundaries:

```
[ UI / React Components (src/components/) ]
                    ↓
[ Custom Hooks & TanStack Query (src/hooks/) ]   +   [ Jotai Atoms (src/atoms/) ]
                    ↓
[ Server Actions (src/actions/) ]     /   [ Dedicated API Routes (src/app/api/) ]
                    ↓ (orchestrates & passes transaction `tx`)
[ Services & Business Logic (src/services/) ]
  ├── Database Calls (Prisma `prisma` / `tx`)
  ├── External APIs (Payment, AI, Logistics)
  ├── File I/O (Logs, Reports, PDFs)
  └── Orchestrates Sub-Services
                    ↑ (can be called anywhere)
[ Pure Utils (src/utils/) ] (Pure, stateless, format/regex/prompt only - NO DB, NO API, NO File I/O)
                    ↓
[ Prisma Client Singleton (src/lib/prisma.ts) ]
                    ↓
[ Database ]
```

### Layer Responsibilities Overview

| Layer | Path | Core Responsibility | Can Call DB / API / File I/O? |
| :--- | :--- | :--- | :--- |
| **Actions** | `src/actions/` | Manage/orchestrate calls to Services, validate input schemas, manage transactions across services, revalidate caches, return standardized action responses. | **No direct DB/API/File logic** (Only initiates `prisma.$transaction` to pass `tx` to Services). |
| **Services** | `src/services/` | Execute all domain & business logic. Single-responsibility functions. Performs DB queries (using default Prisma or injected `tx`), calls external APIs, reads/writes files, calls other services. | **YES** (The single execution hub for all I/O & business logic). |
| **Utils** | `src/utils/` | Pure, stateless functions. Data formatting, regex validation, string manipulation, prompt generation, math calculations. | **STRICTLY NO** (No DB, No API, No File I/O, No Side Effects). |

**Hard Boundaries:**
- Server Actions **MUST NOT** execute direct business logic or direct `prisma.*` queries (except initiating `prisma.$transaction` to pass `tx` context to services).
- Services **MUST NOT** call Server Actions.
- Utils **MUST NOT** call Prisma, external APIs, or file system APIs.
- Hooks & Components **MUST NOT** call Services or Prisma directly.

> 📖 **Full Good vs. Bad Practice Code Examples**: See [`examples/layer_practices.md`](.agents/skills/nextjs/examples/layer_practices.md).

---

## 2. Server Actions (`src/actions/`): Orchestration & Transactions

### Core Rules
1. **Orchestration Hub**: Server Actions receive requests from client forms or mutation hooks, validate inputs (via Zod), and orchestrate one or more Services.
2. **Transaction Management**: When multiple database operations/services must execute atomically in a single transaction, the Action initiates `prisma.$transaction` and passes the transaction client `tx` into each service function.
3. **Standard Response**: Always return `{ success: boolean, data?: T, error?: string }`.
4. **Cache Invalidation**: Call `revalidatePath` or `revalidateTag` inside Actions after successful mutations.

```typescript
// src/actions/orderActions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { checkoutSchema } from '@/forms/checkoutForm';
import { validateCartService } from '@/services/cartService';
import { createOrderService } from '@/services/orderService';
import { deductProductStockService } from '@/services/inventoryService';
import { revalidatePath } from 'next/cache';

export async function checkoutAction(payload: unknown) {
  try {
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const { cartId, paymentMethod } = parsed.data;
    const cart = await validateCartService(cartId);

    // Atomically execute multiple service queries inside a Prisma transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await createOrderService({ cartId, total: cart.total, paymentMethod }, tx);
      await deductProductStockService(cart.items, tx);
      return newOrder;
    });

    revalidatePath('/orders');
    return { success: true, data: order };
  } catch (error) {
    console.error('Error in checkoutAction:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Checkout failed' };
  }
}
```

---

## 3. Dedicated API Routes (`src/app/api/...`)
Use Route Handlers (`route.ts`) exclusively for:
- AI streaming & long-running generative processes (e.g. `/api/rag/generate`).
- External webhooks and third-party integrations (e.g. `/api/webhooks/marketplace`).
- Public REST endpoints.

```typescript
// src/app/api/rag/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeRagPipelineService } from '@/services/rag/ragPipelineService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await executeRagPipelineService(body.conversationId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
```

---

## 4. Client-Side Data Fetching with TanStack Query (Replaces SWR)
Use **TanStack Query (`@tanstack/react-query`)** for client-side caching, polling, revalidation, and optimistic updates.

```tsx
// src/hooks/useConversationsQuery.ts
import { useQuery } from '@tanstack/react-query';

export function useConversationsQuery(filter: { tier?: string; status?: string }) {
  return useQuery({
    queryKey: ['conversations', filter],
    queryFn: async () => {
      const res = await fetch(`/api/conversations?tier=${filter.tier ?? ''}`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 10000, // Background polling every 10s
  });
}
```

---

## 5. Services Layer (`src/services/`): Business Logic Execution

### Core Rules
1. **Domain Logic Execution Hub**: All business algorithms, database queries, file reading/writing, external API calls, and sub-service coordination reside here.
2. **Single Responsibility Principle (SRP)**: Each service function must perform one well-defined task (e.g., `createOrderService`, `deductProductStockService`, `logOrderAuditService`).
3. **Transaction-Aware Database Operations**: Service functions that query/mutate DB should accept an optional `tx?: Prisma.TransactionClient | typeof prisma` parameter. Default to the singleton `prisma` instance if `tx` is not passed.
4. **I/O Capabilities**: Services are authorized to call Prisma / Database, external APIs, and file I/O.

```typescript
// src/services/orderService.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | typeof prisma;

// Single Responsibility: Create order record in DB
export async function createOrderService(
  data: { cartId: number; total: number; paymentMethod: string },
  tx: DbClient = prisma
) {
  return await tx.order.create({
    data: {
      cartId: data.cartId,
      totalAmount: data.total,
      paymentMethod: data.paymentMethod,
      status: 'PROCESSING',
    },
  });
}
```

---

## 6. Utils Layer (`src/utils/`): Pure & Stateless Functions

### Core Rules
1. **Pure & Stateless**: Given identical inputs, a util function MUST ALWAYS return the identical output. No side effects.
2. **Strict Prohibitions**:
   - ❌ **NO Database Access**: Never import or call Prisma or raw SQL queries.
   - ❌ **NO External API Calls**: Never use `fetch`, `axios`, or external network clients.
   - ❌ **NO File I/O**: Never use `fs`, `path` file writing/reading.
   - ❌ **NO Mutable Global State**: No in-memory caches or mutable module variables.
3. **Allowed Responsibilities**: Formatting (currency/date), regex validations, string parsing, mathematical formulas, prompt builders.
4. **Universal Invocation**: Can be safely called from anywhere (Components, Hooks, Actions, Services, API Routes).
5. **Local Service Helpers (Avoid Premature Extraction)**: If the helper logic is small (1–2 lines, simple string concatenation, private calculation) and only used locally inside that service, it can be kept directly within the service file instead of creating a separate file in `src/utils/` to avoid over-engineering and premature file fragmentation. Extract to `src/utils/<domain>/` only when helpers are complex, reusable across multiple files, or large.


```typescript
// src/utils/formatters.ts
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// src/utils/validators.ts
const VN_PHONE_REGEX = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;
export function isValidVietnamesePhoneNumber(phone: string): boolean {
  return VN_PHONE_REGEX.test(phone?.trim() ?? '');
}
```

---

## 7. Custom Hooks for UI Orchestration (`src/hooks/`)
Encapsulate complex UI logic, TanStack query hooks, and Jotai atom mutations inside custom hooks.

```typescript
// src/hooks/useConversationManager.ts
import { useAtom } from 'jotai';
import { activeIdAtom } from '@/atoms/conversationAtom';
import { useConversationsQuery } from './useConversationsQuery';

export function useConversationManager() {
  const [activeId, setActiveId] = useAtom(activeIdAtom);
  const { data: conversations, isLoading } = useConversationsQuery({});

  const selectConversation = (id: number) => {
    setActiveId(id);
  };

  return { activeId, conversations, isLoading, selectConversation };
}
```

