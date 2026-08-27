# Product Friction Index — Thesis Insight Summary

> Working direction: diagnose *why* specific SKUs get abandoned across marketplace platforms, and generate actionable, causally-validated recommendations — not just a "this SKU is at risk" flag.

---

## 1. Core Concept

Starting definition (from the original feature matrix):

```
Friction Index = Unpaid Orders / Total Checkouts   (per SKU)
```

This alone is **descriptive** — several existing tools already do this (Metric.vn, SaleCycle, Klaviyo). It is not, by itself, a thesis contribution. The direction only becomes research-grade if it moves through three layers:

1. **Diagnostic** — classify *which* root cause dominates for a given SKU (price sensitivity, shipping cost, weak listing content, losing to a competitor's price, stock/logistics issue) using a learned model, not hardcoded if/else rules.
2. **Prescriptive** — for each diagnosed cause, trigger a cause-specific workflow that produces a concrete, specific recommendation (not just a label).
3. **Causal / closed-loop** — measure whether sellers who acted on the recommendation actually recovered more revenue than a comparable control group. This is what separates "insight" from "research."

### Proposed cause → action mapping

| Diagnosed cause | Recommended action | AI needed? |
|---|---|---|
| Price sensitivity | Suggested discount %, benchmarked against similar SKUs that converted at that price point | Classifier only |
| Shipping cost friction | Free-shipping threshold change, or a shipping subsidy for that SKU | Classifier only |
| Weak listing (high views, low checkout) | Copy/image fix suggestions generated from listing text + reviews | **Yes — LLM required**, a plain classifier can't generate this |
| Losing to a competitor listing | Price-match or reposition suggestion, with the price gap shown | Product-matching + price-comparison agent |
| Stock/logistics issue | Direct alert to manager | No AI needed, simple data check |

---

## 2. Opportunities

- **Descriptive → prescriptive → causal is the actual gap.** Every listed precedent (Metric.vn, SaleCycle, Klaviyo, BigSeller) stops at descriptive dashboards. Closing the loop with a measured outcome is not something your competitors are doing.
- **Product matching is a legitimate, citable research problem on its own.** The hard part of "search the web and compare competitor prices" isn't the search — it's confidently knowing that a listing on another platform is *the same product* as your SKU, when titles, photos, and variant naming are all inconsistent. This is a real entity-resolution / NLP problem in e-commerce literature, and can stand as a genuine technical chapter independent of the rest of the system.
- **Explainable, human-in-the-loop design is a stronger business story than full automation.** Sellers are unlikely to trust an AI to auto-change prices or vouchers. Using an interpretable model (e.g., gradient boosting + SHAP) to show *why* a SKU was flagged, with the human manager retaining approval, is both more defensible in a thesis defense and more realistic for adoption than a black-box autonomous agent.
- **Feature engineering itself is a research surface.** Deriving meaningful signals from raw order/product API fields (price percentile within category, shipping-cost-to-price ratio, listing-quality proxies, competitor price gap, time-to-abandon) is nontrivial and worth documenting as methodology, not just plumbing.

## 3. Challenges

- **Ecommerce platform data masking / funnel visibility.** Marketplace seller APIs (checked on Lazada) expose order- and product-level data reliably, but **top-of-funnel view/browse data is not clearly available** — the relevant Lazada seller-stats endpoints (`GetMetrics`, `GetStatistics`) are marked deprecated in current docs, and general marketplace policy tends not to expose page-view data to individual sellers. This means:
  - The Friction Index will likely have to stay **checkout-stage only** on marketplace platforms (matches the original definition), not the full "view vs. purchase rate" comparison that was proposed.
  - A view-to-purchase funnel comparison is more feasible on **Shopify**, since you own the storefront and can instrument analytics yourself (GA4, Shopify's own analytics) — this is a real platform-dependent constraint, not just an implementation detail.
- **Risk of collapsing into a Data Analyst project.** If the "cause → specialized agent" pipeline is implemented as rule-based branching (`if cause == price → run script`) rather than a learned diagnostic model with a validated causal loop, the deliverable reads as BI tooling / a very polished dashboard, not a thesis. The product-matching problem and the causal validation step are what need to stay central.
- **Product matching across platforms is genuinely hard.** No shared product ID exists across Shopee/Lazada/TikTok/Shopify listings for the same physical item — matching has to be done via text/image similarity, which introduces false positives/negatives that need to be handled and reported honestly.
- **Closed-loop causal validation needs real, time-based data.** Proving "recommendation → action → measurable recovery" requires either a live pilot over multiple weeks or a carefully designed before/after or A/B comparison on historical data — this is the piece most exposed to timeline risk, since it can't be faked with synthetic data alone without weakening the causal claim.

## 4. Open Research Questions

- Does cause-specific root-cause classification lead to measurably better intervention outcomes than a generic "at risk" flag?
- Does an interpretable model (vs. a black-box one) change how much a shop manager trusts and acts on the recommendation?
- How reliably can a product-matching pipeline link the same SKU across platforms with inconsistent titles/images, and how does matching error propagate into bad price recommendations?

## 5. Platform Feasibility Notes

- **Lazada:** Order + Product APIs are solid for checkout-stage friction analysis. View/browse data is uncertain — verify directly in your sandbox rather than relying on public docs.
- **Shopify:** Full purchase funnel (view → cart → checkout) is realistically instrumentable since you control the storefront — best fit if the view-rate comparison piece is kept in scope.

## 6. Recommended MVP Scope

1. Root-cause classifier (interpretable model) on checkout-stage data — platform-agnostic.
2. Product-matching + competitor price-comparison agent — the core technical chapter.
3. LLM-generated, manager-facing recommendation with rationale (kept human-approved, not auto-applied).
4. Closed-loop measurement comparing acted-on vs. not-acted-on recommendations.
5. Treat view-rate funnel analysis as a Shopify-only stretch goal, not a core dependency.

---
*References checked during this discussion: Lazada Open Platform / Seller Center API docs (open.lazada.com, lazada-sellercenter.readme.io), Shopee Open Platform API guides.*
