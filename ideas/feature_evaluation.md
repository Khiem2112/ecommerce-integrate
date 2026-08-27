# Feature Ideas Evaluation — Your 4 Proposals

> Each idea is classified as:
> - 🟢 **Valid MVP Upgrade** — technically feasible, high value, include now
> - 🟡 **Deferred Feature** — valuable but requires effort/data not available yet
> - 🔴 **Not Reasonable** — blocked by platform constraints or low ROI

---

## Idea 1: Cross-Platform Product Ensemble & Aggregated Analysis

> *"Should we identify and ensemble same product across platforms and give aggregated analysis on them? It may be helpful to identify which product we should remove from our shop."*

### Verdict: 🟢 Valid MVP Upgrade (for Friction Diagnostics Pillar)

### Why This Works

Sellers typically list the **same physical product** on Shopee, Lazada, AND TikTok Shop simultaneously. Right now, they have zero way to compare how that product performs across channels. Your tool can answer:

- *"Your Wireless Earbuds Pro X has a 78% abandonment rate on Lazada but only 22% on TikTok Shop. Lazada's shipping fee ($9.50) is the friction — TikTok absorbs shipping."*
- *"Your Yoga Mat has an 90% abandonment rate on ALL platforms. Consider delisting or repricing."*

### How to Match Products Across Platforms

Since each platform uses its own internal SKU system, you need a **Product Mapping Layer**:

```
┌─────────────────────────────────────────────────────────────┐
│                   PRODUCT MAPPING STRATEGIES                │
├──────────────────────┬──────────────────────────────────────┤
│ Strategy             │ How It Works                         │
├──────────────────────┼──────────────────────────────────────┤
│ 1. Seller SKU Code   │ Most sellers use their own internal  │
│    (PRIMARY)         │ SKU code (e.g., "WEP-X100") across   │
│                      │ all platforms. Match on this field.   │
│                      │ Available in all 3 Order APIs.        │
├──────────────────────┼──────────────────────────────────────┤
│ 2. Manual Mapping UI │ Provide a UI where seller manually   │
│                      │ links: Shopee Item #123 = Lazada     │
│                      │ Item #456 = TikTok Item #789.        │
│                      │ One-time setup per product.           │
├──────────────────────┼──────────────────────────────────────┤
│ 3. Fuzzy Name Match  │ Use product title similarity         │
│    (FALLBACK)        │ (Levenshtein / embedding match) to   │
│                      │ suggest mappings. Seller confirms.    │
└──────────────────────┴──────────────────────────────────────┘
```

### Aggregated Analysis Output Example

```
┌──────────────────────────────────────────────────────────────────────┐
│ PRODUCT ENSEMBLE: "Wireless Earbuds Pro X" (Seller SKU: WEP-X100)  │
├──────────────┬──────────┬──────────┬──────────┬──────────────────────┤
│              │ Shopee   │ Lazada   │ TikTok   │ AGGREGATED           │
├──────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ Price        │ $42.00   │ $45.00   │ $39.90   │ Avg: $42.30          │
│ Shipping Fee │ Free     │ $9.50    │ Free     │ ⚠️ Lazada friction   │
│ Checkouts    │ 180      │ 245      │ 310      │ Total: 735           │
│ Abandoned    │ 54 (30%) │ 196 (80%)│ 62 (20%) │ Total: 312 (42%)     │
│ Revenue Lost │ $2,268   │ $8,820   │ $2,473   │ Total: $13,561       │
├──────────────┴──────────┴──────────┴──────────┴──────────────────────┤
│ 💡 RECOMMENDATION: Lazada is hemorrhaging $8.8k/mo on this SKU.     │
│    → Option A: Bundle free shipping into Lazada price ($54.50)      │
│    → Option B: Delist from Lazada, redirect ad spend to TikTok      │
│    → Option C: Launch targeted Lazada recovery campaign             │
└──────────────────────────────────────────────────────────────────────┘
```

### POC Effort: ~1 week
Build the Seller SKU matching layer + aggregated comparison table. High-impact, low-effort.

---

## Idea 2: Deep VIP Customer Behavior Analysis (View → Cart → Purchase Funnel)

> *"Should we analyze in depth on their view-cart-purchase behavior to give manager an explainable analysis on why they are high value and important?"*

### Verdict: 🟡 Partially Valid — Deferred for Full Funnel, but MVP-Ready for Order-Based Profile

### The Hard Truth About View → Cart → Purchase

| Funnel Stage | API Available? | Details |
|---|:---:|---|
| **View** (browsed product page) | ❌ **NO** | No platform exposes product page view events to sellers via API. This data stays inside the platform's own recommendation engine. |
| **Add to Cart** (added but not checked out) | ❌ **NO** | Cart state is invisible. No API endpoint on any of the 3 platforms. |
| **Checkout Created** (clicked "Buy Now") | ✅ **YES** | Order created with status `UNPAID`. Available via webhook + Order API. |
| **Purchase Completed** (paid) | ✅ **YES** | Order status transitions to `PAID` / `READY_TO_SHIP`. |

**You can build the bottom half of the funnel (Checkout → Purchase), but NOT the top half (View → Cart).**

### What You CAN Build for VIP Explainability (MVP-Ready)

Even without view/cart data, you can build a rich **VIP Customer Profile Card** from order data alone:

```
┌──────────────────────────────────────────────────────────────┐
│ 👑 VIP CUSTOMER PROFILE: BYR-95341 (Lazada, Platinum Tier)  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ WHY THIS BUYER IS HIGH-VALUE:                                │
│                                                              │
│ 💰 Lifetime Value: $4,100 (12 orders over 8 months)         │
│ 📈 Avg Order Value: $341 (3.2x above store average of $107) │
│ 🔁 Purchase Frequency: 1.5 orders/month (top 2% of buyers)  │
│ ⏱️ Last Purchase: 12 days ago                                │
│ 📦 Preferred Categories: Electronics (67%), Appliances (33%) │
│ ✅ Payment Reliability: 100% (0 abandoned checkouts in past) │
│ 🏷️ Voucher Sensitivity: LOW (purchased 11 of 12 times at    │
│    full price — do NOT waste margin on discounts)            │
│                                                              │
│ ⚠️ CURRENT ALERT:                                            │
│ Abandoned $520 checkout (Gaming Laptop) 240 mins ago.        │
│ This is their FIRST ever abandonment. High recovery priority.│
│                                                              │
│ 📊 PURCHASE HISTORY TIMELINE:                                │
│ Jan ██████ $280  Smart Watch                                 │
│ Feb ████████ $350  Bluetooth Speaker                         │
│ Mar ██████████ $420  Robot Vacuum                            │
│ Apr ████ $180  Air Fryer                                     │
│ May ████████████ $520  Monitor                               │
│ ... (7 more orders)                                          │
│                                                              │
│ 🎯 RECOMMENDED ACTION:                                       │
│ Route to Senior Sales Rep immediately. Buyer has never       │
│ abandoned before — likely has a specific question. Do NOT    │
│ send automated voucher (buyer is not price-sensitive).       │
└──────────────────────────────────────────────────────────────┘
```

### What Gets Deferred (Post-MVP)

- **View & Cart funnel data** → Only possible if you later integrate with the seller's own website (Shopify/WooCommerce storefront) where you control the JavaScript tracking pixel. Not possible on marketplace platforms.
- **Predictive churn scoring** → Needs 6+ months of historical data before ML models become meaningful.

### POC Effort: ~1 week for order-based VIP profile, deferred for full funnel

---

## Idea 3: Financial Recovery Attribution — Can We Track It?

> *"Should we even develop it? Is it possible to mark the future cart purchases with the workflow that we just trigger?"*

### Verdict: 🟢 Valid MVP Feature — YES, This is the Core ROI Engine

### Can You "Mark" a Recovery?

You **cannot** write metadata back to the platform's order (Shopee/Lazada/TikTok don't allow third parties to tag orders). But you **don't need to**. You track attribution **in your own database**:

```
RECOVERY ATTRIBUTION LOGIC (in YOUR database):

1. Webhook fires: Order #12345 created, status = UNPAID
2. Your system sends Chat API nudge at T+15 minutes
3. You store in YOUR DB:
   {
     order_id: "12345",
     platform: "shopee",
     nudge_sent_at: "2026-08-10T10:15:00Z",
     nudge_type: "10% voucher",
     attribution_window: 2 hours
   }
4. You poll Order API (or receive webhook) at T+45 minutes:
   Order #12345 status changed to PAID ✅

5. ATTRIBUTION CHECK:
   Was payment completed within 2 hours of nudge? → YES
   → Mark as "Recovered by OmniCart" in YOUR database
   → Add $349.00 to "Recovered Revenue" dashboard metric
```

### Attribution Model Options

| Model | Logic | Accuracy |
|---|---|---|
| **Simple Time Window** | If order goes UNPAID → PAID within 2 hours of your nudge → attributed to you | 🟡 Medium (some buyers would have paid anyway) |
| **Control Group A/B** | Randomly withhold nudges from 10% of abandoned checkouts. Compare recovery rate of nudged vs. non-nudged group. | 🟢 High (proves causal impact) |
| **Incremental Lift** | Recovery Rate (with OmniCart) minus Baseline Recovery Rate (platform native) = your incremental value | 🟢 High (industry standard) |

> [!IMPORTANT]
> ### This Feature is NOT Optional — It IS Your Product
> The Financial Recovery Dashboard with attribution is **the single most important screen in your entire product**. It directly answers the merchant's question: *"Is this $50/month subscription making me money?"* If your dashboard shows **34x ROI** (as in the prototype), no merchant will ever cancel.

### What About "Future Cart Purchases"?

If you mean: *"Can we track that a buyer who received a nudge today comes back and makes a NEW purchase next week?"*

- **Within the same platform:** ✅ YES. The `buyer_user_id` is persistent. You can track that BYR-95341 received a nudge on Aug 10 and made a new purchase on Aug 17. You can build a **"Nudge → Repeat Purchase" cohort analysis**.
- **Across platforms:** ❌ NO. Can't link identities.

### POC Effort: ~1 week. This should be built FIRST.

---

## Idea 4: Employee Task Assignment & Customer Caring Workflow

> *"Should the workflow automation just send messages to customers? I think there should be features like assigning customer caring tasks to employees to make sure one employee cares for just some customers."*

### Verdict: 🟢 Valid MVP Upgrade — This Transforms the Product from "Bot Tool" to "Sales CRM"

### Why This Is a Great Idea

Sending automated chat messages is powerful, but for **high-value customers and complex sales**, a human touch closes deals. Your insight is correct — the product should evolve from a simple "message bot" into a **lightweight Sales CRM with task routing**.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER CARE TASK ROUTING                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ABANDONED CHECKOUT DETECTED                                        │
│  ├── Is Buyer LTV > $500?                                           │
│  │   └── YES → Create Task: "VIP Recovery"                          │
│  │           → Auto-Assign to: Senior Sales Rep (Minh)              │
│  │           → Channel: Telegram Alert + Dashboard Task Card        │
│  │           → SLA: Must respond within 30 minutes                  │
│  │           → Status: 🔴 Open → 🟡 In Progress → 🟢 Resolved     │
│  │                                                                   │
│  ├── Is Buyer LTV $200–$500?                                        │
│  │   └── YES → Create Task: "Mid-Value Recovery"                    │
│  │           → Auto-Assign to: Sales Team Member (round-robin)      │
│  │           → SLA: Must respond within 1 hour                      │
│  │                                                                   │
│  └── Is Buyer LTV < $200?                                           │
│      └── YES → No task created. Auto-bot Chat API handles it.       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  EMPLOYEE DASHBOARD VIEW (for Sales Rep "Minh"):                    │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ My Assigned Customers Today: 7                             │     │
│  │ ┌─────────┬───────────┬────────┬──────────┬────────────┐  │     │
│  │ │ Buyer   │ Platform  │ Value  │ Status   │ Action     │  │     │
│  │ ├─────────┼───────────┼────────┼──────────┼────────────┤  │     │
│  │ │ BYR-953 │ Lazada    │ $520   │ 🔴 Open  │ Chat Now   │  │     │
│  │ │ BYR-561 │ Shopee    │ $312   │ 🟡 Sent  │ Follow Up  │  │     │
│  │ │ BYR-295 │ Shopee    │ $245   │ 🟢 Paid  │ Completed  │  │     │
│  │ └─────────┴───────────┴────────┴──────────┴────────────┘  │     │
│  │                                                            │     │
│  │ Performance: 3 recovered / 7 assigned = 42.8% close rate   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  MANAGER VIEW:                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Team Performance This Week:                                │     │
│  │ Minh:   42.8% close rate │ $4,200 recovered │ Avg 12 min  │     │
│  │ Linh:   38.1% close rate │ $3,100 recovered │ Avg 18 min  │     │
│  │ Tuan:   29.4% close rate │ $1,800 recovered │ Avg 35 min  │     │
│  │                                                            │     │
│  │ 💡 Insight: Minh's response time (12 min) correlates with │     │
│  │    highest close rate. Consider setting 15-min SLA for all.│     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### This Changes Your Market Positioning

| Without Task Assignment | With Task Assignment |
|---|---|
| "Chat Recovery Bot" | "Sales Recovery CRM" |
| Competing with ManyChat, Omnisend | Competing with Gorgias, Zendesk Sell |
| $29/mo pricing tier | $99–$199/mo pricing tier |
| Self-serve small sellers | Mid-market sellers with sales teams |

### POC Effort: ~2 weeks (task creation + assignment + status tracking + employee dashboard)

---

## Summary Classification

| Idea | Classification | Include in MVP? | Effort |
|---|:---:|:---:|:---:|
| **1. Cross-Platform Product Ensemble** | 🟢 Valid MVP Upgrade | ✅ Yes — enhances Friction Diagnostics | 1 week |
| **2. VIP Behavior Funnel (View→Cart→Purchase)** | 🟡 Partially Deferred | ⚠️ Order-based profile YES, full funnel DEFERRED | 1 week (order-based) |
| **3. Financial Recovery Attribution** | 🟢 Valid — CRITICAL | ✅ Yes — this IS the core product | 1 week |
| **4. Employee Task Assignment / CRM** | 🟢 Valid MVP Upgrade | ✅ Yes — transforms product positioning | 2 weeks |

### Updated MVP Module List (6 Modules)

```
ORIGINAL 4 MODULES:                    UPGRADED 6 MODULES:
1. Lost Revenue Dashboard       →  1. Lost Revenue Dashboard
2. Automated Chat Recovery       →  2. Automated Chat Recovery
3. SKU Friction Diagnostics      →  3. SKU Friction Diagnostics + Product Ensemble ✨
4. VIP Sales Rep Alert           →  4. VIP Customer Profile Card (order-based) ✨
                                    5. Financial Recovery Attribution Engine ✨
                                    6. Employee Task Assignment & Sales CRM ✨
```
