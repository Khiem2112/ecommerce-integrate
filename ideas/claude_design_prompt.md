# Master Prompt for Claude Design / v0 (Business-Centric E-Commerce SaaS)

> **Instructions for User:** Copy and paste the business-focused prompt script below into **Claude**, **v0.dev**, or any AI UI generator to let it design an ROI-driven prototype tailored for e-commerce business owners and store managers.

---

```markdown
Role: You are a Lead Product Strategist & UX Designer specializing in high-converting B2B SaaS platforms for multi-channel e-commerce merchants (like Klaviyo, Stripe, and Gorgias).

Task: Design and build a compelling, production-ready React prototype for "OmniCart Recover" — an abandoned checkout recovery & revenue intelligence SaaS for merchants selling on Shopee, Lazada, and TikTok Shop.
  
======================================================================
1. BUSINESS CONTEXT & THE SELLER'S PAIN POINT
======================================================================
Multi-channel e-commerce merchants in Southeast Asia face a $150B+ market opportunity, but lose 70%+ of potential sales to cart/checkout abandonment across Shopee, Lazada, and TikTok Shop.

Key Business Friction:
1. Operational Blindness: Merchants have NO central view of how much revenue they lose daily across channels.
2. Platform PII Masking: Platforms mask buyer names/phones, preventing off-platform SMS/Email retargeting.
3. Slow Reaction Time: Manual chat retargeting takes hours, causing recovery conversion to collapse.
4. Margin Erosion: Generic discounts waste profit margins on buyers who would have paid full price.

======================================================================
2. CORE BUSINESS VALUE PROPOSITIONS TO DEMONSTRATE IN THE INTERFACE
======================================================================
Your UI design must explicitly solve these business problems and visually communicate 4 Core Value Pillars to a Store Owner / CFO:

PILLAR A: PROVEN ROI & FINANCIAL RECOVERY DASHBOARD
- Instantly answer the CFO's core question: "Is this software making me money?"
- Highlight: [Lost Revenue Leak] vs. [Recovered Revenue] vs. [Software ROI Multiple (e.g., 34x ROI)].
- Show live financial recovery attribution (e.g., "$4,850 recovered this month via automated chat nudges").
- Display cross-platform performance comparison (Shopee vs. Lazada vs. TikTok Shop revenue leak).

PILLAR B: MARGIN-PROTECTING WORKFLOW AUTOMATION
- Demonstrate speed to recovery: Webhook detects unpaid checkout -> Automates platform Chat API message within 15 minutes.
- Demonstrate margin protection logic:
  * High Cart Value ($100+) -> Attach 10% Limited Voucher.
  * Low Cart Value ($20) -> Send Free Shipping Nudge (No discount waste).
  * Serial Abandoner -> Suppress Vouchers to stop deal-hunting abuse.

PILLAR C: PRODUCT FRICTION & PRICING DIAGNOSTICS
- Help merchants understand WHY buyers abandon specific products.
- Introduce a "Friction Index" per SKU: (Unpaid Checkouts / Total Checkouts).
- Surface business actionable insights:
  * e.g., "SKU #8492 has an 80% abandonment rate on Lazada due to high shipping fees at checkout."
  * e.g., "SKU #3019 is abandoned on Shopee because it's priced 15% cheaper on TikTok Shop."

PILLAR D: VIP CUSTOMER & HIGH-TICKET SALES ORCHESTRATION
- Solve the high-ticket sales challenge ($200+ electronics, luxury, appliances).
- Demonstrate LTV-based routing: Identify high-value repeat buyers (using anonymized store Buyer IDs) and automatically alert a human sales rep (via Telegram/Slack/Dashboard) to personally close the deal via Chat API.

======================================================================
3. USER EXPERIENCE & VISUAL DIRECTIVES
======================================================================
- Aesthetic: Modern, high-trust dark mode glassmorphism (#0B0F17 background, sleek indigo accents, emerald green for recovered money, rose/amber for financial leaks).
- Target User: E-commerce Business Owners, E-commerce Operations Directors, and Customer Support Leads.
- Visual Hierarchy: Focus on high-level executive decision-making tools at the top, actionable workflow automation in the middle, and deep operational analytics/live streams at the bottom.
- Interactivity: Make key components interactive using React `useState` (e.g., toggling between platform metrics, inspecting individual abandoned checkouts, simulating an automated chat recovery message, testing VIP sales alerts).

Design the layout, structure, and visual components in the most intuitive way possible to showcase these business value propositions in a single React code artifact.
```
