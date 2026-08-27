# OmniCart Recover — Abandoned Cart & Journey Recovery Business Logic

> **Parent System:** OmniCart  
> **Sub-System:** Journey Recovery & Multi-Channel Engagement  
> **Scope:** Abandoned checkouts, multi-platform triggers, sequence pacing, and incentive rules.

---

## 1. Recovery Workflow Triggers

- **Checkout Abandonment**: Triggered when an order remains in `unpaid` status for > 30 minutes.
- **Cart Abandonment**: Triggered on storefront platforms (e.g. Shopify) when items are left in cart without checkout initiation.
- **Channel Pacing**:
  - Message 1: 15–30 mins post-abandonment (gentle reminder, stock availability).
  - Message 2: 12–24 hours post-abandonment (personalized incentive or review snippet).
  - Message 3: 48 hours post-abandonment (final urgency / expiring voucher).

---

## 2. Platform Constraint Handling

- **Shopify**: Full customer PII available; email/SMS/webhooks recovery enabled.
- **Lazada / Marketplaces**: PII is masked; communication is constrained to official IM sessions or in-platform voucher pushes.
