---
name: backend-data-safety
description: >
  Enforces Prisma-derived data types and safe transaction boundaries in
  OmniCart backend code. Load when reviewing or changing actions, services,
  route handlers, jobs, Prisma payload types, or transaction callbacks.
---

# Backend Data and Transaction Safety

This skill supplements the layering rules in `../nextjs/SKILL.md`. Use it for
two failure-prone boundaries: types that mirror persisted data and work
performed while a database transaction is open.

## Derive Persisted Shapes From Authoritative Types

Do not hand-copy an entire Prisma model or Prisma input shape into a new DTO.
Prefer the narrowest generated or inferred source that matches the boundary:

- `Prisma.<Model>GetPayload<{ select: ... }>` or an equivalent generated
  payload for selected records and relation-aware results;
- Prisma-generated create/update input types, or the corresponding generated
  operation argument, for persistence inputs;
- `Pick`, `Omit`, and intersections over a generated base for deliberate
  application-specific projections;
- `z.input`, `z.output`, or `z.infer` for payloads whose authority is a Zod
  validation schema.

A separate type is appropriate when it represents a genuinely different
contract, such as an external provider payload, a serialized client view,
computed fields, or a security-filtered response. Even then, derive overlapping
persisted fields from the generated base where practical instead of copying
them field by field.

Do not expose a full Prisma record to the client merely to maximize type reuse.
Privacy, serialization, and boundary-specific naming still require an explicit
projection.

### ❌ Wrong — Hand-copying Prisma model fields into a parallel DTO type

```typescript
// in src/types/userAccess.ts:
// WRONG: Manually maintaining redundant fields that drift when schema changes
export type UserAccessDetailDTO = {
  id: number;
  displayName: string;
  organizationId: number;
  user: {
    id: number;
    email: string;
    avatarUrl: string | null;
  };
  role: {
    id: number;
    code: string;
    name: string;
  };
  membershipStatus: {
    id: number;
    code: string;
    name: string;
  };
};
```

### ✅ Correct — Deriving query payload types via `Prisma.<Model>GetPayload`

```typescript
import type { Prisma } from '@prisma/client';

// CORRECT: Fully typed by Prisma query shape; updates automatically with schema changes
export type UserAccessDetailPayload = Prisma.OrganizationMemberGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        avatarUrl: true;
      };
    };
    role: true;
    membershipStatus: true;
  };
}>;
```

### ❌ Wrong — Exposing raw full Prisma entity with sensitive internal fields

```typescript
// in src/services/userService.ts:
// WRONG: Returning entire User model directly to client leaks passwordHash and internal fields
export async function getUserProfile(userId: number): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user; // Leaks passwordHash, mustChangePassword, passwordChangedAt
}
```

### ✅ Correct — Explicit client projection using select or Pick

```typescript
// in src/types/user.ts:
export type SafeUserProfile = Pick<User, 'id' | 'displayName' | 'email' | 'avatarUrl'>;

// in src/services/userService.ts:
export async function getUserProfile(userId: number): Promise<SafeUserProfile> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
    },
  });
}
```

---

## Transaction Boundary

Inside an interactive `prisma.$transaction` callback, perform only:

- database work through the injected `tx` client; and
- short, deterministic in-memory computation required by that database work.

Do not wait on external or non-transactional I/O while the transaction is open:

- HTTP calls through `fetch`, Axios, or third-party SDKs;
- email, messaging, webhook, queue, storage, or payment calls;
- file-system reads or writes;
- sleeps, polling, user interaction, or open-ended retries.

External reads needed to prepare a mutation should normally finish before the
transaction starts. Irreversible side effects should normally happen after the
commit. When a durable external effect must be coordinated with the commit,
write an intent/outbox record in the transaction and process it idempotently
afterward instead of pretending a database transaction covers the external
system.

Services that accept `tx` must keep the transaction-executed path free of
external I/O. Split preparation, transactional persistence, and post-commit
effects into separate functions when one service currently mixes them.

### ❌ Wrong — External I/O (HTTP / Email / Webhooks) inside transaction

```typescript
// in src/actions/userAccessActions.ts:
export async function inviteMemberAction(input: InviteInput) {
  await prisma.$transaction(async (tx) => {
    const member = await tx.organizationMember.create({ data: input });

    // ❌ WRONG: External HTTP / SMTP call inside transaction!
    // Holds DB connection and row locks open during slow network latency:
    await sendWelcomeEmail(member.contactEmail);
    await notifySlackWebhook('New member joined');

    await tx.organizationAuditLog.create({ ... });
  });
}
```

### ✅ Correct — Pure database operations in transaction; side effects post-commit

```typescript
// in src/actions/userAccessActions.ts:
export async function inviteMemberAction(input: InviteInput) {
  // Transaction executes strictly DB operations through tx
  const createdMember = await prisma.$transaction(async (tx) => {
    const member = await createMemberService(input, tx);
    await appendOrganizationAuditService(
      {
        organizationId: member.organizationId,
        actorUserId: input.actorUserId,
        action: 'member.invite',
        targetType: 'member',
        targetId: String(member.id),
      },
      tx,
    );
    return member;
  });

  // External side-effects execute AFTER transaction successfully commits
  try {
    await sendWelcomeEmail(createdMember.contactEmail);
  } catch (err) {
    // Non-fatal: Log error or enqueue background retry without rolling back committed DB data
    logger.error('Failed to send welcome email', err);
  }
}
```

---

## Review The Call Graph

Checking only the transaction callback text is insufficient. Follow every
service invoked from the callback far enough to verify that it:

- uses the injected `tx` rather than the singleton Prisma client;
- does not call external I/O indirectly; and
- does not silently start an unrelated nested transaction.

Server Actions may initiate and orchestrate a transaction, but ordinary Prisma
queries and mutations remain service responsibilities under the Next.js layer
rules.

### ❌ Wrong — Transaction callback invoking service that uses singleton `prisma`

```typescript
// in src/services/auditService.ts:
import { prisma } from '@/lib/prisma';

export async function logAuditEvent(action: string, targetId: string) {
  // WRONG: Hardcoded singleton prisma ignores outer transaction!
  await prisma.organizationAuditLog.create({
    data: { action, targetId },
  });
}

// In caller:
await prisma.$transaction(async (tx) => {
  await tx.organization.update({ ... });
  // If transaction rolls back, audit log remains committed because it bypassed `tx`!
  await logAuditEvent('org.update', orgId);
});
```

### ✅ Correct — Threading `tx: DbClient = prisma` through the call chain

```typescript
import { prisma } from '@/lib/prisma';
import type { DbClient } from '@/types';

// Service accepts optional tx client defaulting to prisma singleton
export async function appendOrganizationAuditService(
  input: AppendOrganizationAuditInput,
  tx: DbClient = prisma,
): Promise<void> {
  await tx.organizationAuditLog.create({
    data: input,
  });
}

// Transaction orchestrator passes `tx` explicitly
await prisma.$transaction(async (tx) => {
  await updateOrganizationService(orgId, updateData, tx);
  // Uses same transaction client: rolls back cleanly if update fails
  await appendOrganizationAuditService({ action: 'org.update', targetId: orgId }, tx);
});
```

