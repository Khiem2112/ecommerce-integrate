# VIP Customer Routing — Implementation Plan

> **Thesis direction:** A privacy-aware, context-driven multi-agent customer-service platform for Lazada that compares human-only, AI-assisted, and autonomous handling under marketplace data constraints.
>
> **Research question:** Does AI-augmented human handling produce better customer-care outcomes than human-only or autonomous-AI handling for high-value e-commerce customers?

---

## Project Overview

### 7 Parts across 5 Phases

| Part | Name | Phase |
|:----:|------|:-----:|
| 1 | RAG Pipeline (seed data) | Phase 1 |
| 2 | Minimal Management UI | Phase 1 |
| 3 | VIP Segmentation + Explainable AI | Phase 2 |
| 4 | Multi-Agent Router & Retention Copilot | Phase 3 |
| 5 | Complete Management UI & Adaptive Context | Phase 3 |
| 6 | Lazada API Ingestion + Chat Layer | Phase 4 |
| 7 | Evaluation Framework | Phase 5 |

### Phase Dependency Map

```
Phase 1: RAG Pipeline + Minimal UI          [seed data only — zero external dependencies]
    ↓
Phase 2: VIP Segmentation + XAI             [seed data only — enriches Phase 1 context]
    ↓
Phase 3: Multi-Agent Router + Full UI       [seed data only — adds routing intelligence]
    ↓
Phase 4: Connect to Reality                 [Lazada API — replaces seed data with real data]
    ↓
Phase 5: Prove It's Research                [evaluation — turns product into thesis]
```

> **Key design principle:** Phases 1–3 have ZERO external dependencies. The entire system works on seed data before ever touching Lazada APIs. This eliminates timeline risk from API approval delays.

---

## Phase 1 — RAG Pipeline + Minimal UI

> **Goal:** Prove that given customer context, the system generates grounded, personalized responses. Make it visible with a basic UI.

### Part 1: RAG Pipeline (Core Engine)

#### 1.1 Seed Data Schema

Schema is defined in Prisma, connecting to Supabase PostgreSQL:

- **Schema file:** `seed/schema.prisma`
- **Seed specification:** `seed/seed_specification.md`

**Database design conventions:**

| Convention | Implementation |
|-----------|---------------|
| Reference/lookup data | Catalog tables with `_catalog` suffix (platform, VIP tier, category, intent, agent, experiment arm) |
| Status tracking | Dedicated status tables (`order_status`, `conversation_status`, `escalation_status`) — entities store `currentStatusId` FK |
| Status history | `order_status_history` table tracks transitions over time |
| Sender identity | Separate `sender_type` table (buyer, seller, agent_logistics, agent_refund, etc.) with `isHuman`/`isAgent` flags |
| Message types | `MessageType` enum validated at schema level (TEXT, IMAGE, ITEM, ORDER, VOUCHER, VIDEO, EMOJI, SYSTEM) |
| Evidence tracking | `customer_evidence` table for Layer 3 memory (fact, evidence, confidence, timestamp) |
| Audit trail | `routing_decision` table records every routing choice with reasons and override status |

**Key tables:**

```
Catalog tables:     platform_catalog, vip_tier_catalog, category_catalog,
                    intent_catalog, agent_catalog, experiment_arm_catalog

Status tables:      order_status, conversation_status, escalation_status, sender_type

Domain tables:      customer, order, order_item, order_status_history,
                    conversation, message, customer_evidence, routing_decision
```

#### 1.2 Seed Data Generator

- Generate **500–1000 synthetic customers** with realistic distributions based on UCI Online Retail II:
  - ~75% one-time buyers (F=1)
  - ~20% repeat buyers (F=2-5)
  - ~5% VIP-level buyers (F>5, high monetary)
- Generate **3000–5000 orders** across those customers
- Hardcode 3 customer tiers for Phase 1 (Phase 2 will compute these automatically):
  - **VIP (Platinum/Gold):** top 5% by spend, frequent buyers
  - **Regular (Silver):** repeat buyers, moderate spend
  - **New (Standard):** single-purchase or recent customers
- Generate **100–200 seed conversations** covering 5–8 intents:
  - Delivery status inquiry
  - Refund/return request
  - Product information question
  - Order cancellation
  - Complaint / escalation
  - Voucher / promotion inquiry
  - Re-purchase / product recommendation
  - General inquiry

#### 1.3 Customer Context Builder

Assembles all available information about a customer into a structured context object for the LLM:

**Three-layer memory design:**

| Layer | Contents | Update Frequency |
|-------|----------|:----------------:|
| **Layer 1: Current Turn** | Latest message, current order details, detected intent, conversation turns so far | Every message |
| **Layer 2: Customer Summary** | VIP tier, recent order behavior, preferences, unresolved issues, service history | After every conversation |
| **Layer 3: Evidence References** | Traceable facts with source, timestamp, confidence | On data change |

Example Layer 3 evidence:

```json
{
  "fact": "Customer frequently purchases electronics accessories",
  "evidence": "4 of 6 completed orders contain category 'electronics_accessories'",
  "confidence": 0.92,
  "last_observed": "2026-08-10"
}
```

**Rule:** The agent may personalize only from facts that have a source, timestamp, and confidence level.

#### 1.4 LLM Multi-Draft Response Generation

- **Single API Call Architecture:** Operates via a single LLM invocation per turn. The system prompt injects the 3-layer customer context alongside a default candidate catalog of **6–7 tactical retention tones**:
  1. **Goodwill & De-escalation (Loss Aversion)**: Empathic apology + proactive courtesy compensation (vouchers/discounts capped by tier policy) to prevent churn or negative reviews.
  2. **White-Glove VIP Priority (Status Reinforcement)**: Emphasizes dedicated personal handling, supervisor follow-up, and priority courier audit without immediate monetary compensation.
  3. **Fast & Direct (Effort Minimization)**: Bulleted, concise updates with tracking IDs and zero boilerplate text for busy customers.
  4. **Consultative & Value-Add (Commercial Retention)**: Uses past order memory to answer compatibility and recommend relevant additions.
  5. **Empathetic Reassurance (Trust Building)**: Reassures anxious first-time or high-value buyers with transparent tracking stages and buyer protection details.
  6. **Firm Professional (Boundary & Policy)**: Polite, clear enforcement of marketplace return windows and cancellation terms.
  7. **Proactive Delight (Loyalty Surprise)**: Rewards unprompted high-value repeat buyers with priority perks or appreciation.
- **AI Tone Selection & Comparative Ranking (Single Turn):**
  - From the 6–7 candidate tones, the LLM analyzes the customer's VIP tier, sentiment, and current intent, dynamically selects the **2–3 most relevant tones**, generates a grounded draft for each, and ranks them to declare the `#1 recommended tone` with explicit rationale.
- **Response Grounding & Tone Guardrails:**
  - **No Internal Segmentation Jargon:** The AI must **NEVER** expose internal classification labels (e.g., *"Platinum"*, *"Gold"*, *"VIP tier"*, *"RFM Score"*) in customer-facing messages. Instead, use natural, customer-centric phrasing (e.g., *"khách hàng thân thiết"*, *"khách hàng ưu tiên"*, *"tri ân sự đồng hành của anh/chị"*).
  - Every customer-specific claim in every draft must trace to an evidence reference.
  - Flag and filter drafts containing unsupported facts.
  - Compliance check: no forbidden PII exposed, voucher amounts strictly enforced against VIP tier caps.
- Output format:

```json
{
  "recommendedStrategyId": "strat_whiteglove",
  "recommendationReason": "Customer is a Platinum VIP (Score 92/100, 0 returns) inquiring about delivery timeline. Delay is minor (<12h), so status reinforcement with carrier priority ping is optimal without consuming voucher budget.",
  "strategies": [
    {
      "id": "strat_whiteglove",
      "type": "white_glove_priority",
      "label": "White-Glove VIP Priority",
      "tone": "exclusive_concierge",
      "retentionFocus": "Reinforces VIP status with priority courier follow-up without mentioning internal tier names.",
      "isBestMatch": true,
      "draftText": "Chào anh Nam, vì anh là khách hàng thân thiết luôn đồng hành cùng shop, em đã trực tiếp liên hệ điều phối viên bưu cục SPX để ưu tiên đẩy nhanh tiến độ đơn hàng #84920 cho anh. Em sẽ theo dõi sát và cập nhật cho anh ngay khi hàng xuất kho ạ.",
      "groundedFactsUsed": ["order_84920_status", "vip_tier_platinum"],
      "ungroundedClaims": [],
      "confidence": 0.94,
      "suggestedAction": "await_approval"
    },
    {
      "id": "strat_goodwill",
      "type": "goodwill_deescalation",
      "label": "Goodwill & Compensation",
      "tone": "empathic_apologetic",
      "retentionFocus": "Prevents churn by acknowledging the transit delay with a 25k VND courtesy voucher.",
      "isBestMatch": false,
      "draftText": "Chào anh Nam, em rất tiếc vì kiện hàng #84920 đang bị chậm trễ tại kho trung chuyển. Để bù đắp sự bất tiện này, shop xin gửi tặng anh mã voucher tri ân 25.000đ và đã yêu cầu bưu cục giao ưu tiên trong chiều nay ạ.",
      "groundedFactsUsed": ["order_84920_delay", "vip_tier_platinum"],
      "ungroundedClaims": [],
      "confidence": 0.90,
      "suggestedAction": "await_approval"
    },
    {
      "id": "strat_concise",
      "type": "fast_friction_free",
      "label": "Fast & Direct",
      "tone": "bullet_factual",
      "retentionFocus": "Minimizes cognitive effort for busy customers who prefer immediate factual updates.",
      "isBestMatch": false,
      "draftText": "Kiện hàng #84920 hiện đang ở kho trung chuyển (mã vận đơn: SPXVN09281). Bưu cục đã tiếp nhận yêu cầu giao hỏa tốc, dự kiến phát trước 17:00 hôm nay anh nhé.",
      "groundedFactsUsed": ["order_84920_status"],
      "ungroundedClaims": [],
      "confidence": 0.96,
      "suggestedAction": "auto_reply"
    }
  ]
}
```

#### 1.5 Deliverables Checklist

- [ ] Canonical data schema implemented
- [ ] Seed data generator producing realistic customers, orders, conversations
- [ ] Customer context builder assembling 3-layer context objects
- [ ] LLM prompt template with context injection and multi-strategy instructions
- [ ] Multi-draft response generation producing 2–3 distinct retention options
- [ ] Response grounding validator checking all generated drafts
- [ ] Test harness: feed seed conversations, inspect grounded multi-draft outputs
- [ ] Key test passed: VIP customer with past orders + unresolved complaint → response references correct order, acknowledges complaint, provides distinct retention angles without hallucinating facts

---

### Part 2: Minimal Management UI

#### 2.1 Core Views (Phase 1 only — bare minimum)

| View | Purpose |
|------|---------|
| **Conversation Inbox** | List of conversations with customer name/ID, latest message preview, timestamp, intent tag |
| **Conversation Detail** | Message thread with customer context panel on the side |
| **Customer Context Panel** | VIP tier badge, order history summary, current order details, evidence-backed facts |
| **AI Multi-Draft Preview** | Shows multiple generated response drafts with strategy switcher tabs; **pre-selects the AI recommended tone by default**, displays the AI comparative rationale banner, and shows per-draft grounding annotations |
| **Approve / Edit / Reject** | Human can inspect the pre-selected tone, switch tabs to compare alternatives, modify text inline, approve to send in 1 click, or reject |

#### 2.2 What Phase 1 UI does NOT include (deferred to Phase 3)

- Agent routing visualization & Intent dispatcher
- Executable AI action triggers (incident reports, vouchers, courier tickets)
- Adaptive context filtering & dedicated Evidence Proof Drawer
- Dynamic multi-factor scoring formula for 100+ tone catalogs (Phase 1 uses 6–7 core default candidate tones directly in prompt)
- Three-arm toggle (A/B/C mode switching)
- Full audit log / replay
- Evaluation dashboard
- VIP segmentation configuration
- Policy / permission management

#### 2.3 Deliverables Checklist

- [ ] Conversation inbox view
- [ ] Conversation detail view with message thread
- [ ] Customer context panel showing tier + order history + evidence
- [ ] AI multi-draft response preview with strategy switcher tabs (pre-selecting `#1 recommended tone` by default)
- [ ] AI comparative rationale banner explaining why the winning tone was chosen
- [ ] Per-strategy grounding annotations (which facts were used)
- [ ] Approve / Edit / Reject interaction flow with 1-click dispatch
- [ ] Responsive layout (desktop-first)

---

## Phase 2 — VIP Segmentation + Explainable AI

> **Goal:** Replace hardcoded customer tiers with computed, explainable VIP scoring. The RAG pipeline now receives richer, auto-generated customer context.

### Part 3: VIP Segmentation Engine

#### 3.1 RFM Scoring

Base model:

```
VIPScore = w_R × R_norm + w_F × F_norm + w_M × M_norm
```

Where:
- `R_norm` = normalized recency (days since last purchase, lower = better)
- `F_norm` = normalized purchase frequency
- `M_norm` = normalized monetary value (total spend)
- `w_R, w_F, w_M` = configurable weights (default: 0.2, 0.3, 0.5)

#### 3.2 Extended Features

Beyond basic RFM, compute:

| Feature | Calculation | Source |
|---------|------------|--------|
| Avg order value | `total_spend / order_count` | Order data |
| Cancellation rate | `cancelled_orders / total_orders` | Order data |
| Refund rate | `refunded_orders / delivered_orders` | Order data |
| Category diversity | Unique categories purchased | OrderItem data |
| Repeat-purchase interval | Avg days between consecutive orders | Order timestamps |
| Voucher sensitivity | `% orders with discount > 0` | Order data |
| Recent complaint severity | Count of recent escalations | Conversation data |
| Payment reliability | `paid_orders / total_orders` | Order data |

#### 3.3 VIP Tier Assignment

| Tier | Criteria | Typical % of customer base |
|------|----------|:--------------------------:|
| **Platinum** | Top 2% VIPScore + F ≥ 5 + no recent complaints | ~2% |
| **Gold** | Top 10% VIPScore + F ≥ 3 | ~8% |
| **Silver** | F ≥ 2 or top 30% VIPScore | ~15% |
| **Standard** | Everyone else | ~75% |

Compare multiple definitions and report which produces the most actionable segmentation.

#### 3.4 Explainability (SHAP)

- Use gradient boosting (XGBoost/LightGBM) for VIP classification
- Generate SHAP explanations for each customer:
  - Global: which features matter most across all customers
  - Local: why THIS specific customer is classified as VIP/non-VIP
- Surface in UI: "This customer is Gold tier because: high 90-day spend (top 8%), 4 repeat purchases, low cancellation rate"

#### 3.5 Integration with Phase 1

- Replace hardcoded tiers with computed scores
- Customer context builder now includes SHAP explanation as evidence
- RAG pipeline receives richer context → generates better responses

#### 3.6 Deliverables Checklist

- [ ] RFM scoring engine with configurable weights
- [ ] Extended feature computation (cancellation rate, refund rate, category diversity, etc.)
- [ ] VIP tier assignment with multiple definition strategies
- [ ] SHAP explanations for individual customer classifications
- [ ] Integration: computed VIP scores flow into customer context builder
- [ ] UI: customer profile view shows VIP score + SHAP explanation
- [ ] Unit tests proving scoring is deterministic

---

## Phase 3 — Multi-Agent Router + Complete UI

> **Goal:** The system now intelligently routes conversations to specialized agents, generates multi-strategy retention drafts with actionable operational triggers, and presents an adaptive "Summary vs. Proof" interface to prevent agent cognitive overload.

### Part 4: Multi-Agent Router & Retention Copilot

#### 4.1 Intent Classifier

Classify incoming messages into fine-grained e-commerce customer-care intents:

| Intent | Example Message | Target Routing Agent |
|--------|----------------|----------------------|
| `delivery_status` | "Where is my parcel? It's been 3 days." | Logistics Agent |
| `refund_request` | "I want to return this item, it's damaged." | Refund / Return Agent |
| `product_info` | "Does this switch fit the Q1 Pro keyboard?" | Product Info Agent |
| `cancellation` | "Cancel my order please, ordered by mistake." | Cancellation Agent |
| `complaint` | "This is the third time I'm asking for support!" | Escalation & VIP Retention Agent |
| `voucher` | "Do you have any discount for loyal buyers?" | Promotion & Retention Agent |
| `general` | "Hi, I have a question about my purchase." | General Inquiry Agent |

#### 4.2 Routing Engine

Input: `intent + VIP tier + order status + sentiment score + conversation history`

Output:
```json
{
  "intent": "refund_request",
  "priority": "high",
  "customer_value": "vip_platinum",
  "required_agent": "refund_agent",
  "human_approval_required": true,
  "reason": [
    "Customer has high 90-day order value (Platinum tier)",
    "Message contains refund request for damaged item",
    "Order #84920 is within 7-day return window"
  ]
}
```

Routing rules:
- VIP + complaint → always escalation agent + human approval required
- VIP + refund > 150,000 VND → refund agent + human approval required
- Standard + delivery inquiry → logistics agent + auto-reply allowed
- Any customer + repeated same question (friction index ≥ 2) → priority boost + human escalation

#### 4.3 Domain-Specialized Agent Prompts

Specialize the Phase 1 multi-draft retention prompt across 4 dedicated domain agents:

| Agent | Domain Specialization | Specialized Tools & Actions |
|-------|----------------------|-----------------------------|
| **Logistics Agent** | Delivery status, carrier tracking, transit delay compensation | Courier status lookup, delay compensation trigger, priority carrier audit |
| **Refund / Return Agent** | Return eligibility, refund calculation, policy checks | 1-click no-return refund (for low-risk VIPs), return label generation |
| **Product Info Agent** | Product compatibility, inventory lookup, recommendations | Catalog specs query, stock verification, cross-sell compatibility checker |
| **Escalation & Retention Agent** | Dissatisfied VIPs, service failures, churn intervention | VIP incident report generator, courtesy voucher issuance, churn watchlist |

Each specialized agent inherits the customer context and generates domain-tailored retention drafts (Goodwill, VIP Privilege, Fast & Direct, Consultative) according to its specific responsibilities.

#### 4.4 Scalable Multi-Factor Tone Scoring Formula (Large Catalog Retrieval)

While Phase 1 starts with a default core set of **6–7 candidate tones** directly injected into the prompt, Phase 3 supports scaling to **dozens or hundreds of catalogued retention tones** stored in `retention_strategy_catalog`.

To prevent prompt bloat and token waste while preserving LLM reasoning quality, Phase 3 implements an in-memory **Multi-Attribute Utility Theory (MAUT) & Service Recovery Scoring Formula** that pre-filters the catalog down to **4–6 candidate tones** in `< 2ms` before the single LLM invocation:

$$\text{ToneMatchScore}(t) = w_{\text{intent}} \cdot S_{\text{intent}}(t) + w_{\text{VIP}} \cdot S_{\text{VIP}}(t) + w_{\text{friction}} \cdot S_{\text{friction}}(t) + w_{\text{cost}} \cdot S_{\text{cost}}(t)$$

Where:
- **$S_{\text{intent}}(t)$ (Intent Relevance, $w=0.40$):** Measures how directly tone $t$ resolves the detected intent (e.g. *Consultative* for `product_info`, *De-escalation* for `complaint`/`delay`). Grounded in Customer Effort Score theory (Dixon et al., 2010).
- **$S_{\text{VIP}}(t)$ (VIP Alignment, $w=0.30$):** Calibrated to customer RFM/VIP tier (e.g. *White-Glove VIP* scores 1.0 for Platinum, 0.8 for Gold, 0.0 for Standard). Grounded in Customer Lifetime Value theory.
- **$S_{\text{friction}}(t)$ (Friction & Sentiment Urgency, $w=0.20$):** Boosts Distributive and Interactional Justice tones (*Goodwill*, *Empathetic*) if sentiment is negative or conversation turns $\ge 3$. Grounded in Service Recovery Paradox (Smith, Bolton & Wagner, 1999).
- **$S_{\text{cost}}(t)$ (Budget & Cost Efficiency, $w=0.10$):** Enforces policy voucher caps and favors non-monetary status reinforcement when appropriate.

The single LLM API call receives only the top 4–6 pre-filtered tones, selects the 2–3 best drafts for the turn, and declares the `#1 recommended tone` with explicit comparative rationale.

#### 4.5 AI Action Points & Execution Recommender

Alongside drafts, the specialized AI agents recommend concrete operational and financial actions that the human agent can trigger with 1 click:

| Category | Action Key | Action Label & Description | Policy & Perms |
|----------|------------|----------------------------|----------------|
| **Reporting** | `generate_incident_report` | **Generate VIP Incident Report**: Auto-compiles conversation timeline, order logs, and courier lag times into an internal markdown/PDF report for warehouse/management. | Any agent |
| **Logistics** | `dispatch_logistics_ticket` | **Logistics Priority Investigation Ticket**: Sends high-priority escalation ping to courier desk with tracking logs. | Discretionary |
| **Financial** | `issue_goodwill_voucher` | **Issue Courtesy Goodwill Voucher**: Pre-fills discount code within VIP tier cap (Silver: 10k, Gold: 25k, Platinum: 50k VND). | Tier policy cap |
| **Financial** | `instant_refund_no_return` | **1-Click Instant Refund without Return**: For low-value items (< 100k VND) when VIP fraud score is zero. | Tier policy cap |
| **Retention** | `flag_churn_watchlist` | **Add to High-Risk VIP Churn Watchlist**: Triggers a 48-hour automated follow-up reminder for store manager. | Manager review |
| **Memory** | `save_customer_preference` | **Log Preference to Layer 3 Memory**: Automatically extracts stated customer preference (e.g. "Prefers SPX courier", "Requires VAT e-invoice") and updates customer dossier. | Instant audit |

#### 4.6 Deliverables Checklist

- [ ] Intent classifier (rule-based and LLM-based)
- [ ] Routing engine with explainable routing decisions
- [ ] 4 domain-specialized agent prompt templates
- [ ] Multi-factor tone scoring formula for large catalog retrieval (MCDM/MAUT based)
- [ ] AI action recommender & dispatcher services (incident reports, vouchers, watchlist)
- [ ] Agent selection & action recommendation test suite
- [ ] Routing decision and action audit logging

---

### Part 5: Complete Management UI & Adaptive Context Architecture

#### 5.1 Adaptive Information Architecture: "Summary vs. Proof" (Anti-Overload UX)

To prevent cognitive fatigue and information blindness, the UI replaces dense data dumps with **Progressive Disclosure**:

1. **Top-Level Salient Insight Cards (Max 2–3)**:
   - The AI selectively surfaces only the high-salience context needed for the current turn:
     - *Card 1 (Logistics)*: `[⚠️ Order #84920 delayed 48h at Thu Duc Hub]`
     - *Card 2 (VIP Loyalty)*: `[⭐ Platinum VIP: 12 orders, 0 returns, 14.5M VND spend]`
   - Each card provides a 1-sentence **AI Summary** explaining why this fact matters right now.
2. **Dedicated Evidence Proof Drawer (On-Demand Deep Dive)**:
   - Every salient card contains an **"Inspect Proof"** trigger.
   - Clicking opens a slide-out **Evidence Audit Drawer** displaying:
     - **The Real Data Proof**: Raw immutable database records, carrier webhook timestamps, and SHAP attribution bars.
     - **Data Freshness & Source**: Timestamp, source system, and confidence score.
     - **Grounding Citation**: Verification that the AI's claims strictly match the raw proof.

#### 5.2 Action Trigger Dock & Incident Report Modal

Inside the chat view (`ChatPanel.tsx` / `AiResponsePreview.tsx`):
- **Action Trigger Dock**: Interactive action chips rendered directly beneath the draft (e.g., `[📄 Generate Incident Report]`, `[🎟️ Issue 50k Voucher]`, `[🚨 Add to Watchlist]`).
- **Action Modals**: Pre-populated forms with 1-click confirmation (e.g., pre-filled VIP incident markdown summary ready for export).

#### 5.3 Core Views

| View | Purpose |
|------|---------|
| **Routing Dashboard** | Shows intent classification, agent assignment, priority, and routing reasoning |
| **Three-Arm Toggle** | Switch between Arm A (human-only), Arm B (co-pilot), Arm C (autonomous) per conversation or globally |
| **Customer Profile Page** | Full VIP score breakdown, SHAP explanation waterfall, order timeline, conversation history, preference memory vault |
| **Evidence Proof Drawer** | Side-drawer displaying raw immutable evidence, order JSON, and grounding proof on demand |
| **Incident Report Viewer** | Dedicated modal/page to preview and export AI-generated VIP incident reports |
| **Audit Log** | Every routing decision, AI response strategy, action executed, and human override — timestamped and searchable |
| **Agent Performance View** | Per-agent metrics: response count, strategy selection breakdown, approval rate, action trigger rate, avg latency |

#### 5.4 Three-Arm Mode Behavior

| Mode | AI Generates Strategy Drafts? | AI Suggests Actions? | Human Sees & Approves? | Reply Sent How? |
|------|:----------------------------:|:--------------------:|:---------------------:|:---------------:|
| **Arm A: Human-only** | No | No | No | Human writes manually |
| **Arm B: Co-pilot** | Yes (Multi-strategy) | Yes (Action dock) | Yes — reviews draft & triggers actions | Human approves/edits, then sends |
| **Arm C: Autonomous** | Yes (Default strategy) | Autonomous (Policy rules) | Optionally (Audit log) | Auto-sent after grounding check passes |

#### 5.5 Deliverables Checklist

- [ ] Routing dashboard with visual decision flow
- [ ] Action trigger dock with action confirmation modals
- [ ] Incident report generation modal and PDF/Markdown exporter
- [ ] Adaptive salient insight cards on conversation detail view
- [ ] Dedicated Evidence Proof Drawer showing raw data records & SHAP charts
- [ ] Three-arm toggle (global and per-conversation)
- [ ] Customer profile page with VIP scoring + SHAP visualization
- [ ] Full audit log with search and filter
- [ ] Agent performance summary view with strategy & action metrics

---

## Phase 4 — Connect to Reality

> **Goal:** Replace seed data with real Lazada API data. Prove engineering quality with resilience patterns.

### Part 6: Lazada API Integration

#### 6.1 Order Data Ingestion

| Component | Implementation |
|-----------|---------------|
| **Auth** | OAuth 2.0 code-for-token flow, auto-refresh |
| **Order Sync** | `GetOrders` + `GetOrderItems` with sliding 15-day windows |
| **Product Sync** | `GetProducts` + `GetProductItem` for catalog |
| **Review Sync** | `GetProductReviewList` for review text + ratings |
| **Normalization** | Lazada fields → canonical schema (same schema as seed data) |
| **Webhooks** | Subscribe to `orders/create`, `orders/updated` for real-time |

#### 6.2 Chat Layer (Lazada IM)

| Component | Implementation |
|-----------|---------------|
| **Session List** | `/im/session/list` → active conversations |
| **Message Retrieval** | `/im/message/list` with pagination (`session_id`, `start_time`, `last_message_id`, `page_size=20`) |
| **Send Message** | `/im/message/send` — text (template_id=1), item (10006), order (10007), voucher (10008) |
| **Webhook** | Subscribe to `IM Send Message Notifications` + `IM Session Update Notifications` |
| **Session Lifecycle** | Track conversation validity periods, handle expired sessions |

#### 6.3 Resilience Patterns

| Pattern | Purpose |
|---------|---------|
| **Retry with exponential backoff** | Handle transient API failures (429, 500, 503) |
| **Idempotent writes** | Same `order_id` → no duplicate records |
| **Dead-letter queue** | Failed records saved for manual review / retry |
| **Circuit breaker** | Stop calling Lazada if error rate > threshold, auto-recover |
| **Fallback to polling** | If webhooks stop delivering, switch to periodic poll |
| **Incremental sync** | Track `updated_after` cursor, never re-pull full history |
| **Data freshness monitor** | Alert if sync falls behind by > N minutes |
| **Graceful degradation** | If Lazada is down, system continues working with cached data |

#### 6.4 Data Consistency

- All writes are transactional (order + items in one operation)
- Deduplication by platform `order_id` before insert
- Conflict resolution: latest `updated_at` wins
- Audit trail: every sync operation logged with timestamp + record count + errors

#### 6.5 Deliverables Checklist

- [ ] Lazada OAuth connector with token refresh
- [ ] Order sync service with pagination and sliding windows
- [ ] Product + review sync service
- [ ] Lazada IM connector (session list, message retrieval, send message)
- [ ] Webhook listeners for orders and IM events
- [ ] All 7 resilience patterns implemented
- [ ] Data normalization: Lazada → canonical schema
- [ ] Integration test: real Lazada sandbox → data flows into system → RAG generates response
- [ ] Monitoring dashboard: sync status, error rates, data freshness

---

## Phase 5 — Prove It's Research

> **Goal:** Measure everything. Turn a product demo into a thesis with defensible evidence.

### Part 7: Evaluation Framework

#### 7.1 Automated Checks

| Check | What it measures |
|-------|-----------------|
| Correct order ID used in response | Factual accuracy |
| Correct order status referenced | Data freshness |
| Intent classification accuracy | Router quality |
| Routing accuracy (correct agent selected) | System intelligence |
| Grounding precision (`grounded_facts / total_claims`) | Hallucination prevention |
| Personalization coverage (`facts_used / relevant_facts_available`) | Context utilization |
| No PII exposure | Privacy compliance |
| Response latency (p50 / p95) | Performance |
| Response follows output schema | System reliability |

#### 7.2 PSQS — Personalized Service Quality Score

Score every AI response on 5 dimensions (0–4 each):

| Dimension | Score 0 | Score 4 |
|-----------|---------|---------|
| **Context relevance** | Generic or unrelated | Precisely addresses the current case |
| **Customer-history use** | No relevant history used | Uses relevant history naturally |
| **Continuity** | Contradicts or repeats history | Clearly maintains continuity |
| **Preference adaptation** | Ignores known preference | Appropriately adapts to preference |
| **Safe specificity** | Generic or fabricated | Specific, evidence-grounded, privacy-safe |

```
PSQS = 25 × (C_r + H_u + C_n + P_a + S_s) / 20
```

Result: 0–100 score.

| Score Range | Interpretation |
|:-----------:|----------------|
| 0–24 | Non-personalized or unsafe |
| 25–49 | Slightly contextual |
| 50–74 | Adequately personalized |
| 75–89 | Strong personalization |
| 90–100 | Highly specific and well-grounded |

#### 7.3 Three-Arm Experiment

**Test set design:**
- 100–300 synthetic conversations
- 5–8 customer-care intents
- 3 customer-value levels (VIP / Regular / New)
- 3 context conditions:
  - C1: current message only
  - C2: current message + current order
  - C3: current message + order + full history + service summary

**Run each conversation through:**
- Arm A: human-only baseline (use seed "human" responses or manual annotation)
- Arm B: co-pilot mode (AI generates, human reviews)
- Arm C: autonomous (AI generates and sends)

**Metrics per arm:**

| Metric | How measured |
|--------|-------------|
| PSQS | 5-dimension scoring |
| Routing accuracy | % correct agent selected |
| Grounding precision | % claims with evidence |
| Unsupported-fact rate | % responses with hallucinated facts |
| Response latency | ms from message received to response generated |
| Resolution rate | % conversations reaching resolution |
| Human override rate | % of AI suggestions modified or rejected (Arm B) |

**Statistical analysis:**
- Compare means across arms with appropriate tests
- Report effect sizes and confidence intervals
- N ≥ 60 per arm for meaningful comparison (α=0.05, β=0.80)

#### 7.4 Human Annotation

- 2–3 evaluators score a sample (50–100 responses)
- Report inter-rater agreement (Cohen's κ or Krippendorff's α)
- Report:
  - Mean PSQS per arm
  - % responses judged "generic"
  - % responses judged "overly familiar"
  - % responses with unsafe personalization

#### 7.5 Engineering Metrics

| Area | Metrics |
|------|---------|
| **Routing** | Intent accuracy, agent-selection accuracy, false-routing rate |
| **Tone Alignment** | AI recommendation acceptance rate (how often sales rep sends top AI pick without switching tabs), tone distribution by VIP tier, multi-factor scoring formula weight calibration accuracy |
| **Reliability** | API failure rate, retry success rate, duplicate-message rate |
| **Performance** | p50/p95 response latency, throughput |
| **Correctness** | Tool-call accuracy, order-status accuracy |
| **Safety** | Unsupported-fact rate, policy-violation rate, PII exposure rate |
| **Personalization** | PSQS, coverage, consistency, groundedness |
| **Human control** | Override rate, approval time, edit distance per draft, escalation accuracy |

#### 7.6 Evaluation Dashboard

- Visual summary of all metrics across the three arms
- Per-agent breakdown
- Per-intent breakdown
- Per-VIP-tier breakdown
- Exportable tables and charts for thesis

#### 7.7 Deliverables Checklist

- [ ] Automated grounding checks implemented
- [ ] PSQS scoring engine (automated + human annotation interface)
- [ ] Three-arm test harness: run conversations through A/B/C
- [ ] Test set: 100–300 labeled conversations
- [ ] Statistical comparison across arms
- [ ] Human annotation collected (2–3 evaluators, 50–100 responses)
- [ ] Engineering metrics dashboard
- [ ] Evaluation results exported for thesis

---

## Timeline Estimate

| Phase | Duration | Cumulative | Milestone |
|-------|:--------:|:----------:|-----------|
| Phase 1 | 2–3 weeks | Week 3 | "Here's the RAG generating grounded responses" — demoable to advisor |
| Phase 2 | 2 weeks | Week 5 | "Here's WHY each customer is VIP" — explainable scoring |
| Phase 3 | 2–3 weeks | Week 8 | "The system routes intelligently" — full working prototype |
| Phase 4 | 2–3 weeks | Week 11 | "It works with real Lazada data" — engineering quality proof |
| Phase 5 | 2–3 weeks | Week 14 | "Here are the measured results" — thesis defense ready |

**Total: ~12–14 weeks** (3–3.5 months)

---

## Technology Stack (Recommended)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend API | Node.js / Express or Python / FastAPI | Matches existing project stack |
| Database | PostgreSQL | Relational data with good JSON support |
| Message Queue | Redis / BullMQ or RabbitMQ | For async ingestion + dead-letter queue |
| LLM | OpenAI API or open-source (Llama, Mistral) | For response generation + intent classification |
| XAI | SHAP + scikit-learn / XGBoost | For explainable VIP scoring |
| Frontend | React | Matches existing project |
| Testing | Jest / Pytest | Unit + integration tests |

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lazada API access delayed | Phase 4 blocked | Phases 1–3 work entirely on seed data |
| Not enough repeat buyers in real data | Weak VIP segmentation | Supplement with UCI/Instacart distributions |
| LLM hallucination in responses | Unsafe personalization | Grounding validator catches unsupported claims |
| Lazada IM permission denied | No chat integration | System still works as order-context-based advisor |
| Statistical power for 3-arm experiment | Inconclusive results | Use synthetic conversations (N ≥ 60 per arm) |
| Lazada buyer_id changes | RFM model breaks | Fallback to session-level analysis; buyer_id is confirmed stable as of Aug 2026 |

---

## References

### Datasets
- UCI Online Retail II — RFM and transaction behavior calibration
- Instacart — repeated-order and temporal behavior
- JDDC / E-IntentConv — e-commerce support intents and dialogue
- MultiWOZ — dialogue-state baseline
- RouterBench / AWS routing benchmark — routing evaluation methodology

### Platform APIs
- Lazada Open Platform: open.lazada.com
- Lazada IM Open API: /im/session/list, /im/message/list, /im/message/send
- Shopee Open Platform: open.shopee.com (future extension)
- TikTok Shop Partner API (future extension)

### Research Docs
- ideas/vip_customer/vip_customer_routing_thesis_notes.md
- ideas/vip_customer/vip_customer_features_availability.md
- ideas/vip_customer/vip_customer_on_single_platform.md
