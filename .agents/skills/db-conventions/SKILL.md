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

## 1. Mandatory Fields — Mutable Models

Every mutable Prisma model (including transactional, catalog, status, and
correctable history data) **must** declare the `id` primary key plus the three
audit fields below. Place the audit fields in **this exact order** at the
**bottom** of the field list, just above `@@map`. The only exception is a truly
append-only audit/history event model documented under the Audit / History
Tables section below.

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

### ❌ Wrong — Inconsistent casing and redundant naming

```prisma
model order_status {
  order_status_id Int                 @id @default(autoincrement()) // Redundant & snake_case
  ConnectionID    Int                                               // PascalCase / redundant casing
  VipTier         VipTierCatalog      @relation(fields: [VipTierId], references: [id]) // PascalCase relation name
  VipTierId       Int                                               // Inverted field ordering
  @@map("OrderStatus")                                              // PascalCase map instead of snake_case
}
```

### ✅ Correct — Clean casing, normalized FK and relation names

```prisma
model OrderStatus {
  id           Int                @id @default(autoincrement())
  connectionId Int
  connection   PlatformConnection @relation(fields: [connectionId], references: [id])
  vipTierId    Int
  vipTier      VipTierCatalog     @relation(fields: [vipTierId], references: [id])
  isActive     Boolean            @default(true)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @default(now()) @updatedAt

  @@map("order_status")
}
```

---

## 4. Table Categories and Their Patterns

### Catalog Tables (`*Catalog`)
Reference/lookup data. Seeded once; rarely mutated.

- All four mandatory fields required.
- Expose a human-readable `code String @unique` and `name String`.
- Never store transactional or tenant-specific data here.

```prisma
// ❌ WRONG — missing unique code, missing audit fields, storing tenant secrets
model PlatformCatalog {
  id           Int      @id @default(autoincrement())
  platformName String   // Missing unique machine code
  storeApiKey  String?  // WRONG: tenant secrets do not belong in global catalog!
  createdAt    DateTime @default(now())
  // Missing updatedAt and isActive
  @@map("platform_catalog")
}

// ✅ CORRECT — lookup reference data with unique code and name
model PlatformCatalog {
  id        Int      @id @default(autoincrement())
  code      String   @unique // e.g. "lazada" | "shopify" | "tiktok_shop"
  name      String           // e.g. "Lazada" | "Shopify" | "TikTok Shop"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  connections PlatformConnection[]

  @@map("platform_catalog")
}
```

### Status Tables (`*Status`)
Dedicated status tracking.

- All four mandatory fields required.
- Expose `code String @unique` and `name String`.
- Add `isFinal Boolean @default(false)` for entities with terminal states.
- Add `sortOrder Int @default(0)` when UI ordering matters.

```prisma
// ❌ WRONG — missing unique code, terminal flag, and UI ordering
model OrderStatus {
  id    Int    @id @default(autoincrement())
  title String // Missing unique code, isFinal, sortOrder
  @@map("order_status")
}

// ✅ CORRECT — dedicated status tracking with terminal flags and sort order
model OrderStatus {
  id        Int      @id @default(autoincrement())
  code      String   @unique // e.g. "pending", "fulfilled", "cancelled"
  name      String           // e.g. "Pending Approval"
  isFinal   Boolean  @default(false)
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  orders Order[]

  @@map("order_status")
}
```

### Transactional / Core Tables
Mutable data owned by a specific merchant shop.

- Always link to `connectionId` (not `platformId`) for shop-scoped entities.
- All four mandatory fields required.
- Add `@@index([connectionId])` for performance.
- Add `@@unique([connectionId, externalId])` to prevent duplicate platform data.

```prisma
// ❌ WRONG — linked to platformId instead of connectionId, missing unique constraint
model Order {
  id         Int             @id @default(autoincrement())
  platformId Int                                              // WRONG: shop-scoped entity
  platform   PlatformCatalog @relation(fields: [platformId], references: [id])
  externalId String
  // Missing compound unique index allowing duplicate external orders per connection
  isActive   Boolean         @default(true)
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @default(now()) @updatedAt
  @@map("order")
}

// ✅ CORRECT — linked to connectionId with proper index & unique constraint
model Order {
  id              Int                @id @default(autoincrement())
  connectionId    Int
  connection      PlatformConnection @relation(fields: [connectionId], references: [id])
  platformOrderId String             @db.VarChar(100)
  totalAmount     Decimal            @db.Decimal(12, 2)
  isActive        Boolean            @default(true)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @default(now()) @updatedAt

  @@unique([connectionId, platformOrderId])
  @@index([connectionId])
  @@map("order")
}
```

### Audit / History Tables (`*History`, `*Log`, `*Change`)
Audit/history tables record the immutable, chronological history of operations
performed on a database-backed resource. They explain who or what changed a
resource, which operation occurred, and when it occurred; they do not represent
the resource's current state.

- Each row represents one operation or event against one resource.
- Link the event to the concrete resource with its typed foreign key, such as
  `orderId` or `conversationId`; do not rely only on an unvalidated free-form
  identifier when a relation is available.
- Store an operation/action code and the actor or system source when that
  information exists. Store before/after values or structured metadata only
  when they are required to reconstruct or explain the change.
- `id` and `createdAt` are always required.
- A truly append-only audit log may omit `isActive` and `updatedAt` because its
  rows are never mutated or logically deleted. Document that append-only reason
  in a model comment. This is the only exception to the mandatory-field rule.
- If audit rows may be corrected or logically deleted, include `isActive` and
  `updatedAt` and treat the model as mutable history data.
- Never update an append-only audit record. Insert a new correction event that
  references or clearly supersedes the earlier event.

```prisma
// ❌ WRONG — mutating audit logs in place, or untyped loose string identifier
model OrderAuditLog {
  id        Int      @id @default(autoincrement())
  orderRef  String   // Untyped loose string when typed relation is available
  action    String
  updatedAt DateTime @updatedAt // WRONG: mutating audit records destroys audit trail integrity!
  @@map("order_audit_log")
}

// ✅ CORRECT (Append-Only Event Log) — documented exception omitting isActive/updatedAt
/// Append-only audit records deliberately omit isActive and updatedAt; corrections are new events.
model OrderAuditLog {
  id          Int      @id @default(autoincrement())
  orderId     Int
  order       Order    @relation(fields: [orderId], references: [id])
  actorUserId Int?
  action      String   @db.VarChar(100) // e.g. "order.status_changed"
  beforeState Json?    // Redacted snapshot
  afterState  Json?    // Redacted snapshot
  createdAt   DateTime @default(now())

  @@index([orderId, createdAt])
  @@map("order_audit_log")
}

// ✅ CORRECT (Mutable History Table) — when historical entries can be revised or logically deleted
model OrganizationSlugHistory {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  slug           String       @unique @db.VarChar(63)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @default(now()) @updatedAt

  @@index([organizationId])
  @@map("organization_slug_history")
}
```

---

## 5. Index Conventions

### ❌ Wrong — Missing indexes on foreign keys or wrong order in compound index

```prisma
model OrderMessage {
  id             Int      @id @default(autoincrement())
  conversationId Int      // Missing index for FK used in queries!
  senderTypeId   Int
  timestamp      DateTime

  // WRONG: Low-cardinality non-selective field first in compound index:
  @@index([senderTypeId, conversationId, timestamp])
}
```

### ✅ Correct — FKs indexed and compound indexes ordered by most selective query pattern

```prisma
model OrderMessage {
  id             Int      @id @default(autoincrement())
  conversationId Int
  senderTypeId   Int
  timestamp      DateTime

  // Index FK fields used in WHERE clauses & relations:
  @@index([conversationId])

  // Compound unique index to prevent duplicate platform data per shop:
  // @@unique([connectionId, platformOrderId])

  // Compound query-pattern index (most selective field first):
  @@index([conversationId, timestamp, id])
  @@index([conversationId, senderTypeId, timestamp, id])
}
```

---

## 6. JSON Fields

MySQL does not support native arrays. Use `Json?` for list/array data:

### ❌ Wrong — Unannotated JSON or shoving relational 1-to-N entities into JSON

```prisma
model Customer {
  id     Int   @id @default(autoincrement())
  data   Json? // WRONG: Unannotated JSON shape; callers have no type contract
  orders Json? // WRONG: Relational entities in JSON prevents indexes, FK integrity, and joins
}
```

### ✅ Correct — Annotated JSON for auxiliary unstructured data only

```prisma
model Customer {
  id                  Int      @id @default(autoincrement())
  // Always annotate JSON fields with an inline comment describing the expected shape:
  frequentCategories  Json?    // string[] — array of category codes
  groundedFacts       Json?    // string[] — evidence IDs used for AI grounding
  groundingViolations Json?    // GroundingViolation[] — list of rule violation descriptors
  metadata            Json?    // Record<string, unknown> — non-queryable platform metadata
}
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
- [ ] `isActive Boolean @default(true)` is present, unless this is a documented
      truly append-only audit/history model
- [ ] `createdAt DateTime @default(now())` is present
- [ ] `updatedAt DateTime @default(now()) @updatedAt` is present with
      `@updatedAt`, unless the same append-only audit/history exception applies
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
