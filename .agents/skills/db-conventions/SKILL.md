---
name: db-conventions
description: >
  Database schema conventions and field rules for OmniCart.
  Load this skill whenever you are adding, modifying, or reviewing Prisma models
  (schema.prisma), writing migrations, or generating seed data.
---

# OmniCart — Database Schema Conventions

> **When to load**: Adding a new Prisma model, adding fields to an existing model,
> reviewing a PR that touches `schema.prisma`, or generating seed/fixture data.

---

## 1. Mandatory Fields — Every Model Must Have These

Every Prisma model (transactional **and** catalog) **must** declare the following
four fields in **this exact order**, placed at the **bottom** of the field list
(just above `@@map`):

```prisma
isActive  Boolean  @default(true)
createdAt DateTime @default(now())
updatedAt DateTime @default(now()) @updatedAt   // @updatedAt — DB auto-updates this
```

And the primary key **at the very top** of the model:

```prisma
id Int @id @default(autoincrement())
```

### Rules for mandatory fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `Int` | `@default(autoincrement())` | **Always named exactly `id`** — never `orderId`, `conversationId`, `customerId`, etc. as the PK field name. The table name already identifies the entity. |
| `createdAt` | `DateTime` | `@default(now())` | Set once on insert; never updated manually. |
| `updatedAt` | `DateTime` | `@default(now()) @updatedAt` | **Must include `@updatedAt`** so Prisma/the DB updates it automatically on every write. **Never** pass `updatedAt` in `data: { ... }` — doing so overrides the automatic value and defeats the purpose of `@updatedAt`. |
| `isActive` | `Boolean` | `@default(true)` | Soft-delete flag. Use `WHERE isActive = true` for all normal queries. Never hard-delete rows. |

### ❌ Common Mistakes to Avoid

```prisma
// WRONG — PK field name duplicates the table concept
model Conversation {
  conversationId Int @id @default(autoincrement())   // ← WRONG
}

// WRONG — missing @updatedAt — field will never auto-update
updatedAt DateTime @default(now())    // ← WRONG

// WRONG — isActive missing entirely
model SomeNewModel {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  // isActive is absent ← WRONG
  @@map("some_new_model")
}
```

```prisma
// ✅ CORRECT
model SomeNewModel {
  id        Int      @id @default(autoincrement())
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  @@map("some_new_model")
}
```

---

## 2. Platform Scoping — `connectionId` vs `platformId`

### The Rule

> **Tables that belong to a single business/shop must link to `connectionId`
> (`PlatformConnection`), NOT to `platformId` (`PlatformCatalog`).**

### Why

`PlatformCatalog` is a global lookup table (Lazada, Shopee, TikTok Shop …).
`PlatformConnection` represents **one connected shop** operated by one merchant.
Any entity owned by a specific merchant's store (orders, customers, conversations,
sync batches …) must reference `connectionId`.

### ✅ Correct — Shop-scoped entities use `connectionId`

```prisma
model Customer {
  id           Int                @id @default(autoincrement())
  connectionId Int
  connection   PlatformConnection @relation(fields: [connectionId], references: [id])
  ...
}

model Order {
  id           Int                @id @default(autoincrement())
  connectionId Int
  connection   PlatformConnection @relation(fields: [connectionId], references: [id])
  ...
}
```

### ❌ Wrong — Do NOT use `platformId` for shop-scoped entities

```prisma
model SomeEntity {
  id         Int             @id @default(autoincrement())
  platformId Int                                              // ← WRONG
  platform   PlatformCatalog @relation(fields: [platformId], references: [id])
  ...
}
```

### When `platformId` IS appropriate

Only use `platformId` when the entity is **platform-global** — i.e., it describes
something that applies across all shops on that platform, not data specific to one
merchant.

Current precedent: `PlatformConnection` itself holds a `platformId` FK because it
**describes which platform** it connects to.

---

## 3. Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Model name | PascalCase | `OrderStatusHistory`, `AiDraftStrategy` |
| Field name | camelCase | `connectionId`, `platformBuyerId` |
| `@@map` name | snake_case | `order_status_history`, `ai_draft_strategy` |
| FK field | `<relation>Id` camelCase | `connectionId`, `vipTierId`, `currentStatusId` |
| Relation object | camelCase, no `Id` suffix | `connection`, `vipTier`, `currentStatus` |
| Catalog tables | Suffix `Catalog` | `PlatformCatalog`, `VipTierCatalog` |
| Status tables | Suffix `Status` | `OrderStatus`, `ConversationStatus` |

---

## 4. Table Categories and Their Patterns

### Catalog Tables (`*Catalog`)
Reference/lookup data. Seeded once; rarely mutated.

- All four mandatory fields required.
- Expose a human-readable `code String @unique` and `name String`.
- Never store transactional or tenant-specific data here.

### Status Tables (`*Status`)
Dedicated status tracking.

- All four mandatory fields required.
- Expose `code String @unique` and `name String`.
- Add `isFinal Boolean @default(false)` for entities with terminal states.
- Add `sortOrder Int @default(0)` when UI ordering matters.

### Transactional / Core Tables
Mutable data owned by a specific merchant shop.

- Always link to `connectionId` (not `platformId`) for shop-scoped entities.
- All four mandatory fields required.
- Add `@@index([connectionId])` for performance.
- Add `@@unique([connectionId, externalId])` to prevent duplicate platform data.

### Audit / History Tables (`*History`, `*Log`, `*Change`)
Immutable event records.

- `id` and `createdAt` are always required.
- Include `isActive` and `updatedAt` if rows may be logically deleted or corrected.
- For truly append-only audit logs, `isActive`/`updatedAt` may be omitted **with a
  documented reason in a comment**.
- Never update audit records; insert new correction rows instead.

---

## 5. Index Conventions

```prisma
// Index FK fields used in WHERE clauses
@@index([connectionId])

// Compound unique index to prevent duplicate platform data per shop
@@unique([connectionId, platformOrderId])

// Compound query-pattern index (most selective field first)
@@index([conversationId, senderTypeId, timestamp, id])
@@index([conversationId, createdAt])
@@index([conversationId, status])
```

---

## 6. JSON Fields

MySQL does not support native arrays. Use `Json?` for list/array data:

```prisma
frequentCategories Json?    // string[] — array of category codes
groundedFacts      Json?    // string[] — evidence IDs used
groundingViolations Json?   // GroundingViolation[]
```

- Always annotate JSON fields with an inline comment describing the expected shape.
- Keep JSON minimal; prefer FK relations for structured data that needs querying.

---

## 7. Soft-Delete Pattern

Never call `prisma.<model>.delete()` for domain entities.

```typescript
// ✅ CORRECT — soft delete
await prisma.someModel.update({
  where: { id },
  data: { isActive: false },
});

// ❌ WRONG — hard delete
await prisma.someModel.delete({ where: { id } });
```

---

## 7a. Mandatory `isActive` Filter on ALL Read Queries

> **Rule**: Every `findMany`, `findFirst`, and `findUnique` that reads domain
> data **must** include `isActive: true` in the `where` clause unless you are
> explicitly querying for inactive/deleted records.

```typescript
// ✅ CORRECT — findMany always includes isActive filter
await prisma.order.findMany({
  where: { connectionId, isActive: true },
});

// ✅ CORRECT — findFirst includes isActive filter
await prisma.customer.findFirst({
  where: { connectionId, platformBuyerId, isActive: true },
});

// ✅ CORRECT — findUnique by PK is safe (row-level), but
//   always validate isActive in the result before returning
const row = await prisma.conversation.findUnique({ where: { id } });
if (!row || !row.isActive) throw new NotFoundError();

// ❌ WRONG — missing isActive filter silently returns deleted rows
await prisma.order.findMany({
  where: { connectionId },   // ← missing isActive: true
});

await prisma.customer.findFirst({
  where: { platformBuyerId },  // ← missing isActive: true
});
```

---

## 7b. Never Manually Set `updatedAt` in Code

> **Rule**: Do **not** include `updatedAt` in any `data: { ... }` object passed
> to `create`, `update`, or `upsert`. Prisma's `@updatedAt` directive handles
> this automatically. Manual assignment overrides the automatic timestamp and
> creates misleading audit records.

```typescript
// ❌ WRONG — manual updatedAt
await prisma.conversation.update({
  where: { id },
  data: {
    statusId,
    updatedAt: new Date(),   // ← WRONG — remove this
  },
});

// ✅ CORRECT — let @updatedAt handle it
await prisma.conversation.update({
  where: { id },
  data: { statusId },
});
```

---

## 8. Pre-Commit Checklist for Any New / Modified Model

### Schema (`schema.prisma`)
- [ ] PK field is named `id` (not `<entityName>Id`)
- [ ] `isActive Boolean @default(true)` is present
- [ ] `createdAt DateTime @default(now())` is present
- [ ] `updatedAt DateTime @default(now()) @updatedAt` is present with `@updatedAt`
- [ ] Shop-scoped entities link to `connectionId`, not `platformId`
- [ ] `@@map("snake_case_table_name")` is present
- [ ] Appropriate `@@index` declarations added for FK and query patterns
- [ ] JSON fields have inline comments describing their shape
- [ ] Catalog/status tables have a unique `code` field

### Service / Action code
- [ ] All `findMany` / `findFirst` calls include `isActive: true` in `where`
- [ ] All `findUnique` results are checked for `!row.isActive` before use
- [ ] No `data: { updatedAt: ... }` in any `create` / `update` / `upsert` call
- [ ] No `prisma.<model>.delete()` calls — soft-delete only
