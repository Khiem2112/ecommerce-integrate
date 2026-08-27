# OmniCart Recover — Product Feature Ideas & Feasibility Matrix

> **Scope:** Multi-Platform E-Commerce SaaS (Shopee, Lazada, TikTok Shop)  
> **Focus:** Cart Abandonment Analytics, Chat Automation, VIP Customer Routing, and Product Friction Diagnostics

---

## 1. Executive Summary & Vision

**OmniCart Recover** is a unified multi-channel SaaS platform built for Southeast Asian e-commerce merchants operating simultaneously across **Shopee, Lazada, and TikTok Shop**.

Because native marketplace platforms operate in silos and do not expose raw buyer PII (Personally Identifiable Information), **OmniCart Recover** leverages:
- Real-time Order Webhooks & APIs (detecting unpaid/cancelled checkouts)
- Scoped Anonymized Buyer IDs (tracking single-store customer LTV)
- Platform Chat APIs (Shopee Seller Chat, Lazada CEM, TikTok Shop Chat) for automated 15-minute recovery nudges
- SKU-level behavioral analytics to diagnose product pricing and shipping friction

---

## 2. Comprehensive Product Feature Matrix

| Feature / Product Idea | Category | Technical Possibility | Business Value | Existing Market Precedents | POC Complexity |
|---|---|:---:|:---:|---|:---:|
| **1. Unified Lost Revenue Dashboard** | Dashboard Analytics | 🟢 **HIGH**<br>Aggregates unpaid & cancelled orders from Order APIs & Webhooks across platforms. | 🟢 **HIGH**<br>Gives sellers immediate visual clarity on total revenue leak per channel. | **Metric.vn**, **Graas**, **SellerX**, **BigSeller** | 🟢 **LOW** (1–2 wks) |
| **2. SKU & Category Abandonment Heatmap** | Dashboard Analytics | 🟢 **HIGH**<br>Groups unpaid orders by SKU ID, Category ID, and price point. | 🟢 **HIGH**<br>Identifies products with friction (hidden shipping costs, bad pricing). | **Klaviyo** (for D2C), **SaleCycle**, **Shopify Analytics** | 🟢 **LOW** (1 wk) |
| **3. Automated Chat Recovery Flow (15-min Trigger)** | Workflow Automation | 🟢 **HIGH**<br>Uses Webhook + Delayed Queue + Chat APIs (Shopee Seller Chat / Lazada CEM / TikTok Chat). | 🔴 **CRITICAL HIGH**<br>Primary ROI driver. Converts 15–25% of abandoned checkouts into paid orders. | **ManyChat**, **Gorgias**, **Rello**, **Omnisend** | 🟡 **MEDIUM** (2 wks) |
| **4. Smart Dynamic Voucher Distribution** | Workflow Automation | 🟢 **HIGH**<br>Combines Chat API with Platform Promotion/Voucher APIs to send custom discounts. | 🟢 **HIGH**<br>Protects profit margins by giving discounts only to high-cart-value abandoners. | **Shopee Marketing Centre**, **Lazada Promotion API** | 🟡 **MEDIUM** (2 wks) |
| **5. VIP Customer Routing & Sales Rep Orchestration** | Sales Orchestration | 🟡 **MEDIUM**<br>Uses persistent `buyer_user_id` LTV tracking. Triggers instant notification (Slack/Telegram/Dashboard alert) to live sales rep when a high-LTV buyer abandons or messages. | 🟢 **HIGH**<br>High-ticket sellers (electronics, luxury, furniture) close big deals with human touch. | **Gorgias** (VIP Routing), **Zendesk Sell**, **Intercom** | 🟡 **MEDIUM** (2 wks) |
| **6. AI Sales Agent (Auto-Reply via Chat API)** | AI & CX | 🟢 **HIGH**<br>Connects LLM (Claude/GPT) to Platform Chat APIs to answer buyer pre-purchase queries 24/7. | 🟢 **HIGH**<br>Prevents abandonment caused by slow response to buyer product questions. | **ManyChat AI**, **ChatFuel**, **SaleSmartly**, **Sapo** | 🔴 **HIGH** (3 wks) |
| **7. Single-Platform Customer LTV & RFM Ranking** | Dashboard Analytics | 🟢 **HIGH**<br>Calculates Recency, Frequency, & Monetary value using anonymized `buyer_user_id`. | 🟡 **MEDIUM**<br>Identifies loyal buyers per store without needing PII. | **Klaviyo**, **Triple Whale**, **Peel Insights** | 🟢 **LOW** (1 wk) |
| **8. Cross-Platform Buyer Identity Matching** | Customer Profile | 🔴 **BLOCKED**<br>Marketplace PII masking hides real phone numbers/emails across Shopee, Lazada, & TikTok. | 🟢 **HIGH** (if possible) | N/A (Only possible on D2C Brand.com sites via Shopify/WooCommerce) | ❌ **IMPOSSIBLE** via official APIs |
| **9. Restock & Back-in-Stock Automated Alerts** | Workflow Automation | 🟢 **HIGH**<br>Monitors inventory webhooks and auto-chats buyers who inquired/abandoned out-of-stock SKUs. | 🟡 **MEDIUM**<br>Recovers lost sales when popular inventory is replenished. | **Back in Stock App**, **Klaviyo** | 🟢 **LOW** (1 wk) |
| **10. Cross-Platform Price & Arbitrage Alert** | Market Intelligence | 🟢 **HIGH**<br>Compares seller's SKU prices & conversion rates across Shopee vs Lazada vs TikTok. | 🟡 **MEDIUM**<br>Alerts seller if their Lazada store is losing sales because TikTok Shop is cheaper. | **Price2Spy**, **Metric.vn**, **Kalodata** | 🟡 **MEDIUM** (2 wks) |
| **11. Serial Abandoner Protection (Anti-Fraud)** | Anti-Fraud / Protection | 🟢 **HIGH**<br>Tracks `buyer_user_id` frequency of non-payment. Automatically suppresses voucher offers for serial abusers. | 🟡 **MEDIUM**<br>Saves voucher budget from deal hunters who never intend to pay. | **Signifyd**, **Riskified** (adapted for e-commerce chat) | 🟢 **LOW** (1 wk) |
| **12. Post-Purchase Up-Sell / Cross-Sell Automation** | Workflow Automation | 🟢 **HIGH**<br>Triggers chat message 3–7 days post-delivery: *"How is your product? Get 10% off accessory B."* | 🟢 **HIGH**<br>Increases Repeat Purchase Rate and Customer Lifetime Value. | **ReCart**, **Klaviyo**, **ManyChat** | 🟢 **LOW** (1 wk) |

---

## 3. Top MVP Modules Recommended for Initial Build

```
┌──────────────────────────────────────────────────────────────────┐
│                         OMNICART MVP                             │
├────────────────────────────────┬─────────────────────────────────┤
│ 1. Unified Lost Revenue        │ 2. Automated 15-Min             │
│    Dashboard                   │    Chat Recovery Engine         │
│    (Shopee + Lazada + TikTok)  │    (Webhook + Delay + Chat API) │
├────────────────────────────────┼─────────────────────────────────┤
│ 3. Top Abandoned SKU           │ 4. VIP Sales Rep Routing        │
│    Friction Diagnostic         │    (Telegram/Slack Alert for    │
│    (Friction Index per SKU)    │    High-LTV Buyers)             │
└────────────────────────────────┴─────────────────────────────────┘
```

1. **Unified Lost Revenue Dashboard:** Show the exact financial loss per channel (e.g. $14,250 lost this month) and total dollars recovered ($4,100 recovered).
2. **Automated 15-Min Chat Recovery Engine:** Configurable rule builder (*If checkout > $50, send Chat + 10% voucher*).
3. **Top Abandoned SKU Diagnostic:** Rank items by Friction Index ($\frac{\text{Unpaid}}{\text{Total Checkout}}$).
4. **VIP Sales Rep Telegram/Slack Routing:** Immediate alert to human sales reps when a high-LTV buyer abandons a checkout.
