<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I want to make a SWR project thesis about product friction analysis through different platform like Shopify, Lazada, Tik Tok Shop... and give explainable view why this product is a point of our shop or it should be discarded ?

Find me relevevant research dataset that I can reference from and check for me whether those dataset can be simulated by the provided data APIs from those platforms

Your thesis is feasible, but it should be framed as an **explainable, cross-platform product-friction diagnosis and intervention system**, not merely as a dashboard showing abandoned orders. The strongest research contribution is to connect:

$$
\text{Platform data} \rightarrow \text{friction diagnosis} \rightarrow \text{explanation} \rightarrow \text{keep/discard recommendation} \rightarrow \text{measured outcome}
$$

Your uploaded notes already identify the key distinction: a simple “unpaid orders ÷ checkouts” index is descriptive; the thesis becomes stronger when it diagnoses causes, recommends an action, and evaluates whether the action improves performance.[^1]

## 1. Recommended thesis scope

### Proposed title

**Explainable Cross-Platform Product Friction Analysis for E-Commerce Product Portfolio Decisions**

Alternative:

**An Explainable Decision-Support System for Diagnosing Product Friction Across Shopify, Lazada, and TikTok Shop**

### Research problem

A product can perform poorly for different reasons:

- Customers view it but do not add it to cart.
- Customers add it to cart but abandon because of shipping cost.
- Customers begin checkout but do not pay.
- The product is overpriced relative to equivalent marketplace listings.
- The listing has weak images, title, description, or reviews.
- The product is frequently unavailable or has fulfillment problems.
- The product sells on one platform but fails on another because of platform-specific traffic or logistics.

Therefore, the system should not answer only:

> “Should this product be kept?”

It should answer:

> “What type of friction is occurring, how confident are we, what evidence supports the explanation, and which intervention should be tested before discarding the product?”

### Suggested research questions

1. Can product friction be measured consistently across Shopify, Lazada, and TikTok Shop despite differences in API availability?
2. Can an explainable model distinguish price, shipping, listing, competition, inventory, and fulfillment friction?
3. Do cause-specific recommendations perform better than a generic “high-risk product” alert?
4. Can product matching reliably identify equivalent products across marketplace listings?
5. Does the recommendation improve conversion, paid-order rate, revenue, or contribution margin?

The fifth question is particularly important. Without measuring the result of an intervention, the project risks becoming a business-intelligence dashboard rather than a research thesis.

## 2. Relevant datasets

There is unlikely to be one public dataset containing all of the fields required for your exact project: product IDs across Shopify, Lazada, and TikTok Shop; checkout abandonment; shipping cost; competitor price; listing content; and intervention outcomes. A better strategy is to use public datasets for benchmarking and your platform APIs for the main case study.


| Dataset or source | What it contains | Useful thesis component | Can platform APIs simulate it? |
| :-- | :-- | :-- | :-- |
| **UCI Online Shoppers Purchasing Intention** | 12,330 online shopping sessions, 17 features plus the `Revenue` label; browsing depth, page duration, bounce rate, exit rate, page value, traffic type, visitor type, and purchase outcome | Purchase-intention prediction, funnel-friction baseline, explainable classification | **Partially.** Shopify can approximate some behavior if you instrument storefront events. Lazada and TikTok Shop seller APIs generally do not expose equivalent session-level browsing data |
| **WDC Product Matching Dataset** | Product-offer pairs labeled as matching or non-matching across online shops; the English subset contains approximately 20 million pairs, with manually verified gold-standard pairs | Cross-platform product matching and competitor comparison | **Yes, structurally.** Product APIs can provide titles, descriptions, SKUs, variants, prices, images, and categories, but not the gold-standard match labels |
| **Abt-Buy / Amazon-Google Products entity-resolution datasets** | Product records from two sources with names, descriptions, manufacturers, prices, and match labels | Smaller, reproducible benchmark for matching models | **Yes, structurally.** Use API product records as the real deployment dataset and the public records as an initial benchmark |
| **Instacart Online Grocery Shopping Dataset** | More than three million anonymized grocery orders from over 200,000 users, with order sequence, product, reorder, day, hour, and time since previous order | Product retention, repeat purchase, product portfolio analysis, recommendation modeling | **Partially.** Platform APIs can provide orders, products, line items, and timestamps, but usually not the complete anonymized user history found in the public data |
| **Kaggle e-commerce behavior datasets** | Usually browsing, product interaction, purchase, review, or customer behavior fields | Exploratory modeling and prototype testing | **Usually partially.** Field definitions vary, and many are synthetic or educational; use them cautiously and verify provenance |
| **Your own platform data** | Orders, products, variants, prices, discounts, inventory, refunds, shipping, and—depending on platform—abandoned checkouts or customer events | Main empirical evaluation and cross-platform comparison | **This should be the primary thesis dataset** |

The UCI dataset is especially useful for a first benchmark because it has a clearly defined purchase outcome and 12,330 sessions, but it does not contain marketplace-specific SKU friction, shipping cost, competitor prices, or intervention data.[^2][^3]

For product matching, the WDC dataset is highly relevant because it was specifically created for matching product offers from different online shops. Its English training data contains approximately 20 million product-offer pairs, while a manually verified gold standard was created for evaluation.  Smaller datasets such as Abt-Buy and Amazon-Google Products are easier to reproduce in a student project and include attributes such as product name, description, manufacturer, and price.[^4][^5]

## 3. Platform API feasibility

### Shopify

Shopify is the strongest platform for detailed friction analysis because it is your own storefront and can be instrumented.

The Shopify Admin GraphQL API provides an `AbandonedCheckout` object containing:

- Checkout creation and update timestamps.
- Line items, quantities, and prices.
- Subtotal, total price, discount, tax, duties, and shipping-related values.
- Customer and address information where available.
- Recovery status and recovery URL.
- Whether the checkout was eventually completed.[^3]

Shopify also provides an `Abandonment` object that can represent incomplete journeys at the browsing, cart, or checkout stage. It includes products viewed, products added to cart, abandonment type, inventory availability, and whether the customer later completed an order.[^6]

This means Shopify can support the following funnel:

$$
\text{Product view} \rightarrow \text{Add to cart} \rightarrow \text{Checkout} \rightarrow \text{Payment} \rightarrow \text{Order}
$$

However, do not assume that every Shopify Analytics dashboard metric is directly available as a simple Admin API field. For session-level events such as product views, add-to-cart events, and checkout initiation, you may need to collect storefront events yourself through pixels, webhooks, an app, or an analytics pipeline. Some Shopify analytics metrics are derived reports rather than ordinary transactional objects.

**Recommended Shopify implementation**

Create an event table such as:

```text
event_id
session_id
customer_id_hash
platform
sku_id
event_type
event_timestamp
device_type
traffic_source
country
price_at_event
discount_at_event
shipping_estimate
```

Where `event_type` can be:

```text
product_view
add_to_cart
checkout_started
payment_attempt
order_paid
checkout_abandoned
```

This would allow you to reproduce the UCI-style session features while adding product-level and commercial features that are more relevant to your thesis.

### Lazada

Lazada’s official API reference exposes product, order, review, voucher, shipping, finance, fulfillment, logistics, and related seller APIs.[^7]

That makes Lazada suitable for:

- Product and variant data.
- Product price and promotional price.
- Inventory and availability.
- Orders and order items.
- Order status and cancellation.
- Returns and refunds.
- Shipping and fulfillment information.
- Seller vouchers and promotions.
- Reviews, depending on access and endpoint availability.
- Financial settlement and fee data, depending on permissions.

It is less suitable for reproducing the complete Shopify-style browsing funnel. The important distinction is:


| Data type | Lazada feasibility |
| :-- | --: |
| Product catalog | High |
| SKU and variant data | High |
| Paid orders | High |
| Cancellations and returns | High |
| Inventory | High |
| Price and discounts | High |
| Shipping or fulfillment fields | Medium to high |
| Customer-level identity | Restricted or anonymized |
| Product views | Uncertain |
| Add-to-cart events | Low or uncertain |
| Checkout sessions | Low or uncertain |
| Detailed session path | Low |

Your uploaded notes correctly identify this as a central platform constraint: Lazada can support order- and product-level friction analysis, but the full top-of-funnel view-to-checkout funnel may not be consistently available through seller APIs.[^1]

Therefore, for Lazada define the outcome carefully. Instead of pretending to measure checkout abandonment exactly, use observable stages such as:

$$
\text{Unpaid order rate} =
\frac{\text{unpaid or failed orders}}{\text{created orders}}
$$

$$
\text{Cancellation rate} =
\frac{\text{cancelled orders}}{\text{created orders}}
$$

$$
\text{Return rate} =
\frac{\text{returned orders}}{\text{delivered orders}}
$$

These are valid forms of operational or transaction friction, but they are not identical to web checkout abandonment.

### TikTok Shop

TikTok Shop is likely to be the most difficult platform for a university project because access is strongly dependent on market, partner approval, app registration, OAuth scopes, and the current Partner Center API version.

Public descriptions of the Partner API indicate access to product catalog, order history, affiliate-attributed orders, and financial settlements.  However, detailed analytics and traffic data may be behind authenticated Partner Center access rather than openly documented.[^8]

You should treat TikTok Shop as follows:


| TikTok Shop data | Expected feasibility |
| :-- | --: |
| Product and SKU information | High after approval |
| Orders and order items | High after approval |
| Order status | High after approval |
| Refunds, cancellations, returns | Medium to high |
| Settlement and fees | Medium to high |
| Affiliate or creator attribution | Medium to high |
| Product views | Uncertain |
| Add-to-cart events | Uncertain |
| Checkout abandonment | Usually unavailable or not equivalent to Shopify |
| Detailed user-level journey | Restricted |

The safest design is to make TikTok Shop an **optional third platform**. Build the core system using Shopify and Lazada, then add TikTok Shop if you obtain an approved seller account and API access.

## 4. Data model for your thesis

Use a normalized cross-platform schema rather than forcing all platforms into identical metrics.

### Core tables

#### Product table

```text
canonical_product_id
platform
platform_product_id
platform_sku_id
title
description
category
brand
variant
image_urls
selling_price
cost_price
stock_quantity
rating
review_count
listing_created_at
```


#### Order table

```text
platform
order_id
order_timestamp
order_status
payment_status
fulfillment_status
customer_hash
subtotal
discount_amount
shipping_fee
tax_amount
platform_fee
seller_fee
net_revenue
```


#### Order-item table

```text
order_id
platform_sku_id
quantity
unit_price
discount
refund_amount
return_status
```


#### Event table

Use this only where event-level tracking is available:

```text
session_id
platform
platform_sku_id
event_type
event_timestamp
device
traffic_source
price
shipping_estimate
```


#### Competitor-offer table

```text
canonical_product_id
competitor_platform
competitor_listing_id
match_probability
competitor_price
competitor_shipping_fee
competitor_rating
competitor_review_count
captured_at
```


#### Intervention table

```text
recommendation_id
canonical_product_id
cause
recommendation
manager_decision
action_timestamp
treatment_group
outcome_window
```

This data model allows you to distinguish between:

- **Observed:** directly received from an API.
- **Derived:** calculated from API fields.
- **Estimated:** inferred by a model.
- **Unavailable:** not exposed by the platform.

That distinction is important in your methodology and thesis limitations.

## 5. Friction metrics

Do not use one universal friction index for every platform. Use a family of metrics with a common interpretation.

### Shopify metrics

$$
F_{\text{view-cart}} =
1 -
\frac{\text{sessions with add-to-cart}}
{\text{sessions with product view}}
$$

$$
F_{\text{cart-checkout}} =
1 -
\frac{\text{sessions with checkout}}
{\text{sessions with add-to-cart}}
$$

$$
F_{\text{checkout-payment}} =
1 -
\frac{\text{paid orders}}
{\text{checkout sessions}}
$$

$$
F_{\text{product}} =
w_1F_{\text{view-cart}}+
w_2F_{\text{cart-checkout}}+
w_3F_{\text{checkout-payment}}
$$

### Lazada and TikTok Shop metrics

For marketplaces, use observable transaction friction:

$$
F_{\text{unpaid}} =
\frac{\text{unpaid orders}}
{\text{created orders}}
$$

$$
F_{\text{cancel}} =
\frac{\text{cancelled orders}}
{\text{created orders}}
$$

$$
F_{\text{return}} =
\frac{\text{returned orders}}
{\text{delivered orders}}
$$

$$
F_{\text{fulfillment}} =
\frac{\text{late or failed fulfillment orders}}
{\text{confirmed orders}}
$$

You can create a platform-normalized score, but clearly label it as an index rather than a directly observed probability:

$$
\text{Normalized Friction Score}
=
\sum_{k=1}^{m} w_k z(F_k)
$$

where $z(F_k)$ is the standardized version of friction metric $k$. The weights should be justified using validation, expert judgment, or learned from an outcome such as contribution margin.

## 6. Explainable cause model

Your model should predict a cause category rather than only a risk score.

### Candidate causes

| Cause | Evidence features | Recommended action |
| :-- | :-- | :-- |
| Price friction | Price percentile, competitor price gap, discount history, conversion at different prices | Test a discount or reposition price |
| Shipping friction | Shipping fee-to-product-price ratio, delivery estimate, free-shipping eligibility | Test shipping subsidy or threshold |
| Listing friction | Views with low add-to-cart, title quality, image count, review sentiment, missing attributes | Improve title, images, description, or review evidence |
| Competition friction | Matched competitor price, rating, review count, shipping advantage | Price-match, bundle, differentiate, or reposition |
| Inventory friction | Stockouts, low stock, variant unavailability | Restore inventory or remove unavailable variants |
| Fulfillment friction | Late dispatch, cancellation, refund, negative delivery feedback | Fix operations before increasing traffic |
| Demand friction | Low traffic, weak search exposure, poor seasonality | Improve traffic or consider product retirement |

### Modeling approach

A defensible approach is:

1. Build interpretable baseline models using logistic regression and decision trees.
2. Build a stronger model using gradient boosting.
3. Use SHAP or a similar explanation method for local and global explanations.
4. Compare accuracy, calibration, and explanation stability.
5. Present evidence using plain language and the original feature values.

Example explanation:

> Product SKU-104 is flagged as “shipping friction,” not simply “low performance.” Its shipping fee is 28% of item price, which is higher than the category median; its paid-order rate is 42% below comparable SKUs with similar traffic; and the product is not eligible for free shipping. Confidence: 0.81.

Do not claim that SHAP proves causation. SHAP explains how the model used features; it does not establish that changing the feature will cause the outcome to improve.

## 7. Keep-or-discard decision

A product should not be discarded only because its conversion rate is low. Use a staged decision rule.

### Stage 1: Check operational validity

Do not discard the product if poor performance is mainly caused by:

- Stockout.
- Variant unavailability.
- Fulfillment delay.
- Incorrect price or promotion configuration.
- Broken listing or missing shipping configuration.

These are operational defects.

### Stage 2: Diagnose friction

Estimate the dominant cause and confidence. If the model is uncertain, recommend data collection or a small experiment rather than immediate removal.

### Stage 3: Test an intervention

Examples:

- Price friction: test a 5–10% price change or bundle.
- Shipping friction: test free shipping or a shipping subsidy.
- Listing friction: improve image, title, and product information.
- Competition friction: change positioning or bundle instead of simply matching price.
- Demand friction: test improved traffic or campaign placement.


### Stage 4: Evaluate economics

Use contribution margin, not revenue alone:

$$
\text{Contribution Margin}
=
\text{Revenue}
-
\text{COGS}
-
\text{platform fees}
-
\text{shipping subsidy}
-
\text{discount}
-
\text{return cost}
-
\text{fulfillment cost}
$$

A product can have low sales but high margin, or high sales but negative contribution margin.

### Example decision output

```text
Decision: Retain and test

Dominant friction: Shipping cost
Confidence: 0.84
Evidence:
- Shipping fee is 25% above category median
- Product has normal listing engagement
- Competitor products convert better with free shipping
- Inventory and fulfillment are healthy

Recommended intervention:
- Test free shipping for 14 days
- Keep price unchanged
- Compare against similar untreated SKUs

Discard only if:
- Contribution margin remains negative after the test
- Paid-order rate does not improve
- Demand remains insufficient after controlling for traffic
```

The final categories could be:

- **Retain:** healthy performance and positive economics.
- **Retain and optimize:** correctable friction with a testable intervention.
- **Monitor:** insufficient data or uncertain diagnosis.
- **Retire:** persistent poor economics after reasonable interventions.


## 8. How to use the public datasets

### Phase 1: Benchmark purchase prediction

Use the UCI dataset to demonstrate that your explainable model can predict purchase intention from behavioral signals. Report:

- Accuracy.
- Precision, recall, and F1.
- ROC-AUC or PR-AUC.
- Calibration.
- Confusion matrix.
- SHAP or feature-importance explanations.

Because the UCI target is imbalanced—10,422 non-purchase sessions versus 1,908 purchase sessions—accuracy alone would be misleading.[^2]

### Phase 2: Benchmark product matching

Use Abt-Buy or Amazon-Google Products for a manageable matching benchmark. Then test WDC or a marketplace-specific sample if computational resources allow.

Evaluate:

- Precision.
- Recall.
- F1.
- Precision at a high-confidence threshold.
- False-match rate.
- False non-match rate.
- Performance by category.

Use a conservative threshold for competitor pricing. A false match can produce a harmful price recommendation, so precision may be more important than recall.

### Phase 3: Real platform validation

Use your own Shopify, Lazada, and TikTok Shop data where legally and technically available. Public datasets should be described as **external benchmarks**, not as substitutes for platform data.

Your main dataset should contain at least:

- Several weeks or months of time-based records.
- Multiple products.
- Product-level orders and outcomes.
- Price and discount variation.
- Inventory and fulfillment information.
- At least some intervention records.


## 9. Important thesis limitations

State these explicitly:

1. **Cross-platform metrics are not identical.** Shopify can expose a richer customer journey, while marketplace APIs may expose only orders and product data.
2. **Marketplace checkout abandonment may be unobservable.** Do not label unpaid or cancelled orders as checkout abandonment unless the platform explicitly defines them that way.
3. **Competitor matching has uncertainty.** Store a match probability and show the matched attributes to the manager.
4. **Model explanations are not causal proof.** A feature can explain a prediction without being the true reason for customer behavior.
5. **Synthetic data cannot validate business impact.** It can test software and modeling pipelines, but it cannot prove that recommendations improve revenue.
6. **Customer privacy must be protected.** Hash customer IDs, minimize personal data, and avoid storing unnecessary addresses or contact details.
7. **Platform terms and API permissions matter.** Especially for marketplace competitor data, use official APIs or permitted data sources rather than assuming that public pages can be scraped.

## Recommended final architecture

For a manageable thesis, I recommend:

1. **Core platforms:** Shopify and Lazada.
2. **Optional platform:** TikTok Shop, subject to API approval.
3. **Core model:** explainable product-friction classifier.
4. **Technical research component:** cross-platform product matching.
5. **Decision component:** retain, optimize, monitor, or retire.
6. **Validation:** before/after or treatment-control intervention evaluation.
7. **Public benchmarks:** UCI for purchase intention and Abt-Buy/Amazon-Google or WDC for product matching.
8. **Stretch goal:** Shopify-only view-to-cart funnel analysis.

The strongest thesis claim would be:

> This study proposes and evaluates an explainable, platform-aware system that identifies the dominant friction affecting an e-commerce product, links the diagnosis to a specific intervention, and supports evidence-based product-retention or product-retirement decisions.

That claim is substantially stronger than:

> This system calculates abandoned-order rates and recommends whether to keep or discard a product.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58][^59][^60][^61][^62][^63][^9]</span>

<div align="center">⁂</div>

[^1]: product_friction_index_thesis_notes.md

[^2]: https://archive.ics.uci.edu/dataset/468/online+shoppers+purchasing+intention+dataset

[^3]: https://shopify.dev/docs/api/admin-graphql/latest/objects/abandonedcheckout

[^4]: https://www.bwl.uni-mannheim.de/en/details/wdc-large-scale-product-matching-datasets-presented-at-ecnlp-workshop-at-www2019/

[^5]: https://dbs.uni-leipzig.de/research/projects/benchmark-datasets-for-entity-resolution

[^6]: https://shopify.dev/docs/api/admin-graphql/latest/objects/abandonment

[^7]: https://open.lazada.com/apps/doc/api

[^8]: https://docs.lendfriend.org/apis/creators/tiktokshop

[^9]: https://help.shopify.com/en/manual/shopify-flow/reference/actions/get-abandoned-checkout-data

[^10]: https://help.shopify.com/en/manual/shopify-flow/reference/triggers/customer-abandons-checkout

[^11]: https://shopify.dev/docs/api/admin-rest/latest/resources/abandoned-checkouts

[^12]: https://shopify.dev/docs/api/admin-graphql/latest/objects/AbandonedCheckout

[^13]: https://shopify.dev/docs/api/admin-graphql/latest/objects/Abandonment

[^14]: https://shopify.dev/docs/api/admin-graphql/latest/queries/abandonedCheckouts

[^15]: https://open.lazada.com/

[^16]: https://raw.githubusercontent.com/api-evangelist/shopify/refs/heads/main/openapi/shopify-checkouts-api-openapi.yml

[^17]: https://open.lazada.com/doc/api.htm

[^18]: https://shopify-dev.shopifycloud.com/docs/api/admin-graphql/2026-04/objects/AbandonedCheckout

[^19]: https://help.sarasanalytics.com/en_US/shopify-v2/shopify-v2-schema-information

[^20]: https://www.cleverence.com/articles/shopify-dev-documentation/new-abandoned-checkouts-listing-endpoint-on-the-admi-8743/

[^21]: https://open.lazada.com/apps/doc/doc?nodeId=29614\&docId=120945

[^22]: https://help.sarasanalytics.com/lazada

[^23]: https://www.stat.cmu.edu/capstoneresearch/315files_s24/team10.html

[^24]: http://arno.uvt.nl/show.cgi?fid=160935

[^25]: https://huggingface.co/datasets/jlh/uci-shopper?p=1

[^26]: https://www.kaggle.com/datasets/paulsamuelwe/e-commerce-customer-behaviour-dataset

[^27]: https://www.kaggle.com/datasets/uom190346a/e-commerce-customer-behavior-dataset

[^28]: https://rstudio-pubs-static.s3.amazonaws.com/588410_b71a2f1ad47c4eafa145c424f4fc0faf.html

[^29]: https://bigml.com/user/czuriaga/gallery/dataset/5a7a2e4392fb563c2d000cef

[^30]: https://medium.com/@emine3574/online-shoppers-purchasing-intention-part-1-206420502780

[^31]: https://patilpushkarp.github.io/online-shoppers-purchasing-intention/docs/eda/eda_1.html

[^32]: http://rstudio-pubs-static.s3.amazonaws.com/284199_5c498037acc64051862e0829c2702ce5.html

[^33]: https://rstudio-pubs-static.s3.amazonaws.com/446413_6ac206ffa826466bb3a33be2f338c61f.html

[^34]: https://towardsdatascience.com/instacart-market-basket-analysis-part-1-which-grocery-items-are-popular-61cadbb401c8/

[^35]: https://rstudio-pubs-static.s3.amazonaws.com/580173_5e7e8c55cbef48b99cb3d419e94038f4.html

[^36]: https://eudoxuspress.com/index.php/pub/article/download/1892/1218/3555

[^37]: https://shopify.dev/docs/api/admin-graphql/latest

[^38]: https://shopify.dev/docs/apps/build/shopifyql/graphql-admin-api

[^39]: http://shopify.github.io/shopify-api-ruby/usage/graphql.html

[^40]: https://shopify.dev/docs/api/admin-graphql/latest/objects/Product

[^41]: https://shopify.dev/docs/api

[^42]: https://shopify.dev/docs/api/usage/api-exploration/admin-graphiql-explorer

[^43]: https://shopify.dev/docs/api/admin-graphql/latest/queries/inventoryItems

[^44]: https://github.com/Shopify/shopify-api-php/blob/main/docs/usage/graphql.md

[^45]: https://github.com/Shopify/shopify-api-js/blob/main/packages/shopify-api/docs/reference/clients/Graphql.md

[^46]: https://developer.tokopedia.com/openapi/guide

[^47]: https://community.shopify.com/t/accessing-sessions-add-to-cart-conversion-metrics-via-graphql-api/580973

[^48]: https://www.echotik.live/blog/tiktok-shop-data-api-access-endpoints-metrics-and-analytics-2026/

[^49]: https://note.com/tably_shopify/n/n5ea6cd604824?hl=en

[^50]: https://community.shopify.com/t/how-can-we-fetch-the-analytics-data-via-the-api/282026

[^51]: https://link.springer.com/article/10.1007/s10660-022-09667-0

[^52]: https://www.tandfonline.com/doi/full/10.1080/09593969.2022.2126874

[^53]: https://dl.acm.org/doi/10.1145/2247596.2247662

[^54]: https://dbs.uni-leipzig.de/research/publications/intermediate-fusion-for-multimodal-product-matching

[^55]: https://dbs.uni-leipzig.de/research/publications/towards-multi-modal-entity-resolution-for-product-matching

[^56]: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1985860

[^57]: https://www.snowflake.com/en/developers/guides/getting-started-with-entity-resolution-retail-product-classification-for-aggregated-insights/

[^58]: https://paperswithcode.com/datasets?v=lst\&task=entity-resolution

[^59]: https://www.ijsdr.org/papers/IJSDR2605179.pdf

[^60]: https://isma.info/uploads/files/045-the-abandoned-e-tailer-shopping-cart-factors-and-business-strategies-to-reverse-the-barriers-banwari-mittal.pdf

[^61]: https://bijournal.hse.ru/data/2025/06/30/1992787366/1.pdf

[^62]: https://ideas.repec.org/a/sae/busper/v12y2024i3p400-418.html

[^63]: https://ideas.repec.org/a/spr/joamsc/v50y2022i5d10.1007_s11747-022-00857-8.html

