# VIP Customer Care & Intelligent Routing — Business Logic

> **Parent System:** OmniCart Recover  
> **Sub-System:** VIP Customer Care & Copilot Decision Support  
> **Scope:** RFM Tiers, 3-Layer Memory Context, Anti-Hallucination Grounding, Specialized Agent Routing, and 3-Arm Experimentation.

---

## 1. VIP Customer Tiers & RFM Segmentation

Customers are categorized into 4 tiers based on RFM (Recency, Frequency, Monetary) scores and dispute history:

| Tier | Icon | Profile & Criteria | Service SLA & Treatment |
| :--- | :---: | :--- | :--- |
| **Platinum** | 💎 | Top 2% VIP (Score ≥ 90). Frequent high-spend repeat buyers with 0 dispute record. | **Immediate priority**. Personalized VIP greetings, proactive compensation for courier delays, 1-click replacement. |
| **Gold** | 🥇 | Top 10% VIP (Score 70–89). Loyal repeat buyers (3–8 orders). | **High priority**. Acknowledges loyalty, priority courier escalations, free shipping perks. |
| **Silver** | 🥈 | Repeat buyers (Score 40–69). 2–4 orders with moderate spend. | **Standard-High**. Helpful, polite, fast resolution. |
| **Standard** | 👤 | One-time or new buyers (Score 0–39). | **Standard**. Clear, professional assistance and automated answers for standard FAQs. |

---

## 2. The 3-Layer Memory Context Model (RAG)

Every customer inquiry assembles structured context across 3 distinct memory layers:

### Layer 1: Operational & Turn Context
- Active conversation messages (last 5–10 turns).
- Linked `Order` details: status (`unpaid`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`), carrier tracking, item list, total value, shipping fee.

### Layer 2: Customer Behavioral Dossier
- Customer metrics: `vipTier`, `vipScore`, `totalSpend`, `orderCount`, `avgOrderValue`, `cancellationRate`, `refundRate`.
- Past unresolved cases or repeated questions.

### Layer 3: Evidence-Backed Facts
- Traceable facts stored in `CustomerEvidence` with confidence levels (0.0–1.0):
  - e.g. *"Prefers free shipping (confidence: 0.95)"*
  - e.g. *"Frequently purchases tech accessories (confidence: 0.94)"*
  - e.g. *"Zero dispute history (confidence: 0.98)"*

---

## 3. Grounding & Anti-Hallucination Guardrails

- **Mandatory Fact Citation**: When the LLM generates a response citing customer context (order status, tracking timeline, tier status), it must return the fact ID in `groundedFacts`.
- **Zero Tolerance for Hallucinations**:
  - Never fabricate fake tracking numbers or claim an order has shipped when status is `processing`.
  - Never promise custom discounts or voucher amounts exceeding store policy (max 50,000 VND for severe delays).
- **Suggested Action Decision**:
  - `auto_reply`: High confidence (≥ 0.90), all claims grounded, low-risk query (product info, standard delivery ETA).
  - `await_approval`: Medium/High confidence, involves refunds, cancellations, or voucher issuance.
  - `escalate_to_human`: Frustrated VIP, angry complaint, ungrounded claims, or high-value dispute.

---

## 4. Specialized Agents & Intent Routing

Incoming inquiries are classified and routed to one of 4 specialized agents:

1. **Logistics Agent (`agent_logistics`)**:
   - Delivery status, tracking, courier delays, shipping fee explanations.
2. **Refund Agent (`agent_refund`)**:
   - Return requests, 15-day policy checks, return pickup instructions, refund authorizations.
3. **Product Info Agent (`agent_product`)**:
   - Technical specifications, variant availability, cross-selling, and usage advice.
4. **Escalation Agent (`agent_escalation`)**:
   - Complaints, repeated unaddressed issues, and high-tier VIP care.

---

## 5. Three-Arm Experiment Setup (Thesis Evaluation)

- **Arm A (Human Only)**: Human rep answers without AI co-pilot context.
- **Arm B (Co-Pilot)**: Human rep reviews AI-generated briefing, grounded response draft, and can Approve/Edit/Reject.
- **Arm C (Autonomous AI)**: AI agent handles conversation directly with safety fallback gates.
