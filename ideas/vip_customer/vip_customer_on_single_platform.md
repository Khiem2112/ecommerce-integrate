<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Focus only on Lazada, list me features that the AI Agents should acknowledge to give me personalized chat with that customer

how do I evaluate the "personalized" or "intimacy" score ?
I want to frame this project as a SWE-based project, should I go too deep into analysis how customer behave ? What software direction can I go instead ?

For a Lazada-only thesis, position the system as a **privacy-aware AI customer-care platform**. The agents should personalize responses using order, conversation, and service-history context—not by trying to infer the buyer’s real-world identity.

Lazada’s APIs support conversation sessions, message retrieval, session details, and sending replies. Its order APIs provide order and item information, but current privacy changes mean that buyer-identifying fields may be masked or encrypted.[^1][^2][^3][^4]

## 1. Customer features agents should use

Do not expose every raw field directly to the LLM. First transform API data into a controlled customer context object.

### Customer-value features

These help the system decide how much care or escalation the customer deserves:

- VIP tier: Platinum, Gold, Silver, Standard.
- Total historical spend.
- Spend during the last 30, 90, and 365 days.
- Number of completed orders.
- Average order value.
- Number of repeat purchases.
- Days since last purchase.
- Average time between purchases.
- Percentage of cancelled orders.
- Percentage of refunded or returned orders.
- Number of unresolved conversations.
- Recent negative-service incidents.
- Predicted next-purchase likelihood, if you implement it.

Example:

```json
{
  "vip_tier": "Gold",
  "orders_last_90_days": 4,
  "spend_last_90_days": 1850000,
  "average_order_value": 462500,
  "days_since_last_order": 12,
  "unresolved_cases": 1
}
```

The agent should use this information to prioritize and adapt service, not to say things such as “You are one of our highest-spending customers” unless the seller explicitly wants that disclosed.

### Current-order features

These are usually more useful than abstract personality assumptions:

- Current order ID.
- Order date.
- Order status.
- Payment status.
- Fulfillment status.
- Shipping status.
- Expected delivery date.
- Actual delay duration.
- Product name or SKU.
- Product category.
- Quantity.
- Order value.
- Voucher or promotion applied.
- Shipping fee.
- Cancellation or refund status.
- Whether the order is within a return or dispute period.
- Previous messages related to the same order.

Lazada’s order APIs expose order and item-level operations, including retrieving order lists, order details, and order items.[^2]

### Conversation features

The agent should understand the immediate conversation before using historical data:

- Conversation/session ID.
- Latest customer message.
- Conversation start time.
- Number of turns.
- Customer’s current intent.
- Sentiment or frustration signal.
- Urgency.
- Whether the customer has repeated the same question.
- Previous promised action.
- Previous seller response.
- Whether the seller failed to meet a previous promise.
- Whether the customer is waiting for an update.
- Whether the conversation is still valid for seller replies.

The Lazada IM API supports retrieving messages for a session and sending a reply to a specific session. Seller-initiated conversation availability can depend on the buyer’s activity and the validity period of the conversation.[^5][^6]

### Customer-preference features

Use only preferences grounded in actual interaction history:

- Preferred language.
- Preferred level of explanation.
- Frequently purchased categories.
- Frequently purchased SKU or product family.
- Preference for specific product variants.
- Preferred delivery-related information.
- Historical preference for vouchers or bundles.
- Whether the customer usually asks before purchasing.
- Whether the customer prefers concise or detailed responses.

Do not invent sensitive or unsupported traits such as age, income, personality, family status, or location beyond what is operationally required.

### Service-history features

These are useful for creating continuity:

- Number of previous conversations.
- Most common support intents.
- Previous resolution outcomes.
- Average response time experienced.
- Previous refund or return cases.
- Repeated product questions.
- Previous escalation history.
- Last unresolved issue.
- Whether the customer accepted or rejected previous solutions.
- Seller promises that remain outstanding.

Example:

```json
{
  "previous_cases": 3,
  "common_intents": ["delivery_status", "product_variant"],
  "last_case_status": "unresolved",
  "previous_resolution": "replacement_offered",
  "customer_repeated_issue": true
}
```


### Real-time operational features

These help route the conversation to the correct agent:

- Intent: delivery, refund, cancellation, product information, voucher, complaint.
- Priority.
- VIP tier.
- Order risk.
- Refund amount.
- Policy eligibility.
- Required tool.
- Human approval requirement.
- Current assigned agent.
- SLA timer.
- Whether the customer has already contacted the seller about the same issue.

A routing result could look like:

```json
{
  "intent": "delivery_delay",
  "priority": "high",
  "vip_tier": "Gold",
  "assigned_agent": "logistics_agent",
  "human_approval_required": false,
  "escalation_reason": null
}
```


## 2. Agent memory design

Do not give the AI agent an unrestricted database dump. Use three memory layers.

### Layer 1: Current-turn context

Use:

- Latest message.
- Recent conversation turns.
- Current order.
- Detected intent.
- Current operational status.

This should be included in every prompt.

### Layer 2: Customer summary

Use a compact structured summary:

- VIP tier.
- Recent order behavior.
- Relevant preferences.
- Previous unresolved issues.
- Important service history.

This should be updated after every conversation.

### Layer 3: Evidence references

Every personalization fact should point to an evidence source:

```json
{
  "fact": "Customer often purchases refill packs",
  "evidence": "3 completed orders containing product category refill_pack",
  "confidence": 0.94,
  "last_observed": "2026-08-10"
}
```

This supports explainability and prevents hallucinated personalization.

A useful rule is:

> The agent may personalize only from facts that have a source, timestamp, and confidence level.

## 3. What “personalized” should mean

Avoid defining personalization as “the message sounds friendly.” For this system, personalization should mean:

1. It addresses the customer’s current problem.
2. It uses relevant order context.
3. It respects known preferences.
4. It maintains continuity with previous interactions.
5. It proposes an action appropriate to the customer’s situation.
6. It does not repeat information the customer already provided.
7. It avoids unsupported assumptions.
8. It complies with Lazada and seller policies.

The literature commonly separates personalization into dimensions such as consistency and coverage. Consistency asks whether the response agrees with known user information; coverage asks whether the response actually uses relevant user information.[^7]

## 4. A practical personalization score

I recommend calling it a **Personalized Service Quality Score**, rather than an “intimacy score.”

“Intimacy” can imply emotional closeness, which is difficult to define, may be inappropriate for customer service, and can encourage the system to sound overly familiar. “Personalized service” is easier to measure and more defensible for a software-engineering thesis.

### Proposed score

Score every assistant response from 0 to 4 on five dimensions:


| Dimension | Question | Score 0 | Score 4 |
| :-- | :-- | :-- | :-- |
| Context relevance | Does it address the current order and issue? | Generic or unrelated | Precisely addresses the current case |
| Customer-history use | Does it use relevant past information? | No relevant history used | Uses relevant history naturally |
| Continuity | Does it remember prior conversation and promises? | Contradicts or repeats history | Clearly maintains continuity |
| Preference adaptation | Does it reflect verified preferences? | Ignores known preference | Appropriately adapts to preference |
| Safe specificity | Is it specific without inventing facts? | Generic or fabricated | Specific, evidence-grounded, privacy-safe |

Calculate:

$$
PSQS = 25 \times \frac{C_r + H_u + C_n + P_a + S_s}{20}
$$

where each dimension is scored from 0 to 4. The result is a score from 0 to 100.

### Interpretation

| Score | Interpretation |
| :-- | :-- |
| 0–24 | Non-personalized or unsafe |
| 25–49 | Slightly contextual |
| 50–74 | Adequately personalized |
| 75–89 | Strong personalization |
| 90–100 | Highly specific and well-grounded |

### Example

Customer message:

> “My parcel still hasn’t arrived. I already asked yesterday.”

Weak response:

> “Please wait while we check your order.”

Possible score:

- Context relevance: 1
- Customer-history use: 0
- Continuity: 0
- Preference adaptation: 0
- Safe specificity: 2

Total: $3/20 \times 100 = 15$.

Better response:

> “I’m sorry you had to follow up again. I checked order 12345, and the latest status is still ‘in transit.’ I’ve marked this as a delivery-delay case and will escalate it instead of asking you to repeat the details. I’ll update you with the next available status.”

Possible score:

- Context relevance: 4
- Customer-history use: 3
- Continuity: 4
- Preference adaptation: 2
- Safe specificity: 4

Total: $17/20 \times 100 = 85$.

The second response is personalized because it acknowledges the repeated contact, uses the actual order state, and changes the action accordingly.

## 5. How to evaluate the score

Use three evaluation layers.

### Layer A: Automated checks

These are suitable for an SWE project:

- Correct order ID used.
- Correct order status used.
- Correct customer intent detected.
- Relevant historical fact retrieved.
- No unsupported customer fact included.
- No forbidden personal information exposed.
- Correct agent selected.
- Correct tool called.
- Response generated within latency target.
- Response follows output schema.

For example:

```python
personalization_facts_used / relevant_facts_available
```

This can measure **personalization coverage**.

You can also calculate:

```python
grounded_facts / total_personalized_claims
```

This measures **grounding precision**.

### Layer B: Human annotation

Have evaluators score a sample of responses using the five dimensions above. Use at least two or three evaluators and report:

- Mean PSQS.
- Standard deviation.
- Inter-rater agreement.
- Percentage of unsafe personalization.
- Percentage of responses judged overly familiar.
- Percentage of responses judged generic.

Human evaluation is important because relevance and continuity cannot always be measured reliably with string matching alone. Research on task-oriented dialogue also evaluates dimensions such as relevance, understanding, task completion, efficiency, and user satisfaction rather than relying on a single overall rating.[^8][^9]

### Layer C: Operational outcomes

Measure whether personalization improves service performance:

- First-response latency.
- Resolution rate.
- Number of turns to resolution.
- Escalation rate.
- Human correction rate.
- Repeat-contact rate.
- Customer satisfaction.
- Refund-resolution time.
- Agent acceptance rate.
- Task completion rate.

A personalized response is not automatically a good response. If it mentions many customer details but fails to solve the problem, it should receive a low overall score.

## 6. Recommended evaluation experiment

You do not need a large behavioral study.

Create a test set of approximately:

- 100–300 synthetic Lazada conversations.
- 5–8 customer-care intents.
- 3 customer-value levels.
- 3 context conditions.

Example conditions:


| Condition | Available context |
| :-- | :-- |
| C1 | Current message only |
| C2 | Current message plus current order |
| C3 | Current message plus order, history, and service summary |

Then compare:

- Generic LLM response.
- RAG response with order context.
- Agent response with customer summary and evidence grounding.

Evaluate:

1. Routing accuracy.
2. Tool-call accuracy.
3. PSQS.
4. Unsupported-fact rate.
5. Resolution rate.
6. Response latency.
7. Human preference.

This isolates the effect of customer context without requiring real customers.

## 7. Should you analyze customer behavior deeply?

No—not if your thesis is primarily software engineering.

You need enough behavioral analysis to justify:

- Why a customer is classified as VIP.
- Why certain context fields are useful.
- Why the router assigns a case to a particular agent.
- How you construct realistic test scenarios.

You do not need to build a full customer-behavior research project involving:

- Psychological profiling.
- Long-term churn modeling.
- Causal analysis of purchasing behavior.
- Cross-platform identity resolution.
- Deep customer segmentation.
- Revenue forecasting.
- Large-scale marketing optimization.

That would make the thesis too broad and shift it toward marketing analytics or data science.

A reasonable boundary is:

> Behavioral analytics supplies the customer context; the thesis evaluates the software system that retrieves, reasons over, routes, and uses that context.

## 8. Better SWE direction

Your strongest software contribution is a **context-aware multi-agent orchestration platform**.

### Core software components

1. Lazada API connector.
2. Webhook or polling ingestion service.
3. Canonical order and conversation data model.
4. Customer-context builder.
5. VIP scoring service.
6. Intent-classification service.
7. Agent router.
8. Specialized task agents.
9. Policy and permission layer.
10. Human approval interface.
11. Conversation memory service.
12. Response-grounding validator.
13. Evaluation dashboard.
14. Audit log and replay simulator.

### Recommended architecture

```text
Lazada API
   |
Ingestion Service
   |
Event Bus / Queue
   |
Conversation and Order Store
   |
Customer Context Builder
   |
Intent Router
   |
+----------------+----------------+----------------+
| Logistics      | Refund         | Product        |
| Agent          | Agent          | Agent          |
+----------------+----------------+----------------+
   |
Policy / Safety Gate
   |
Human Approval or Auto-Reply
   |
Lazada Send Message API
   |
Evaluation and Audit Dashboard
```


### The software research question

A good SWE-oriented research question would be:

> How can a context-aware multi-agent architecture route and generate grounded Lazada customer-service responses while preserving privacy, operational correctness, and human control?

This is stronger than asking only whether VIP customers behave differently.

### Engineering metrics

| Area | Metrics |
| :-- | :-- |
| Routing | Intent accuracy, agent-selection accuracy, false-routing rate |
| Reliability | API failure rate, retry success, duplicate-message rate |
| Performance | p50/p95 response latency, throughput |
| Correctness | Tool-call accuracy, order-status accuracy |
| Safety | Unsupported-fact rate, policy-violation rate, PII exposure rate |
| Personalization | PSQS, coverage, consistency, groundedness |
| Human control | Override rate, approval time, escalation accuracy |
| Maintainability | Test coverage, modularity, adapter complexity |
| Operations | Audit completeness, replay success, observability |

## 9. Suggested final scope

### Must-have

- Lazada-only integration.
- Buyer/session/order normalization.
- One VIP scoring method.
- Four specialized agents:
    - logistics,
    - refund/return,
    - product information,
    - escalation.
- Retrieval-based customer summary.
- Grounded response generation.
- Human approval mode.
- Synthetic conversation replay.
- Evaluation dashboard.
- Privacy and audit controls.


### Nice-to-have

- Autonomous mode.
- Multiple VIP scoring strategies.
- A/B comparison of context levels.
- LLM-as-judge evaluation.
- Explainable routing.
- Policy simulation.


### Exclude

- Cross-platform identity matching.
- Psychological customer profiling.
- Full customer lifetime prediction.
- Marketing campaign optimization.
- Real-money automated refunds.
- Unsupervised autonomous actions with no approval gate.


## Recommended thesis framing

Use this framing:

> This project designs and evaluates a privacy-aware, context-driven multi-agent customer-service platform for Lazada. The system retrieves order and conversation context, assigns customer-care tasks to specialized agents, generates evidence-grounded responses, and supports human approval. Personalization is evaluated as contextual relevance, history coverage, continuity, preference adaptation, and safe specificity rather than emotional intimacy.

That framing keeps the project firmly in software engineering while still giving you a measurable personalization component. It also fits the Lazada APIs: message sessions and replies are supported through the IM API, while order and item data can provide the operational context used by the agents.[^1][^2][^5]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29]</span>

<div align="center">⁂</div>

[^1]: https://open.lazada.com/apps/doc/getting_started

[^2]: https://developer.alibaba.com/docs/doc.htm?treeId=499\&articleId=108147\&docType=1

[^3]: https://www.bigseller.com/blog/articleDetails/4218/lazada-privacy-update-2026.htm

[^4]: https://www.zetpy.com/2026/06/26/important-notice-lazada-open-platform-to-mask-buyer-data-starting-july-1-2026/

[^5]: https://open.lazada.com/apps/doc/doc?nodeId=10544\&docId=120971

[^6]: https://open.lazada.com/apps/doc/doc?nodeId=30739\&docId=120971

[^7]: http://www.lrec-conf.org/proceedings/lrec-coling-2024/pdf/2024.main-1.1192.pdf

[^8]: https://dl.acm.org/doi/10.1145/3477495.3531798

[^9]: https://dl.acm.org/doi/10.1145/3624989

[^10]: https://aclanthology.org/2024.lrec-main.1192/

[^11]: https://arxiv.org/html/2506.09902

[^12]: https://developer.alibaba.com/docs/doc.htm?treeId=499\&articleId=121327\&docType=1

[^13]: https://open.lazada.com/apps/doc/api?path=/order/items/get

[^14]: https://apis.io/apis/lazada/order/

[^15]: https://developer.alibaba.com/docs/doc.htm?treeId=499\&articleId=120984\&docType=1

[^16]: https://help.sarasanalytics.com/lazada

[^17]: https://help.sarasanalytics.com/en_US/lazada/lazada

[^18]: https://developer.alibaba.com/docs/doc.htm?treeId=499\&articleId=121541\&docType=1

[^19]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10328542/

[^20]: https://aclanthology.org/2023.yrrsds-1.18.pdf

[^21]: https://arxiv.org/html/2605.29711v1

[^22]: https://arxiv.org/html/2506.09902v1

[^23]: https://arxiv.org/html/2410.03198v2

[^24]: https://ar5iv.labs.arxiv.org/html/2502.11423

[^25]: https://assets.amazon.science/20/a7/9fd037fc46d8a892b68adb50cf9c/multi-domain-dialogue-quality-evaluation-via-user-satisfaction-estimation.pdf

[^26]: https://staff.fnwi.uva.nl/m.derijke/wp-content/papercite-data/pdf/siro-2024-understanding.pdf

[^27]: https://staff.fnwi.uva.nl/m.derijke/wp-content/papercite-data/pdf/siro-2022-understanding.pdf

[^28]: https://open.lazada.com/doc/api.htm

[^29]: https://singaporeapi.com/apis/lazada-open-platform

