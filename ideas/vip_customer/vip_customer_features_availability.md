<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I want to make a SWE project thesis about VIP customer routing through different platform like Shopify, Lazada, Tik Tok Shop... and process customer caring flow where each AI agent take responsible for individual customer?

Find me relevevant research dataset that I can reference from and check for me whether those dataset can be simulated by the provided data APIs from those platforms

Your thesis is feasible, but I recommend narrowing it from “one customer across Shopify, Lazada, and TikTok Shop” to **VIP customer-care routing within one platform, with a platform-independent simulator and optional multi-platform extension**. Official APIs do not reliably provide a common identity key across marketplaces, so cross-platform customer matching should be treated as out of scope or evaluated only with synthetic identities.

## 1. Recommended thesis formulation

### Suggested title

**An AI-Agent Routing and Customer-Care System for High-Value E-Commerce Customers Under Platform Data Constraints**

Alternative:

**Evaluating Human, AI-Assisted, and Autonomous Agent Handling for VIP E-Commerce Customer Support**

### Main research question

> Does AI-assisted human handling produce better customer-care outcomes than human-only or autonomous-AI handling for high-value e-commerce customers?

A strong system design would contain:

1. An order-history-based VIP scoring model.
2. A customer profile or “briefing” generator.
3. An intent classifier and routing layer.
4. Specialized agents for different customer-care tasks.
5. Human escalation and approval.
6. Outcome measurement.
7. A simulator that replays historical or synthetic orders and conversations.

The most defensible experimental design is the three-arm model in your uploaded thesis notes:


| Arm | Handling model | Purpose |
| :-- | :-- | :-- |
| A | Human representative without AI briefing | Baseline |
| B | Human representative with AI-generated briefing and suggestions | Human-AI collaboration |
| C | Autonomous AI agent | Automation comparison |

This gives you a clearer research contribution than simply building a chatbot.

## 2. Relevant datasets

### A. Transaction and VIP-scoring datasets

| Dataset | Useful fields | Thesis use | API simulation fit |
| :-- | :-- | :-- | :-- |
| **UCI Online Retail II** | Invoice, product, quantity, price, customer ID, country, transaction time | RFM, customer lifetime value, repeat-purchase behavior, VIP segmentation | **High** for order simulation |
| **Instacart Online Grocery Shopping 2017** | Anonymized user ID, order sequence, products, order timing, reorder indicators | Repeat-purchase modeling, customer value prediction, retention and churn simulation | **High** for order-history simulation |
| **Amazon Reviews / Amazon Reviews’23** | Anonymized user/product interactions, ratings, reviews, product metadata, timestamps depending on version | Product affinity, sentiment, customer preference profiling | **Medium**; weak for realistic order and support lifecycle |
| **RetailRocket recommender dataset** | User events such as views, carts, transactions, timestamps | Funnel behavior, intent prediction, purchase likelihood | **Medium**; useful for pre-purchase routing but not customer service |
| **Synthetic Shopify/Lazada order data** | You generate customer, order, line-item, refund, fulfillment, and VIP labels | Main controlled experiment and API-compatible test data | **Very high** |

The UCI Online Retail II dataset is a real two-year transaction dataset from a UK online retailer, making it suitable for RFM and repeat-purchase research. It contains transaction-level records rather than chat conversations, so it should be combined with a dialogue dataset or synthetic conversation generator.[^1]

Instacart is particularly useful because it contains more than 3 million anonymized orders from over 200,000 users, with each user having a sequence of orders and timing information. Its users are anonymized and cannot be linked to external identities, which resembles the masked-identity constraint of marketplace platforms.[^2]

### B. Customer-service and e-commerce dialogue datasets

| Dataset | Conversation type | Thesis use | API simulation fit |
| :-- | :-- | :-- | :-- |
| **JDDC / E-commerce Dialogue Corpus** | Large-scale Chinese e-commerce support conversations | Intent classification, dialogue-state tracking, after-sales support | **High** for chat simulation |
| **E-IntentConv** | Chinese multi-turn e-commerce conversations with fine-grained after-sales intents | Specialized-agent routing and intent transitions | **High** |
| **Customer-support routing datasets on Hugging Face** | Usually synthetic support requests labeled by destination agent | Multi-agent routing, function calling, escalation tests | **High**, but validate data quality |
| **MultiWOZ** | Task-oriented multi-domain dialogues, not specifically e-commerce | Dialogue-state and policy-engineering baseline | **Medium** |
| **Taobao/E-commerce Dialogue Corpus** | Chinese customer-service utterances from e-commerce scenarios | E-commerce intent and response modeling | **High**, subject to licensing and availability |

The JDDC corpus is one of the closest academic datasets to your use case because it was constructed from real-world Chinese e-commerce customer-service scenarios and includes multi-turn conversations.[^3]

E-IntentConv is also relevant because it covers 289 fine-grained after-sales intents, which can be mapped to agents such as refund, delivery, product information, cancellation, complaint, and escalation.[^4]

MultiWOZ is not e-commerce-specific, but it is a widely used benchmark for task-oriented dialogue modeling. It contains approximately 10,000 labeled multi-domain dialogues with dialogue states and system actions, so it is useful for testing your dialogue-state architecture rather than your business domain.[^5]

### C. Multi-agent routing benchmarks

For the routing component, you can also reference:

- **RouterBench**, which contains more than 405,000 model-inference outcomes for studying routing among language models. It is more focused on choosing among LLMs than on customer-service agents, but its evaluation methodology is relevant.[^6]
- **AWS multi-agent collaboration scenario benchmark**, which includes routing scenarios and manually annotated routing labels. The authors report routing accuracy and false agent-switching rate, metrics that translate well to your thesis.[^7]
- **Synthetic e-commerce function-calling datasets**, which label customer queries with specialized support agents. These are useful for engineering evaluation but should not be your only academic evidence because synthetic data may contain artificial language patterns.[^8]


## 3. Can platform APIs simulate the datasets?

### Shopify

Shopify is the most suitable platform for a real prototype because the Admin API exposes structured order and customer data. Its GraphQL `orders` query supports retrieving orders with customer and line-item information, pagination, sorting, and filtering.[^9]

Shopify also supports webhooks for events such as:

- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `orders/fulfilled`
- `customers/create`
- `customers/update`
- `refunds/create`

These webhooks can trigger your routing pipeline without repeatedly polling the API.[^10]


| Dataset feature | Shopify API equivalent | Feasibility |
| :-- | :-- | :-- |
| Customer ID | Shopify customer ID | Yes |
| Order history | `orders` query | Yes |
| Order value | Order total and subtotal fields | Yes |
| Product history | Line items and product variants | Yes |
| Recency and frequency | Computed from order timestamps | Yes |
| Refund and cancellation | Order/refund data and webhooks | Yes |
| Customer profile | Customer resource, subject to permissions | Yes |
| Customer-service conversation | Not equivalent to Shopify Inbox chat by default | Partial |
| Cross-platform identity | No native identity mapping | No |

Shopify can support the **transactional side** of your thesis very well. However, customer-care chat may need to come from your own application, Shopify Inbox-related integration, email, or a synthetic conversation layer. Therefore, do not claim that Shopify alone provides a complete customer-support conversation dataset.

### Lazada

Lazada is a strong fit for your thesis because its IM Open API exposes seller-buyer sessions and messages. The documented API provides session IDs, buyer IDs, message IDs, sender type, timestamps, message templates, unread counts, and site identifiers.[^11]

It also supports sending text, image, item, order, voucher, follow, and video messages through `/im/message/send`.[^12]


| Dataset feature | Lazada API equivalent | Feasibility |
| :-- | :-- | :-- |
| Anonymized buyer ID | `buyer_id` | Yes |
| Conversation ID | `session_id` | Yes |
| Message history | IM message list or push events | Yes |
| Sender role | Buyer/seller account type | Yes |
| Message timestamp | `send_time` | Yes |
| Order-linked conversation | `order_id` and open session flow | Yes, with restrictions |
| Product-linked reply | `item_id` | Yes |
| Voucher or promotion reply | `promotion_id` | Yes |
| VIP order history | Order API plus buyer ID aggregation | Likely, subject to endpoint permissions |
| Arbitrary historical chat corpus | Limited | Partial |
| Cross-platform identity | No | No |

Lazada’s API documentation states that historical conversations and messages are synchronized after authorization, with historical-data limits. It also recommends push-based processing rather than continuous polling.  This makes Lazada appropriate for a real-time prototype, but you should not assume that it can provide a large historical dataset before you obtain seller authorization.[^11]

Important constraints include:

- Buyer and seller session validity rules.
- Limits on seller-initiated conversations.
- Platform message-security filtering.
- Historical synchronization limits.
- API permissions and seller authorization.
- Country-specific endpoints.

Your uploaded notes correctly identify Lazada as a practical MVP platform because it provides both the chat layer and buyer-linked order data, while still preserving the research challenge of masked customer identity.[^13]

### TikTok Shop

TikTok Shop has APIs for seller order operations, but publicly searchable documentation is less straightforward to validate than Shopify or Lazada. Available API schemas indicate order objects containing fields such as order ID, buyer UID, buyer message, payment information, recipient information, and order lines.[^14]


| Dataset feature | TikTok Shop API equivalent | Feasibility |
| :-- | :-- | :-- |
| Order history | Orders API | Yes, subject to seller approval and scopes |
| Buyer identifier | Buyer UID or platform identifier | Partial |
| Order lines | Order-line objects | Yes |
| Buyer message | Order-level buyer message | Partial |
| Full customer chat history | Not established from the public material reviewed | Uncertain |
| Autonomous reply workflow | Requires approved messaging capability | Uncertain |
| Cross-platform identity | No | No |

TikTok Shop may be suitable as a later extension, but I would not make it the primary implementation platform unless you already have approved developer access and a confirmed messaging API.

### Shopee

Shopee’s official Open Platform documentation includes order and chat management APIs.  However, access, scopes, partner approval, and regional availability should be checked directly in your developer account before making Shopee part of the core thesis.[^15]

Your notes identify Shopee chat access as a potential gating issue, so it is safer to treat Shopee as a future integration rather than a dependency for the thesis MVP.[^13]

## 4. Recommended simulation architecture

Use public datasets for **behavioral realism**, then transform them into platform-shaped records.

### Canonical data model

Create a platform-neutral schema:

```text
Customer
- internal_customer_id
- platform
- platform_buyer_id
- vip_score
- vip_segment
- consent_status

Order
- internal_order_id
- platform_order_id
- platform
- customer_id
- created_at
- paid_at
- fulfilled_at
- cancelled_at
- refunded_amount
- total_value
- currency
- order_status

OrderItem
- order_id
- product_id
- sku
- quantity
- unit_price
- category

Conversation
- conversation_id
- customer_id
- platform
- order_id
- started_at
- intent
- priority
- assigned_agent
- escalation_status

Message
- message_id
- conversation_id
- sender
- timestamp
- text
- message_type
- agent_used
- response_latency

Outcome
- conversation_id
- conversion
- additional_order_value
- resolution_status
- customer_satisfaction
- human_override
- escalation_time
```

Then write adapters:

```text
ShopifyAdapter
LazadaAdapter
TikTokShopAdapter
SyntheticMarketplaceAdapter
```

Each adapter converts platform-specific API responses into the canonical schema.

### Data-generation process

1. Use UCI Online Retail II or Instacart to estimate realistic customer purchase frequency and order-value distributions.
2. Generate anonymized marketplace customers.
3. Convert transactions into Shopify-, Lazada-, or TikTok-shaped orders.
4. Use JDDC/E-IntentConv intents to generate or label conversations.
5. Link each conversation to a synthetic order or buyer ID.
6. Assign each buyer an RFM/LTV score.
7. Route conversations to specialized agents.
8. Randomly assign conversations to human, co-pilot, or autonomous-AI treatment groups.
9. Measure response and business outcomes.

This approach is stronger than pretending that a public dataset is an exact copy of a marketplace API. Public datasets provide realistic behavior; the platform adapters provide implementation realism.

## 5. VIP scoring and agent design

### VIP scoring

Start with an explainable RFM model:

$$
VIPScore_i =
w_R R_i + w_F F_i + w_M M_i
$$

where:

- $R_i$ = normalized recency score.
- $F_i$ = normalized purchase-frequency score.
- $M_i$ = normalized monetary-value score.
- $w_R, w_F, w_M$ = chosen weights.

You can extend it with:

- Refund rate.
- Cancellation rate.
- Average order value.
- Product-category diversity.
- Repeat-purchase interval.
- Recent complaint severity.
- Response urgency.
- Predicted next-purchase probability.

Avoid defining VIP only as “top 20% by spending.” Compare several definitions:


| Definition | Advantage | Limitation |
| :-- | :-- | :-- |
| Top monetary percentile | Simple and explainable | Ignores recency |
| RFM threshold | Standard and interpretable | Requires threshold tuning |
| Predicted LTV | More forward-looking | Harder to explain |
| Composite risk-value score | Includes complaints and churn | More complex |

### Specialized agents

A practical agent catalog could be:

1. Product-information agent.
2. Order-status agent.
3. Delivery/logistics agent.
4. Refund and return agent.
5. Cancellation agent.
6. Promotion and voucher agent.
7. Complaint and escalation agent.
8. VIP-retention agent.

The router should output more than an agent name:

```json
{
  "intent": "refund_request",
  "priority": "high",
  "customer_value": "vip",
  "required_agent": "refund_agent",
  "human_approval_required": true,
  "reason": [
    "Customer has high 90-day order value",
    "Message contains refund request",
    "Order is within return period"
  ]
}
```

The explanation field is important because it lets you evaluate whether human representatives trust, follow, or override the AI recommendation.

## 6. What can and cannot be claimed

### Feasible claims

You can realistically evaluate:

- Intent-routing accuracy.
- Correct-agent selection.
- False agent switching.
- VIP classification performance.
- Response latency.
- Resolution rate.
- Human override rate.
- Suggested-response acceptance rate.
- Simulated conversion probability.
- Additional order value in a controlled simulation.
- Differences between human-only, co-pilot, and autonomous-AI arms.


### Claims to avoid

You should not claim that you can:

- Identify the same person across Shopify, Lazada, and TikTok Shop through official APIs.
- Obtain a universal customer profile across these platforms.
- Reconstruct real customer identity from masked buyer IDs.
- Measure real conversion improvement without actual seller traffic or a carefully designed simulation.
- Use a public dataset as direct evidence of Lazada or TikTok Shop behavior.

The cross-platform identity problem is especially important. A safe design is to model each platform customer as a separate identity unless the same user voluntarily authenticates into your own system or provides a consented identifier.

## 7. Best thesis scope

I recommend this scope:

### Core implementation

- Use **Lazada** as the real API integration.
- Use anonymized buyer and order history for VIP scoring.
- Use Lazada IM for messages and sessions.
- Build a unified internal dashboard.
- Implement three treatment arms.
- Use synthetic or imported dialogue data for controlled evaluation.


### Supporting datasets

- **UCI Online Retail II** for RFM and transaction behavior.
- **Instacart** for repeated-order and temporal behavior.
- **JDDC/E-IntentConv** for e-commerce support intents.
- **MultiWOZ** only as a dialogue-state baseline.
- **RouterBench or the AWS routing benchmark** for routing-evaluation methodology.


### Optional extension

- Build a Shopify adapter to demonstrate richer customer data.
- Build a TikTok Shop or Shopee adapter only as a schema-level mock or future-work component.
- Compare “full customer context” against “masked buyer context” without claiming that the same person was matched across platforms.


## Final recommendation

The strongest thesis is not “an AI agent for every marketplace.” It is:

> **A platform-aware, privacy-preserving VIP customer-care routing system that compares human-only, AI-assisted, and autonomous handling under different levels of customer-data availability.**

Use Lazada as the primary live integration, Shopify as a data-rich contrast, and TikTok Shop/Shopee as optional adapters. This gives you a realistic engineering contribution, a measurable research experiment, and a defensible explanation of the limitations imposed by official platform APIs.
<span style="display:none">[^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58][^59][^60][^61][^62]</span>

<div align="center">⁂</div>

[^1]: https://archive-beta.ics.uci.edu/dataset/502/online+retail+ii

[^2]: https://tech.instacart.com/3-million-instacart-orders-open-sourced-d40d29ead6f2

[^3]: http://chenmengdx.github.io/papers/LREC20.pdf

[^4]: https://link.springer.com/chapter/10.1007/978-3-030-60450-9_6

[^5]: https://arxiv.org/abs/1810.00278

[^6]: https://arxiv.org/abs/2403.12031

[^7]: https://arxiv.org/html/2412.05449v1

[^8]: https://huggingface.co/datasets/scionoftech/functiongemma-e-commerce-dataset

[^9]: https://shopify.dev/docs/api/admin-graphql/latest/queries/orders

[^10]: https://shopify.dev/docs/api/admin-rest/latest/resources/webhook

[^11]: https://open.lazada.com/apps/doc/doc?nodeId=10544\&docId=120971

[^12]: https://open.lazada.com/apps/doc/api?path=/im/message/send

[^13]: vip_customer_routing_thesis_notes.md

[^14]: https://pkg.go.dev/github.com/jianjungki/tiktok

[^15]: https://open.shopee.com/documents/v2/api-reference

[^16]: https://aclanthology.org/2026.customnlp4u-1.8/

[^17]: https://cseweb.ucsd.edu/~jmcauley/datasets/amazon_v2/

[^18]: https://shopify.dev/docs/api

[^19]: https://shopify.dev/docs/api/webhooks/latest

[^20]: https://shopify.dev/docs/agents/orders/order-webhooks

[^21]: https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic

[^22]: https://shopify.dev/docs/api/commerce-components/pay/monitoring

[^23]: https://github.com/vakyansh/cucom

[^24]: https://amazon-reviews-2023.github.io/

[^25]: https://raw.githubusercontent.com/api-evangelist/shopify/refs/heads/main/openapi/shopify-webhook-subscriptions-api-openapi.yml

[^26]: https://raw.githubusercontent.com/api-evangelist/shopify-admin/refs/heads/main/openapi/shopify-admin-webhooks-api-openapi.yml

[^27]: https://www.oneoxyzen.com/datasets/MultilingualSupport

[^28]: https://developers.tiktok.com/doc/tiktok-api-scopes

[^29]: https://github.com/tanchonglim/shopee-open-api

[^30]: https://github.com/shinryak/shinryak-shopee-api

[^31]: https://github.com/douglara/shopee-api/blob/main/README.md

[^32]: https://open.lazada.com/apps/doc/doc?nodeId=30739\&docId=120971

[^33]: https://open.lazada.com/apps/doc/api

[^34]: https://open.lazada.com/doc/api.htm

[^35]: https://open.lazada.com/

[^36]: https://developer.alibaba.com/docs/doc.htm?treeId=499\&articleId=108147\&docType=1

[^37]: https://raw.githubusercontent.com/api-evangelist/tiktok/refs/heads/main/openapi/tiktok-orders-api-openapi.yml

[^38]: https://singaporeapi.com/apis/lazada-open-platform

[^39]: https://www.cs.cornell.edu/~arb/data/uchoice-Instacart/

[^40]: https://github.com/TheArc21/Instacart-market-basket-analysis

[^41]: https://www.lexjansen.com/sesug/2019/SESUG2019_Paper-252_Final_PDF.pdf

[^42]: https://github.com/ChristopherCochet/Market-Basket-Analysis

[^43]: https://github.com/nadyavoynich/Instacart

[^44]: https://gist.github.com/seahrh/de6b6cc00ce69136d6ab0fce35a6553e

[^45]: https://p8105.com/dataset_instacart.html

[^46]: https://rstudio-pubs-static.s3.amazonaws.com/416196_84f4b26128934b91a317eadbec980180.html

[^47]: https://rstudio-pubs-static.s3.amazonaws.com/446413_6ac206ffa826466bb3a33be2f338c61f.html

[^48]: https://saimmi.github.io/Customer-segmentation-analysis-/

[^49]: https://mdporter.github.io/SYS6018/other/instacart.html

[^50]: https://mdporter.github.io/DS6030/other/instacart.html

[^51]: https://cur8tor.github.io/tmartzDS/

[^52]: https://aclanthology.org/2025.acl-long.757.pdf

[^53]: https://aclanthology.org/2024.knowledgenlp-1.3.pdf

[^54]: https://papers.nips.cc/paper_files/paper/2025/file/5e3661f7fe4c8ac5652d62eb3d3c96ea-Paper-Datasets_and_Benchmarks_Track.pdf

[^55]: https://arxiv.org/html/2606.28925v1

[^56]: https://arxiv.org/html/2510.05445v1

[^57]: https://github.com/budzianowski/multiwoz

[^58]: https://huggingface.co/datasets/AngieYYF/SPADE-customer-service-dialogue

[^59]: https://github.com/yukyunglee/Awesome-Dialogue-State-Tracking

[^60]: https://github.com/EVASHINJI/Dialog-Datasets/blob/master/datasets/E-commerce_Dialogue_Corpus.md

[^61]: https://journalajrcos.com/index.php/AJRCOS/article/view/722

[^62]: https://www.ijert.org/research/evaluating-the-transformational-impact-of-artificial-intelligence-on-customer-support-a-comparative--IJERTV15IS050892.pdf

