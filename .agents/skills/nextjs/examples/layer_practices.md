# Next.js Architecture: Layer Practices (Good vs. Bad)

This reference document contains practical, comprehensive code examples comparing **Bad Practices (Anti-patterns)** vs. **Good Practices** across the three key architectural layers: **Server Actions**, **Services**, and **Utils**.

---

## 1. Server Actions (`src/actions/`)

### ❌ BAD PRACTICE: Mixing Direct DB Calls, Calculations & Uncoordinated Queries
```typescript
// src/actions/orderActions.ts
'use server';

import { prisma } from '@/lib/prisma';

export async function checkoutAction(cartId: number, paymentMethod: string) {
  // ❌ BAD: Direct DB queries in action
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true },
  });
  if (!cart) return { success: false, error: 'Cart not found' };

  // ❌ BAD: Business calculations written directly inside action
  let total = 0;
  for (const item of cart.items) {
    total += item.price * item.quantity;
  }

  // ❌ BAD: Multiple independent DB operations without transaction
  // Stock may decrement even if order creation subsequently fails!
  const order = await prisma.order.create({
    data: { total, paymentMethod, status: 'PENDING' },
  });

  for (const item of cart.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }

  return { success: true, order };
}
```

### ✅ GOOD PRACTICE: Validation, Transaction Orchestration & Passing `tx` to Services
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
    // Validate incoming input payload schema with Zod
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { cartId, paymentMethod } = parsed.data;

    // Validate domain pre-conditions via service
    const cart = await validateCartService(cartId);

    // Atomically execute multiple service operations inside a Prisma transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order record passing the transaction context
      const newOrder = await createOrderService(
        { cartId, total: cart.total, paymentMethod },
        tx
      );

      // Deduct inventory items passing the transaction context
      await deductProductStockService(cart.items, tx);

      return newOrder;
    });

    // Invalidate relevant caches & return standardized response
    revalidatePath('/orders');
    return { success: true, data: order };
  } catch (error) {
    console.error('Error in checkoutAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Checkout failed',
    };
  }
}
```

---

## 2. Services Layer (`src/services/`)

### ❌ BAD PRACTICE: Monolithic Multi-Task Function Without Transaction Support
```typescript
// src/services/orderService.ts
import { prisma } from '@/lib/prisma';
import fs from 'fs';

export async function processOrderCompleteMonolith(orderData: any) {
  // ❌ BAD: Mixing 5 different responsibilities in one giant function
  const order = await prisma.order.create({ data: orderData });
  
  // ❌ BAD: Hardcoded direct DB call without accepting tx
  for (const item of orderData.items) {
    await prisma.product.update({
      where: { id: item.id },
      data: { stock: { decrement: item.qty } },
    });
  }

  // ❌ BAD: Service attempting to call a Server Action directly
  // await someServerAction(); // FORBIDDEN!

  // ❌ BAD: File write mixed directly inside DB mutation without modular function
  fs.appendFileSync('orders.log', `Order ${order.id} created\n`);

  return order;
}
```

### ✅ GOOD PRACTICE: Modular, Single-Responsibility Services Supporting `tx`
```typescript
// src/services/orderService.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

// Define transaction client type helper
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

// Single Responsibility: Deduct inventory with stock validation
export async function deductProductStockService(
  items: Array<{ productId: number; quantity: number }>,
  tx: DbClient = prisma
) {
  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, title: true },
    });

    if (!product || product.stock < item.quantity) {
      throw new Error(`Insufficient stock for product: ${product?.title ?? item.productId}`);
    }

    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }
}

// Single Responsibility: Write audit log to file system
export async function logOrderAuditService(orderId: number, action: string): Promise<void> {
  const logDir = path.join(process.cwd(), 'logs', 'audit');
  await fs.mkdir(logDir, { recursive: true });
  const logEntry = `[${new Date().toISOString()}] Order #${orderId} - Action: ${action}\n`;
  await fs.appendFile(path.join(logDir, 'orders.log'), logEntry, 'utf-8');
}

// Single Responsibility: Call external shipping provider API
export async function createShipmentService(orderId: number, destinationAddress: string) {
  const response = await fetch('https://api.logistics-partner.com/v1/shipments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LOGISTICS_API_KEY}`,
    },
    body: JSON.stringify({ orderId, address: destinationAddress }),
  });
  if (!response.ok) throw new Error('Failed to register shipment with logistics provider');
  return await response.json();
}
```

---

## 3. Utils Layer (`src/utils/`)

### ❌ BAD PRACTICE: Impure Utils with Side-Effects, DB Queries, or API Calls
```typescript
// src/utils/pricing.ts
import { prisma } from '@/lib/prisma';
import fs from 'fs';

// ❌ BAD: Util making external API call (Belongs in a Service)
export async function formatCurrencyWithLiveRate(amount: number) {
  const res = await fetch('https://api.exchangerate.com/latest'); // FORBIDDEN IN UTILS
  const data = await res.json();
  return `${amount * data.rates.VND} VND`;
}

// ❌ BAD: Util querying database (Belongs in a Service)
export async function validateUserExists(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } }); // FORBIDDEN IN UTILS
  return Boolean(user);
}

// ❌ BAD: Util reading files from disk (Belongs in a Service)
export function readPromptTemplate(templateName: string) {
  return fs.readFileSync(`./templates/${templateName}.txt`, 'utf-8'); // FORBIDDEN IN UTILS
}
```

### ✅ GOOD PRACTICE: Pure, Stateless, Deterministic Utilities
```typescript
// src/utils/formatters.ts
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatDateVN(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// src/utils/validators.ts
const VN_PHONE_REGEX = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;

export function isValidVietnamesePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  return VN_PHONE_REGEX.test(phone.trim());
}

export function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[<>%$#]/g, '').slice(0, 100);
}

// src/utils/rag/promptUtils.ts
export function buildRagGroundingPrompt(userQuery: string, retrievedFacts: string[]): string {
  const factsContext = retrievedFacts.map((fact, i) => `[Fact ${i + 1}]: ${fact}`).join('\n');
  return `You are a customer care assistant. Answer the user strictly based on the following verified facts:\n\n${factsContext}\n\nUser Question: ${userQuery}\nResponse:`;
}
```

---

### 💡 Note on Small Local Service Helpers (No Need to Over-Extract)

If a helper is small (1–2 lines, simple string formatting, private calculation) and only used locally inside a single service, keep it **directly inside that service file** as a private helper. Do not create unnecessary tiny util files.

```typescript
// src/services/couponService.ts
import { prisma } from '@/lib/prisma';

// ✅ Small private helper kept directly inside the service file
function calculateDiscount(basePrice: number, percent: number): number {
  return Math.round((basePrice * (100 - percent)) / 100);
}

export async function applyCouponService(orderId: number, couponCode: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
  if (!coupon) throw new Error('Invalid coupon code');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');

  const discountedTotal = calculateDiscount(order.totalAmount, coupon.percentage);

  return await prisma.order.update({
    where: { id: orderId },
    data: { totalAmount: discountedTotal, couponCode },
  });
}
```

