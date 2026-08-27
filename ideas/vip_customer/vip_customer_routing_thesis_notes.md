# VIP Customer Routing — Thesis Insight Summary

> Working direction: identify high-LTV buyers from anonymized, single-platform order data, and study whether AI-augmented human handling outperforms pure-human or pure-AI handling — simulated on Lazada.

---

## 1. Core Concept

A closed-loop system with a built-in experiment, not just a routing feature:

1. **Score & flag** — RFM/LTV engine flags a buyer as VIP using anonymized order history (works within Lazada's masked-identity constraint).
2. **Auto-generate briefing** — system pulls purchase history, cart value, and past interactions into a short AI-written customer dossier. This is the actual technical artifact, not the alert itself.
3. **Route to one of three arms:**
   - **(A)** Human rep, no extra context (baseline)
   - **(B)** Human rep + AI-generated briefing / per-message suggestions (co-pilot mode)
   - **(C)** Full AI agent handles the conversation autonomously (AI-mode toggle)
4. **Measure outcomes** — conversion rate, deal size, response time across the three arms.
5. **Feed back into scoring** — outcome data retrains the VIP/LTV threshold over time.

This three-arm design *is* the research question: **does AI-augmented human handling beat either pure-human or pure-AI handling for high-value customers?**

## 2. Opportunities

- **The real novelty isn't "AI chatbot" — it's personalization without CRM access.** Generic auto-reply bots are commodity (five+ direct competitors listed in the original matrix already do this). What's not commodity is building a useful customer dossier *without* the PII and CRM data that Western tools like Intercom/Zendesk assume they have. Shopify gives sellers that data by default; Lazada, Shopee, and TikTok Shop deliberately don't. Framing the contribution as "personalized decision support under data scarcity" is a genuinely SEA-marketplace-specific problem.
- **The three-arm design is a legitimate, well-regarded research area.** Human-AI collaboration / augmented decision-making is a live academic topic — this isn't just a product feature, it's a defensible experimental design with a clear dependent variable (conversion, deal size, response time).
- **A centralized unified inbox is real integration engineering.** Normalizing incoming messages from platform-specific chat APIs and pushing replies back out through the correct platform's send endpoint is a nontrivial system design problem, and reinforces the "unified across silos" premise of the original product.
- **Explainable co-pilot mode adds trust value.** Surfacing *why* the AI suggested a given message (which purchase-history signal drove it), rather than a black-box auto-reply, mirrors the explainability angle from the Friction Index direction and gives reps something they can evaluate rather than blindly follow.

## 3. Challenges

- **Ecommerce platform data masking is a hard constraint, not a solvable one.** Lazada/Shopee/TikTok Shop mask real buyer identity by design. Cross-platform identity linking (the same person across Shopee and Lazada) is **not feasible through official APIs**, and attempting to work around that would be a real ToS/ethics problem, not just an engineering one. This should be explicitly scoped out, not framed as a stretch feature.
- **Chat API access isn't automatic on every platform.** Shopee's messaging endpoints require a separate OAuth permission scope that isn't granted by default — request it early if Shopee is touched at all, so it isn't a late-stage blocker. Lazada has a more straightforward dedicated IM Open API.
- **Multi-platform integration effort doesn't pay for itself here.** Since identity can't be linked across platforms anyway, wiring up all three chat APIs adds engineering cost without a matching research payoff. Scoping to Lazada only (as decided) is the right call — the interesting comparison is *not* Lazada vs. Shopee vs. TikTok, it's masked-identity (Lazada) vs. full-PII (Shopify) personalization quality, which is a smaller, cleaner comparison if you want it at all.
- **Official in-platform "extension" status is a business process, not a build requirement.** Getting listed in Lazada's Service Marketplace or Shopee's App Center involves app review — don't depend on it. A standalone dashboard talking to the registered developer app's API is sufficient to prove the concept.
- **Statistical power for the three-arm experiment is the main risk.** You need enough real or simulated VIP conversations spread across three arms to say anything meaningful about conversion differences — this is a bigger risk to the thesis than any of the engineering pieces.
- **Feature engineering for VIP/LTV scoring from anonymized data only.** Without PII, the LTV/RFM score has to be built entirely from repeated `buyer_id` order aggregation — recency decay, frequency thresholds, and monetary weighting all need to be defined and justified rather than borrowed from PII-rich D2C literature.

## 4. Open Research Questions

- Does AI-augmented human handling (arm B) outperform pure-human (arm A) or pure-AI (arm C) handling, on conversion rate and deal size, for high-value customers?
- How much does personalization quality degrade when identity is masked (Lazada) vs. fully available (Shopify)?
- Does surfacing the AI's reasoning per suggestion (explainable co-pilot) change how often reps follow or override it, compared to an opaque suggestion?

## 5. Platform Feasibility Notes

- **Lazada:** IM Open API supports the chat layer; Order API allows LTV/RFM to be computed from aggregated `buyer_id` history. Sufficient for the full three-arm simulation as scoped.
- **Shopee:** Chat API exists but access is gated behind a separate permission request — not needed for the current Lazada-only scope, but relevant if the design is ever extended.
- **Shopify:** Not required for the core experiment, but useful as a contrast point in the discussion/limitations section (full-PII personalization vs. masked-identity personalization).

## 6. Recommended MVP Scope

1. VIP/LTV scoring engine on Lazada order data only (anonymized `buyer_id`).
2. AI-generated customer briefing (the core technical artifact).
3. Unified dashboard simulating the three-arm routing (A/B/C), built against your own Lazada dev-account API access — no need to wait on official app-store listing.
4. Outcome measurement across the three arms as the primary evaluation.
5. Explicitly exclude cross-platform identity matching from scope, with a short note in limitations on why (platform masking makes it infeasible via official channels).

---
*References checked during this discussion: Lazada Open Platform / IM Open API docs (open.lazada.com), Shopee Open Platform Chat API guides.*
