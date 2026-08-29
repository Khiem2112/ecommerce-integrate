import type { FullCustomerContext, RetentionStrategy } from '@/types';
import { getPoliciesByIntent, type PolicyRule } from './policyUtils';

export const MULTI_DRAFT_RESPONSE_JSON_FORMAT = `{
  "recommendedStrategyId": "strat_goodwill",
  "recommendationReason": "Brief agent-facing comparative rationale for why this strategy is recommended for this customer turn.",
  "recommendationGroundedFactsUsed": ["order:status", "customer:tier"],
  "strategies": [
    {
      "id": "strat_goodwill",
      "rank": 1,
      "draftText": "Polite, personalized response message directly to the customer in natural Vietnamese...",
      "groundedFactsUsed": ["order:status", "evidence:77"],
      "ungroundedClaims": [],
      "confidence": 0.92,
      "suggestedAction": "await_approval",
      "proposedCompensation": {
        "kind": "none"
      }
    },
    {
      "id": "strat_concise",
      "rank": 2,
      "draftText": "Concise, direct operational update to the customer...",
      "groundedFactsUsed": ["order:status"],
      "ungroundedClaims": [],
      "confidence": 0.90,
      "suggestedAction": "await_approval",
      "proposedCompensation": {
        "kind": "none"
      }
    }
  ]
}`;

/** Alias for backward compatibility */
export const RESPONSE_JSON_FORMAT = MULTI_DRAFT_RESPONSE_JSON_FORMAT;

/**
 * Format database-owned strategy definitions for LLM provider system instructions.
 */
export function formatRetentionStrategyCatalogForPrompt(
  strategies: readonly RetentionStrategy[],
): string {
  return strategies
    .map(
      (strategy) =>
        `- ${strategy.code}: ${strategy.name}. Tone: ${strategy.tone}. Focus: ${strategy.retentionFocus}. Guidance: ${strategy.selectionGuidance}`,
    )
    .join('\n');
}

/**
 * Format linked order details for prompt injection.
 */
export function formatLinkedOrder(context: FullCustomerContext): string {
  const { linkedOrder } = context.turn;
  if (!linkedOrder) return '## LINKED ORDER\nNo specific order linked to this conversation.';

  const items = linkedOrder.items
    .map(
      (item) =>
        `  - ${item.productName} (qty: ${item.quantity}, ${item.unitPrice.toLocaleString()} VND${item.category ? `, category: ${item.category.name}` : ''
        })`,
    )
    .join('\n');

  const statusHistory = linkedOrder.statusHistory
    .map(
      (h) =>
        `  - ${h.status.name} at ${h.changedAt.toISOString().split('T')[0]}${h.note ? ` (${h.note})` : ''
        }`,
    )
    .join('\n');

  return `## LINKED ORDER
- **Order ID:** ${linkedOrder.platformOrderId}
- **Current Status:** ${linkedOrder.currentStatus.name} (${linkedOrder.currentStatus.code})
- **Total Value:** ${linkedOrder.totalValue.toLocaleString()} VND
- **Discount:** ${linkedOrder.discountAmount.toLocaleString()} VND
- **Shipping Fee:** ${linkedOrder.shippingFee.toLocaleString()} VND
- **Created:** ${linkedOrder.createdAt.toISOString().split('T')[0]}
${linkedOrder.paidAt ? `- **Paid:** ${linkedOrder.paidAt.toISOString().split('T')[0]}` : ''}
${linkedOrder.cancelledAt ? `- **Cancelled:** ${linkedOrder.cancelledAt.toISOString().split('T')[0]}` : ''}
${linkedOrder.cancellationReason ? `- **Cancel Reason:** ${linkedOrder.cancellationReason}` : ''}

### Order Items
${items}

### Status History
${statusHistory}`;
}

/**
 * Format conversation context (intent, message count, recent turns) for prompt injection.
 */
export function formatConversationContext(context: FullCustomerContext): string {
  const { recentMessages, detectedIntent, messageCount } = context.turn;

  const intent = detectedIntent
    ? `**Detected Intent:** ${detectedIntent.name} (${detectedIntent.code})`
    : '**Detected Intent:** Unknown';

  const messages = recentMessages
    .map((msg) => {
      const sender = msg.senderType.isHuman
        ? msg.senderType.code === 'buyer'
          ? '🧑 Customer'
          : '👤 Seller'
        : `🤖 ${msg.senderType.name}`;
      return `  [${msg.timestamp.toISOString().split('T')[1]?.slice(0, 5)}] ${sender}: ${msg.text ?? `[${msg.messageType}]`
        }`;
    })
    .join('\n');

  return `## CONVERSATION CONTEXT
- ${intent}
- **Message Count:** ${messageCount}

### Recent Messages (most recent ${recentMessages.length})
${messages}`;
}

/**
 * Format store policies for prompt injection.
 */
export function formatPolicies(policies: readonly PolicyRule[]): string {
  if (policies.length === 0) return '## STORE POLICIES\nNo specific policies apply to this query type.';

  const formatted = policies.map((p) => `  - [${p.code}] ${p.rule}`).join('\n');

  return `## STORE POLICIES (you MUST follow these)
${formatted}`;
}

/**
 * Generate VIP handling instructions based on customer tier.
 */
export function getVipInstructions(tierCode: string): string {
  switch (tierCode?.toLowerCase()) {
    case 'platinum':
      return `- Address as a valued priority customer with personalized greeting
- Offer proactive compensation for severe service issues (courier delays > 3 days)
- Prioritize 1-click resolution — minimize customer effort
- Maximum voucher compensation: 50,000 VND`;
    case 'gold':
      return `- Acknowledge their loyalty and repeat patronage
- Offer priority courier escalations for shipping issues
- Maximum voucher compensation: 25,000 VND`;
    case 'silver':
      return `- Be helpful, polite, and aim for fast resolution
- Standard compensation tiers apply
- Maximum voucher compensation: 10,000 VND`;
    case 'standard':
    default:
      return `- Provide clear, professional assistance
- Use standard FAQ answers where appropriate
- Standard policies apply — 0 VND voucher compensation`;
  }
}

/**
 * Extract allowed fact citations directly from customer context and active policies.
 * Pure formatting without external state or services.
 */
export function buildAllowedFactCitations(
  context: FullCustomerContext,
  policies: readonly PolicyRule[],
): string {
  const { turn, dossier, evidence } = context;
  const facts: Array<{ id: string; label: string; confidence: number }> = [];

  if (turn.detectedIntent) {
    facts.push({ id: 'conversation:intent', label: 'Detected Intent', confidence: 1.0 });
  }
  facts.push({ id: 'conversation:priority', label: 'Conversation Priority', confidence: 1.0 });
  facts.push({ id: 'conversation:message_count', label: 'Message Count', confidence: 1.0 });

  if (turn.linkedOrder) {
    facts.push({ id: 'order:id', label: 'Order ID', confidence: 1.0 });
    facts.push({ id: 'order:status', label: 'Current Order Status', confidence: 1.0 });
    facts.push({ id: 'order:total_value', label: 'Order Total Value', confidence: 1.0 });
    facts.push({ id: 'order:discount', label: 'Order Discount Amount', confidence: 1.0 });
    facts.push({ id: 'order:shipping_fee', label: 'Shipping Fee', confidence: 1.0 });
    if (turn.linkedOrder.items.length > 0) {
      facts.push({ id: 'order:items', label: 'Order Items', confidence: 1.0 });
    }
    facts.push({ id: 'order:created_at', label: 'Order Creation Date', confidence: 1.0 });
    if (turn.linkedOrder.paidAt) {
      facts.push({ id: 'order:paid_at', label: 'Order Payment Date', confidence: 1.0 });
    }
    if (turn.linkedOrder.cancelledAt) {
      facts.push({ id: 'order:cancelled_at', label: 'Order Cancellation Date', confidence: 1.0 });
    }
    if (turn.linkedOrder.cancellationReason) {
      facts.push({ id: 'order:cancel_reason', label: 'Order Cancellation Reason', confidence: 1.0 });
    }
    if (turn.linkedOrder.statusHistory.length > 0) {
      facts.push({ id: 'order:status_history', label: 'Order Status History', confidence: 1.0 });
    }
  }

  facts.push({ id: 'customer:tier', label: 'VIP Customer Tier', confidence: 1.0 });
  facts.push({ id: 'customer:score', label: 'VIP Engagement Score', confidence: 1.0 });
  facts.push({ id: 'customer:spend', label: 'Customer Lifetime Spend', confidence: 1.0 });
  facts.push({ id: 'customer:order_count', label: 'Lifetime Order Count', confidence: 1.0 });
  facts.push({ id: 'customer:avg_order_value', label: 'Average Order Value', confidence: 1.0 });
  if (dossier.customer.daysSinceLastOrder != null) {
    facts.push({ id: 'customer:days_since_last_order', label: 'Days Since Last Order', confidence: 1.0 });
  }
  facts.push({ id: 'customer:cancellation_rate', label: 'Customer Cancellation Rate', confidence: 1.0 });
  facts.push({ id: 'customer:refund_rate', label: 'Customer Refund Rate', confidence: 1.0 });
  facts.push({ id: 'customer:voucher_sensitivity', label: 'Customer Voucher Sensitivity', confidence: 1.0 });
  if (dossier.customer.preferredLanguage) {
    facts.push({ id: 'customer:preferred_language', label: 'Preferred Language', confidence: 1.0 });
  }
  facts.push({ id: 'customer:total_conversations', label: 'Total Service Inquiries', confidence: 1.0 });
  facts.push({ id: 'customer:unresolved_conversations', label: 'Unresolved Inquiries', confidence: 1.0 });
  if (dossier.pastIntents.length > 0) {
    facts.push({ id: 'customer:past_intents', label: 'Past Inquired Intents', confidence: 1.0 });
  }

  for (const fact of evidence.facts) {
    facts.push({
      id: `evidence:${fact.id}`,
      label: `Customer Evidence #${fact.id}`,
      confidence: fact.confidence,
    });
  }

  for (const policy of policies) {
    facts.push({
      id: `policy:${policy.code}`,
      label: `Store Policy [${policy.code}]`,
      confidence: 1.0,
    });
  }

  if (facts.length === 0) {
    return '## ALLOWED FACT CITATIONS\nNo specific context fact citations available.';
  }

  const lines = facts.map((f) => `  - [${f.id}] ${f.label} (conf: ${f.confidence.toFixed(2)})`);

  return `## ALLOWED FACT CITATIONS (cite these EXACT IDs in groundedFactsUsed & recommendationGroundedFactsUsed)
${lines.join('\n')}`;
}

/**
 * Build a lightweight system prompt for simple inquiries (greetings, general FAQs, product info).
 * Strips heavy dossier metrics and evidence layers, generating exactly 1 fast, polite response draft.
 */
export function buildLiteSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
  customFactsSection?: string,
): string {
  const primaryStrategy = strategies[0] ?? {
    code: 'strat_goodwill',
    name: 'Goodwill Assurance',
    tone: 'Empathetic and warm',
    retentionFocus: 'Relationship building and courtesy',
  };

  const intentCode = context.turn.detectedIntent?.code ?? 'general';
  const policies = getPoliciesByIntent(intentCode);
  const formattedFacts = customFactsSection ?? buildAllowedFactCitations(context, policies);

  return `You are a helpful and polite e-commerce customer support co-pilot for a Lazada seller store in Vietnam.
Generate a concise, professional, and friendly response to assist the customer.

## SELECTED STRATEGY
- **Code:** ${primaryStrategy.code}
- **Name:** ${primaryStrategy.name}
- **Tone:** ${primaryStrategy.tone}

## CRITICAL INSTRUCTIONS
1. Generate exactly 1 response draft under "strategies" array with rank 1.
2. "recommendedStrategyId" MUST be "${primaryStrategy.code}".
3. Use natural, polite Vietnamese (e.g. "Dạ shop chào bạn", "Cảm ơn bạn đã nhắn tin cho shop").
4. Never invent fake order data or tracking status.
5. STRICT PROHIBITION ON INTERNAL JARGON: Never mention internal tier names (Platinum, Gold, Silver), VIP scores, strategy codes, or citation tags in customer-facing text.
6. "proposedCompensation" must be {"kind": "none"}.

${formatLinkedOrder(context)}

${formatConversationContext(context)}

${formattedFacts}

## OUTPUT RESPONSE FORMAT
Return ONLY valid JSON matching this schema:
{
  "recommendedStrategyId": "${primaryStrategy.code}",
  "recommendationReason": "Direct and helpful assistance for general customer inquiry.",
  "recommendationGroundedFactsUsed": [],
  "strategies": [
    {
      "id": "${primaryStrategy.code}",
      "rank": 1,
      "draftText": "Dạ shop chào bạn! Shop có thể hỗ trợ gì cho mình về sản phẩm/đơn hàng ạ?",
      "groundedFactsUsed": [],
      "ungroundedClaims": [],
      "confidence": 0.95,
      "suggestedAction": "auto_reply",
      "proposedCompensation": { "kind": "none" }
    }
  ]
}`;
}

/**
 * Build a standard system prompt for operational inquiries (shipping status, vouchers, order edits).
 * Injects order context and relevant store policies, producing 1 to 2 focused drafts.
 */
export function buildStandardSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
  customFactsSection?: string,
): string {
  const { customer } = context.dossier;
  const intentCode = context.turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);

  const formattedFacts = customFactsSection ?? buildAllowedFactCitations(context, policies);
  const formattedStrategies = formatRetentionStrategyCatalogForPrompt(strategies);

  return `You are a professional e-commerce customer care co-pilot for a Lazada seller store in Vietnam.
Your role is to formulate 1 to 2 clear, operational response drafts for customer support agents.

## RETENTION STRATEGY CATALOG
${formattedStrategies}

## CRITICAL INSTRUCTIONS
1. Formulate 1 to 2 distinct drafts in "strategies" array with ranks starting at 1.
2. "recommendedStrategyId" MUST match the rank 1 strategy.
3. Every factual claim about orders or shipping MUST cite valid keys from ALLOWED FACT CITATIONS.
4. Voucher amounts must never exceed tier limits:
   * Platinum: max 50,000 VND | Gold: max 25,000 VND | Silver: max 10,000 VND | Standard: 0 VND.
5. STRICT PROHIBITION ON INTERNAL JARGON: No tier names (VIP, Silver...), scores, or citation tags in draftText.
6. Write in natural, polite Vietnamese.

${formatLinkedOrder(context)}

${formatConversationContext(context)}

${formattedFacts}

## VIP TIER COMPENSATION & HANDLING RULES
${getVipInstructions(customer.vipTier.code)}

## OUTPUT RESPONSE FORMAT
Return ONLY valid JSON matching this schema:
${MULTI_DRAFT_RESPONSE_JSON_FORMAT}`;
}

/**
 * Build the complete multi-draft system prompt with 3-layer context, strategy catalog,
 * allowed fact citations, and safety guardrails.
 */
export function buildSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
  customFactsSection?: string,
): string {
  const { turn, dossier } = context;
  const { customer } = dossier;
  const intentCode = turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);

  const formattedFacts = customFactsSection ?? buildAllowedFactCitations(context, policies);
  const formattedStrategies = formatRetentionStrategyCatalogForPrompt(strategies);

  return `You are a professional e-commerce customer care co-pilot for a Lazada seller store in Vietnam.
Your role is to formulate 2 to 3 materially distinct, grounded response draft strategies for human customer support agents to review, compare, and approve.

## RETENTION STRATEGY CATALOG
Select 2 to 3 distinct strategies from this catalog:
${formattedStrategies}

## CRITICAL MULTI-DRAFT INSTRUCTIONS
1. Strategy Selection & Diversity:
   - Choose exactly 2 or 3 distinct strategies from the RETENTION STRATEGY CATALOG.
   - Each draftText MUST genuinely embody the distinct tone, focus, and tactic of its selected strategy.
   - Normalised draftText across strategies must NOT be identical.
2. Ranking & Recommendation:
   - Assign contiguous ranks starting from 1 (1 and 2, or 1, 2, and 3).
   - "recommendedStrategyId" MUST be the strategy with rank 1.
   - "recommendationReason" must be concise and agent-facing, explaining why rank 1 is best suited for this situation. Cite supporting fact IDs in "recommendationGroundedFactsUsed".
3. Grounding & Anti-Hallucination:
   - Every factual claim in "draftText" MUST be backed by an exact key from the ALLOWED FACT CITATIONS and cited in "groundedFactsUsed".
   - If any claim cannot be verified from the provided context, list it in "ungroundedClaims".
   - Never fabricate order details, carrier names, or false tracking updates.
4. Compensation & Voucher Policy:
   - "proposedCompensation" must be either {"kind": "none"} OR {"kind": "voucher", "amountVnd": <integer>}.
   - If a voucher is mentioned in "draftText", the exact amount MUST match "proposedCompensation.amountVnd".
   - Voucher amounts must NEVER exceed the tier limit:
     * Platinum: max 50,000 VND
     * Gold: max 25,000 VND
     * Silver: max 10,000 VND
     * Standard: 0 VND (no voucher compensation allowed)
5. Action Routing ("suggestedAction"):
   - "auto_reply": High confidence (>= 0.90), all claims grounded, no disputes/vouchers.
   - "await_approval": Compensation vouchers, cancellations, returns, or special handling.
   - "escalate_to_human": Frustrated customer, severe complaints, or ungrounded claims.
6. STRICT PROHIBITION ON INTERNAL JARGON IN CUSTOMER-FACING DRAFT TEXT:
   - "draftText" is sent directly to the customer. It must NEVER include:
     * Internal tier names: "VIP", "Platinum", "Gold", "Silver", "Standard"
     * Internal scores/terms: "RFM", "vipScore", score numbers like "95/100"
     * Strategy IDs or code names: e.g. "strat_goodwill", "strat_whiteglove"
     * Evidence/Citation keys: e.g. "evidence:77", "[ID:77]", "order:status"
     * Buyer identifier numbers: e.g. "BYR-1001"
   - Instead, acknowledge customer loyalty using natural, respectful Vietnamese phrasing like "khách hàng thân thiết", "khách hàng ưu tiên", or sincere appreciation for their patronage.

---

## CUSTOMER PROFILE & METRICS (INTERNAL AGENT CONTEXT)
- **VIP Tier:** ${customer.vipTier.name} (${customer.vipTier.code}, priority: ${customer.vipTier.priority})
- **VIP Score:** ${customer.vipScore}/100
- **Total Spend:** ${customer.totalSpend.toLocaleString()} VND
- **Order Count:** ${customer.orderCount}
- **Avg Order Value:** ${customer.avgOrderValue.toLocaleString()} VND
- **Days Since Last Order:** ${customer.daysSinceLastOrder ?? 'N/A'}
- **Cancellation Rate:** ${(customer.cancellationRate * 100).toFixed(1)}%
- **Refund Rate:** ${(customer.refundRate * 100).toFixed(1)}%
- **Voucher Sensitivity:** ${(customer.voucherSensitivity * 100).toFixed(1)}%
${customer.preferredLanguage ? `- **Preferred Language:** ${customer.preferredLanguage}` : ''}

## SERVICE HISTORY
- **Total Inquiries:** ${dossier.totalConversationCount}
- **Unresolved Inquiries:** ${dossier.unresolvedConversationCount}
- **Past Intent Types:** ${dossier.pastIntents.length > 0 ? dossier.pastIntents.join(', ') : 'None'}

${formatLinkedOrder(context)}

${formatConversationContext(context)}

${formattedFacts}

## VIP TIER COMPENSATION & HANDLING RULES
${getVipInstructions(customer.vipTier.code)}

## OUTPUT RESPONSE FORMAT
Return ONLY valid JSON matching this schema (no markdown formatting, no code fences):
${MULTI_DRAFT_RESPONSE_JSON_FORMAT}`;
}

/**
 * Build the user prompt from the latest customer message.
 */
export function buildUserPrompt(latestMessageText: string): string {
  return `Customer message: "${latestMessageText}"

Generate grounded response draft(s) following the RETENTION STRATEGY CATALOG and ALLOWED FACT CITATIONS. Return ONLY valid JSON matching the schema.`;
}
