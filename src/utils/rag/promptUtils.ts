import type { FullCustomerContext, PromptBuildOptions, RetentionStrategy } from '@/types';
import { formatCompactPolicies, getPoliciesByIntent, type PolicyRule } from './policyUtils';

const SIMPLE_MAX_RECENT_MESSAGES = 4;
const SIMPLE_MESSAGE_PREVIEW_CHARS = 160;
const SIMPLE_MAX_EVIDENCE_FACTS = 3;
const SIMPLE_MIN_EVIDENCE_CONFIDENCE = 0.85;

const STANDARD_MAX_RECENT_MESSAGES = 6;
const STANDARD_MESSAGE_PREVIEW_CHARS = 240;
const STANDARD_MAX_EVIDENCE_FACTS = 5;

export type { PromptBuildOptions };

export const SINGLE_DRAFT_RESPONSE_JSON_FORMAT =
  '{"recommendedStrategyId":"strat_goodwill","recommendationReason":"<=20 words","recommendationGroundedFactsUsed":["order:status"],"strategies":[{"id":"strat_goodwill","rank":1,"draftText":"<=3 sentences polite Vietnamese","groundedFactsUsed":["order:status"],"ungroundedClaims":[],"confidence":0.95,"suggestedAction":"auto_reply","proposedCompensation":{"kind":"none"}}]}';

export const MULTI_DRAFT_RESPONSE_JSON_FORMAT =
  '{"recommendedStrategyId":"strat_goodwill","recommendationReason":"Brief agent rationale","recommendationGroundedFactsUsed":["order:status","customer:tier"],"strategies":[{"id":"strat_goodwill","rank":1,"draftText":"Polite Vietnamese reply","groundedFactsUsed":["order:status"],"ungroundedClaims":[],"confidence":0.92,"suggestedAction":"await_approval","proposedCompensation":{"kind":"none"}},{"id":"strat_concise","rank":2,"draftText":"Concise Vietnamese reply","groundedFactsUsed":["order:status"],"ungroundedClaims":[],"confidence":0.9,"suggestedAction":"await_approval","proposedCompensation":{"kind":"none"}}]}';

/** Alias for backward compatibility */
export const RESPONSE_JSON_FORMAT = MULTI_DRAFT_RESPONSE_JSON_FORMAT;

function truncatePreview(text: string, maxChars?: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!maxChars || normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

function getSortedEvidenceFacts(
  context: FullCustomerContext,
  minConfidence: number,
  limit: number,
): FullCustomerContext['evidence']['facts'] {
  return [...context.evidence.facts]
    .filter((fact) => fact.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence || a.id - b.id)
    .slice(0, limit);
}

/**
 * Format database-owned strategy definitions as dense single-line entries.
 * Sorted deterministically by code to preserve LLM prefix-cache identity.
 */
export function formatRetentionStrategyCatalogForPrompt(
  strategies: readonly RetentionStrategy[],
): string {
  return [...strategies]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(
      (strategy) =>
        `- ${strategy.code} | ${strategy.strategyType} | ${strategy.tone} | ${strategy.selectionGuidance}`,
    )
    .join('\n');
}

/**
 * Format minimal linked order summary for simple-tier prompts.
 */
function formatMinimalLinkedOrder(context: FullCustomerContext): string {
  const { linkedOrder } = context.turn;
  if (!linkedOrder) return '## LINKED ORDER\nNone.';

  const primaryItem = linkedOrder.items[0];
  const primaryItemSummary = primaryItem
    ? `${primaryItem.productName}${primaryItem.sku ? ` (SKU: ${primaryItem.sku})` : ''}`
    : 'N/A';

  return `## LINKED ORDER
order:id: ${linkedOrder.platformOrderId} | order:status: ${linkedOrder.currentStatus.name} (${linkedOrder.currentStatus.code}) | order:total_value: ${linkedOrder.totalValue.toLocaleString()} VND | primary_item: ${primaryItemSummary}`;
}

/**
 * Format compact single-line linked order pairs for standard-tier prompts.
 */
function formatCompactLinkedOrder(context: FullCustomerContext): string {
  const { linkedOrder } = context.turn;
  if (!linkedOrder) return '## LINKED ORDER\nNone.';

  const items = linkedOrder.items
    .map((item) => `${item.productName}${item.sku ? ` (${item.sku})` : ''} x${item.quantity}`)
    .join('; ');

  const latestStatus = linkedOrder.statusHistory[linkedOrder.statusHistory.length - 1];
  const historySummary = latestStatus
    ? `${latestStatus.status.name} (${latestStatus.changedAt.toISOString().split('T')[0]})`
    : 'N/A';

  return `## LINKED ORDER
order:id: ${linkedOrder.platformOrderId} | order:status: ${linkedOrder.currentStatus.name} (${linkedOrder.currentStatus.code}) | order:total_value: ${linkedOrder.totalValue.toLocaleString()} VND | discount: ${linkedOrder.discountAmount.toLocaleString()} VND | shipping: ${linkedOrder.shippingFee.toLocaleString()} VND | created: ${linkedOrder.createdAt.toISOString().split('T')[0]}
items: ${items || 'N/A'} | latest_history: ${historySummary}`;
}

/**
 * Format linked order details for complex-tier prompt injection.
 */
export function formatLinkedOrder(context: FullCustomerContext): string {
  const { linkedOrder } = context.turn;
  if (!linkedOrder) return '## LINKED ORDER\nNone.';

  const items = linkedOrder.items
    .map(
      (item) =>
        `  - ${item.productName} (qty: ${item.quantity}, ${item.unitPrice.toLocaleString()} VND${
          item.category ? `, category: ${item.category.name}` : ''
        })`,
    )
    .join('\n');

  const statusHistory = linkedOrder.statusHistory
    .map(
      (h) =>
        `  - ${h.status.name} at ${h.changedAt.toISOString().split('T')[0]}${h.note ? ` (${h.note})` : ''}`,
    )
    .join('\n');

  return `## LINKED ORDER
order:id: ${linkedOrder.platformOrderId} | order:status: ${linkedOrder.currentStatus.name} (${linkedOrder.currentStatus.code}) | total: ${linkedOrder.totalValue.toLocaleString()} VND | discount: ${linkedOrder.discountAmount.toLocaleString()} VND | shipping: ${linkedOrder.shippingFee.toLocaleString()} VND | created: ${linkedOrder.createdAt.toISOString().split('T')[0]}${linkedOrder.paidAt ? ` | paid: ${linkedOrder.paidAt.toISOString().split('T')[0]}` : ''}${linkedOrder.cancelledAt ? ` | cancelled: ${linkedOrder.cancelledAt.toISOString().split('T')[0]}` : ''}${linkedOrder.cancellationReason ? ` | cancel_reason: ${linkedOrder.cancellationReason}` : ''}
Items:
${items || '  - None'}
History:
${statusHistory || '  - None'}`;
}

/**
 * Format conversation context (intent, message count, recent turns) for prompt injection.
 */
export function formatConversationContext(
  context: FullCustomerContext,
  maxMessages?: number,
  maxMessageLength?: number,
): string {
  const { recentMessages, detectedIntent, messageCount } = context.turn;
  const slicedMessages =
    maxMessages !== undefined ? recentMessages.slice(-maxMessages) : recentMessages;

  const intent = detectedIntent
    ? `intent: ${detectedIntent.name} (${detectedIntent.code})`
    : 'intent: unknown';

  const messages = slicedMessages
    .map((msg) => {
      const sender = msg.senderType.isHuman
        ? msg.senderType.code === 'buyer'
          ? 'Customer'
          : 'Seller'
        : msg.senderType.name;
      const body = truncatePreview(msg.text ?? `[${msg.messageType}]`, maxMessageLength);
      return `  [${msg.timestamp.toISOString().split('T')[1]?.slice(0, 5)}] ${sender}: ${body}`;
    })
    .join('\n');

  return `## CONVERSATION CONTEXT
${intent} | message_count: ${messageCount} | shown: ${slicedMessages.length}
${messages}`;
}

/**
 * Format store policies for prompt injection.
 */
export function formatPolicies(policies: readonly PolicyRule[]): string {
  if (policies.length === 0) return '## STORE POLICIES\nNone.';
  return `## STORE POLICIES\n${formatCompactPolicies(policies)}`;
}

/**
 * Generate VIP handling instructions based on customer tier.
 */
export function getVipInstructions(tierCode: string): string {
  switch (tierCode?.toLowerCase()) {
    case 'platinum':
      return `- Valued priority customer: personalized greeting, proactive compensation for delays > 3 days, 1-click resolution, max voucher: 50,000 VND`;
    case 'gold':
      return `- Acknowledge loyalty, priority courier escalation for shipping issues, max voucher: 25,000 VND`;
    case 'silver':
      return `- Helpful, polite, fast resolution, max voucher: 10,000 VND`;
    case 'standard':
    default:
      return `- Clear professional assistance, standard FAQ answers, max voucher: 0 VND`;
  }
}

type CitationEntry = {
  readonly id: string;
  readonly label: string;
  readonly confidence: number;
};

function formatCitationLines(facts: readonly CitationEntry[]): string {
  if (facts.length === 0) {
    return '## ALLOWED FACT CITATIONS\nNone.';
  }
  const lines = facts.map((f) => `- [${f.id}] ${f.label} (${f.confidence.toFixed(2)})`);
  return `## ALLOWED FACT CITATIONS\n${lines.join('\n')}`;
}

function buildLiteAllowedFactCitations(
  context: FullCustomerContext,
  policies: readonly PolicyRule[],
): string {
  const { turn } = context;
  const facts: CitationEntry[] = [];

  if (turn.detectedIntent) {
    facts.push({ id: 'conversation:intent', label: 'Detected Intent', confidence: 1.0 });
  }
  if (turn.linkedOrder) {
    facts.push({ id: 'order:id', label: 'Order ID', confidence: 1.0 });
    facts.push({ id: 'order:status', label: 'Current Order Status', confidence: 1.0 });
    facts.push({ id: 'order:total_value', label: 'Order Total Value', confidence: 1.0 });
    if (turn.linkedOrder.items.length > 0) {
      facts.push({ id: 'order:items', label: 'Order Items', confidence: 1.0 });
    }
  }

  facts.push({ id: 'customer:tier', label: 'Customer Tier', confidence: 1.0 });

  for (const fact of getSortedEvidenceFacts(
    context,
    SIMPLE_MIN_EVIDENCE_CONFIDENCE,
    SIMPLE_MAX_EVIDENCE_FACTS,
  )) {
    facts.push({
      id: `evidence:${fact.id}`,
      label: fact.fact,
      confidence: fact.confidence,
    });
  }

  for (const policy of policies) {
    facts.push({
      id: `policy:${policy.code}`,
      label: `Policy ${policy.code}`,
      confidence: 1.0,
    });
  }

  return formatCitationLines(facts);
}

function buildStandardAllowedFactCitations(
  context: FullCustomerContext,
  policies: readonly PolicyRule[],
): string {
  const { turn } = context;
  const facts: CitationEntry[] = [];

  if (turn.detectedIntent) {
    facts.push({ id: 'conversation:intent', label: 'Detected Intent', confidence: 1.0 });
  }
  facts.push({ id: 'conversation:priority', label: 'Priority', confidence: 1.0 });
  facts.push({ id: 'conversation:message_count', label: 'Message Count', confidence: 1.0 });

  if (turn.linkedOrder) {
    facts.push({ id: 'order:id', label: 'Order ID', confidence: 1.0 });
    facts.push({ id: 'order:status', label: 'Order Status', confidence: 1.0 });
    facts.push({ id: 'order:total_value', label: 'Order Total', confidence: 1.0 });
    facts.push({ id: 'order:discount', label: 'Discount', confidence: 1.0 });
    facts.push({ id: 'order:shipping_fee', label: 'Shipping Fee', confidence: 1.0 });
    if (turn.linkedOrder.items.length > 0) {
      facts.push({ id: 'order:items', label: 'Order Items', confidence: 1.0 });
    }
    facts.push({ id: 'order:created_at', label: 'Created Date', confidence: 1.0 });
    if (turn.linkedOrder.statusHistory.length > 0) {
      facts.push({ id: 'order:status_history', label: 'Status History', confidence: 1.0 });
    }
  }

  facts.push({ id: 'customer:tier', label: 'Customer Tier', confidence: 1.0 });
  facts.push({ id: 'customer:spend', label: 'Lifetime Spend', confidence: 1.0 });
  facts.push({ id: 'customer:order_count', label: 'Order Count', confidence: 1.0 });

  for (const fact of getSortedEvidenceFacts(context, 0.0, STANDARD_MAX_EVIDENCE_FACTS)) {
    facts.push({
      id: `evidence:${fact.id}`,
      label: fact.fact,
      confidence: fact.confidence,
    });
  }

  for (const policy of policies) {
    facts.push({
      id: `policy:${policy.code}`,
      label: `Policy ${policy.code}`,
      confidence: 1.0,
    });
  }

  return formatCitationLines(facts);
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
  const facts: CitationEntry[] = [];

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
      label: `${fact.fact} (${fact.evidence})`,
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

  return formatCitationLines(facts);
}

/**
 * Build a deterministic, byte-identical static prefix placed at the start of system prompts
 * to maximize LLM provider prefix-cache reuse across distinct customers on the same tier/strategy set.
 */
function buildStaticPrefix(
  tier: 'simple' | 'standard' | 'complex',
  strategies: readonly RetentionStrategy[],
  isSingleDraft: boolean,
): string {
  const catalogBlock = formatRetentionStrategyCatalogForPrompt(strategies);
  const jsonSchema = isSingleDraft
    ? SINGLE_DRAFT_RESPONSE_JSON_FORMAT
    : MULTI_DRAFT_RESPONSE_JSON_FORMAT;

  if (tier === 'simple') {
    const cardinalityRule = isSingleDraft
      ? 'Output exactly 1 ranked draft (rank: 1) in "strategies", Vietnamese draftText <= 3 sentences, recommendationReason <= 20 words.'
      : 'Output 1 to 2 distinct ranked drafts (ranks 1..N) in "strategies" matching catalog codes.';

    return `You are a Vietnamese e-commerce customer support co-pilot for a Lazada store.
INSTRUCTIONS:
- ${cardinalityRule}
- "recommendedStrategyId" MUST match rank 1 strategy id.
- Ground factual claims in ALLOWED FACT CITATIONS; never fabricate order or tracking data.
- Voucher limits: Platinum <= 50,000 VND | Gold <= 25,000 VND | Silver <= 10,000 VND | Standard 0 VND.
- STRICT PROHIBITION ON INTERNAL JARGON: "draftText" is sent directly to the customer. Never include VIP/Platinum/Gold/Silver/Standard, RFM, vipScore, strat_*, evidence:*, [ID:*], or BYR-*.
## RETENTION STRATEGY CATALOG
${catalogBlock}
## OUTPUT RESPONSE FORMAT
Return ONLY valid JSON:
${jsonSchema}`;
  }

  if (tier === 'standard') {
    const cardinalityRule = isSingleDraft
      ? 'Output 1 ranked draft (rank: 1) in "strategies", concise Vietnamese draftText <= 3 sentences, recommendationReason <= 20 words.'
      : 'Output 1 to 2 distinct ranked drafts (ranks 1..2) in "strategies" with distinct draftText.';

    return `You are an e-commerce customer care co-pilot for a Lazada seller store in Vietnam.
INSTRUCTIONS:
- ${cardinalityRule}
- "recommendedStrategyId" MUST match the rank 1 strategy id.
- Ground every order/shipping claim in ALLOWED FACT CITATIONS ("groundedFactsUsed"); list unverified claims in "ungroundedClaims".
- Voucher limits: Platinum <= 50,000 VND | Gold <= 25,000 VND | Silver <= 10,000 VND | Standard 0 VND. "draftText" voucher amount must match "proposedCompensation.amountVnd".
- Action routing: "auto_reply" (conf >= 0.90, grounded, no dispute/voucher) | "await_approval" (vouchers/cancellations/returns) | "escalate_to_human" (frustrated/complaint/ungrounded).
- STRICT PROHIBITION ON INTERNAL JARGON: "draftText" is sent directly to the customer. Never include VIP/Platinum/Gold/Silver/Standard, RFM, vipScore, strat_*, evidence:*, [ID:*], or BYR-*.
## RETENTION STRATEGY CATALOG
${catalogBlock}
## OUTPUT RESPONSE FORMAT
Return ONLY valid JSON:
${jsonSchema}`;
  }

  const complexHeading = isSingleDraft
    ? '## CRITICAL SINGLE-DRAFT INSTRUCTIONS'
    : '## CRITICAL MULTI-DRAFT INSTRUCTIONS';
  const strategyCountRule = isSingleDraft
    ? 'Choose 1 best strategy from RETENTION STRATEGY CATALOG (rank: 1). Write concise polite Vietnamese draftText <= 3 sentences and recommendationReason <= 20 words.'
    : 'Choose 2 or 3 distinct strategies from RETENTION STRATEGY CATALOG with contiguous ranks (1..N) and non-identical draftText embodying each strategy tone/tactic.';

  return `You are a professional e-commerce customer care co-pilot for a Lazada seller store in Vietnam.
${complexHeading}
- Strategy & Ranking: ${strategyCountRule} "recommendedStrategyId" MUST match rank 1 and explain why in "recommendationReason" citing "recommendationGroundedFactsUsed".
- Grounding: Every factual claim in "draftText" MUST cite an exact key from ALLOWED FACT CITATIONS in "groundedFactsUsed". List unverified claims in "ungroundedClaims". Never fabricate order, carrier, or tracking data.
- Compensation: "proposedCompensation" is {"kind":"none"} or {"kind":"voucher","amountVnd":<int>} matching any voucher in "draftText". Tier limits: Platinum <= 50,000 VND | Gold <= 25,000 VND | Silver <= 10,000 VND | Standard 0 VND.
- Routing ("suggestedAction"): "auto_reply" (conf >= 0.90, grounded, no disputes/vouchers) | "await_approval" (vouchers/cancellations/returns) | "escalate_to_human" (frustrated/severe complaints/ungrounded).
- STRICT PROHIBITION ON INTERNAL JARGON: "draftText" is sent directly to the customer. Never expose VIP, Platinum, Gold, Silver, Standard, RFM, vipScore, strat_*, evidence:*, [ID:*], or BYR-*. Use natural Vietnamese phrasing such as "khách hàng thân thiết".
## RETENTION STRATEGY CATALOG
${catalogBlock}
## OUTPUT RESPONSE FORMAT
Return ONLY valid JSON (no markdown or code fences):
${jsonSchema}`;
}

/**
 * Build a lightweight system prompt for simple inquiries (greetings, general FAQs, product info).
 * Prunes bulky dossier metrics, caps turns at 4, keeps top 3 high-confidence evidence facts,
 * and orders static instructions before dynamic context for prefix-cache hits.
 */
export function buildLiteSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
  customFactsSection?: string,
  options?: PromptBuildOptions,
): string {
  const effectiveStrategies: readonly RetentionStrategy[] =
    strategies.length > 0
      ? strategies
      : [
          {
            id: 0,
            code: 'strat_goodwill',
            name: 'Goodwill Assurance',
            strategyType: 'goodwill',
            tone: 'Empathetic and warm',
            retentionFocus: 'Relationship building and courtesy',
            selectionGuidance: 'Warm, polite assistance for general inquiries',
            isActive: true,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
        ];

  const isSingleDraft =
    (options?.mode ?? 'fast_single') === 'fast_single' || effectiveStrategies.length <= 1;
  const intentCode = context.turn.detectedIntent?.code ?? 'general';
  const policies = getPoliciesByIntent(intentCode);
  const formattedFacts = customFactsSection ?? buildLiteAllowedFactCitations(context, policies);

  const { vipTier } = context.dossier.customer;
  const staticPrefix = buildStaticPrefix('simple', effectiveStrategies, isSingleDraft);

  return `${staticPrefix}
---
## CUSTOMER TIER
tier: ${vipTier.name} (${vipTier.code})

${formatMinimalLinkedOrder(context)}

${formatConversationContext(context, SIMPLE_MAX_RECENT_MESSAGES, SIMPLE_MESSAGE_PREVIEW_CHARS)}

${formatPolicies(policies)}

${formattedFacts}`;
}

/**
 * Build a standard system prompt for operational inquiries (shipping status, vouchers, order edits).
 * Caps turns at 6, limits evidence to top 5, formats dense key: value pairs,
 * and preserves a deterministic leading static prefix.
 */
export function buildStandardSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
  customFactsSection?: string,
  options?: PromptBuildOptions,
): string {
  const { customer } = context.dossier;
  const intentCode = context.turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);
  const isSingleDraft = options?.mode === 'fast_single' || strategies.length <= 1;

  const formattedFacts = customFactsSection ?? buildStandardAllowedFactCitations(context, policies);
  const staticPrefix = buildStaticPrefix('standard', strategies, isSingleDraft);

  return `${staticPrefix}
---
${formatCompactLinkedOrder(context)}

${formatConversationContext(context, STANDARD_MAX_RECENT_MESSAGES, STANDARD_MESSAGE_PREVIEW_CHARS)}

${formatPolicies(policies)}

## VIP TIER HANDLING
tier: ${customer.vipTier.name} (${customer.vipTier.code})
${getVipInstructions(customer.vipTier.code)}

${formattedFacts}`;
}

/**
 * Build the complete multi-draft system prompt with 3-layer context, strategy catalog,
 * allowed fact citations, and safety guardrails, ordered with a byte-identical static prefix first.
 */
export function buildSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
  customFactsSection?: string,
  options?: PromptBuildOptions,
): string {
  const { turn, dossier } = context;
  const { customer } = dossier;
  const intentCode = turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);
  const isSingleDraft = options?.mode === 'fast_single' || strategies.length <= 1;

  const formattedFacts = customFactsSection ?? buildAllowedFactCitations(context, policies);
  const staticPrefix = buildStaticPrefix('complex', strategies, isSingleDraft);

  return `${staticPrefix}
---
## CUSTOMER PROFILE & METRICS (INTERNAL)
tier: ${customer.vipTier.name} (${customer.vipTier.code}, priority: ${customer.vipTier.priority}) | score: ${customer.vipScore}/100 | spend: ${customer.totalSpend.toLocaleString()} VND | orders: ${customer.orderCount} | aov: ${customer.avgOrderValue.toLocaleString()} VND | days_since_last: ${customer.daysSinceLastOrder ?? 'N/A'} | cancel_rate: ${(customer.cancellationRate * 100).toFixed(1)}% | refund_rate: ${(customer.refundRate * 100).toFixed(1)}% | voucher_sensitivity: ${(customer.voucherSensitivity * 100).toFixed(1)}%${customer.preferredLanguage ? ` | lang: ${customer.preferredLanguage}` : ''}
history: total_inquiries=${dossier.totalConversationCount} | unresolved=${dossier.unresolvedConversationCount} | past_intents=${dossier.pastIntents.length > 0 ? dossier.pastIntents.join(', ') : 'None'}

${formatLinkedOrder(context)}

${formatConversationContext(context)}

${formatPolicies(policies)}

## VIP TIER COMPENSATION & HANDLING RULES
${getVipInstructions(customer.vipTier.code)}

${formattedFacts}`;
}

/**
 * Build the user prompt from the latest customer message without duplicating strategy catalog instructions.
 */
export function buildUserPrompt(latestMessageText: string): string {
  return `Customer message: "${latestMessageText}"\nReturn ONLY valid JSON matching the schema.`;
}
