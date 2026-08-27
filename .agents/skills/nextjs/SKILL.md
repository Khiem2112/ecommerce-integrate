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
                    ↓
[ Services (src/services/) ]
                    ↓
[ Prisma Client Singleton (src/lib/prisma.ts) ]
                    ↓
[ Database ]
```

**Hard Boundaries:**
- Server Actions **MUST NOT** call `prisma.*` directly (except transactions `prisma.$transaction`).
- Services **MUST NOT** call Server Actions.
- Hooks & Components **MUST NOT** call Services or Prisma directly.

---

## 2. Server Actions (`'use server'`) for Mutations
- Use Server Actions for standard user mutations, state transitions, and form submissions.
- Always validate inputs (via Zod or schema guards).
- Always return a standardized response object `{ success: boolean, data?: T, error?: string }`.
- Call underlying **Services** for database operations and business logic.

```typescript
// src/actions/itemActions.ts
'use server';

import { updateItemStatusService } from '@/services/itemService';
import { revalidatePath } from 'next/cache';

export async function updateItemStatusAction(input: { id: number; status: string }) {
  try {
    if (!input.id || !input.status) {
      return { success: false, error: 'Invalid payload' };
    }

    const updated = await updateItemStatusService(input.id, input.status);
    revalidatePath('/');
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in updateItemStatusAction:', error);
    return { success: false, error: 'Failed to update item status' };
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

## 6. Services & Utils Layer (`src/services/` & `src/utils/`)
- **Services (`src/services/`)**: All database mutations, Prisma queries, and data workflows live inside Services.
- **Utils (`src/utils/`)**: Pure helper functions, string formatters, prompt builders, regex validators, and external API client callers.
- **Utils Separation Rule**:
  - **Large / Complex Services (Extract to `src/utils/<domain>/`)**: Only extract helpers into `src/utils/` when a service contains numerous helper functions, prompt templates, multi-step safety validators, or SDK invocation wrappers (e.g., `src/services/rag/` → `src/utils/rag/`).
  - **Simple Services (Keep inside Service)**: If a service only has 1–2 small internal helpers, keep them directly inside the service file itself to avoid over-engineering and premature file fragmentation.

```typescript
// src/services/itemService.ts
import { prisma } from '@/lib/prisma';

export async function updateItemStatusService(id: number, status: string) {
  return await prisma.item.update({
    where: { id },
    data: { status },
  });
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
