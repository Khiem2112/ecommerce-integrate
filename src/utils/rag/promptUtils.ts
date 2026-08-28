/**
 * Prompt Utilities — builds system and user prompts for the multi-draft RAG LLM.
 * Injects 3-layer context, retention strategy catalog, allowed fact citations, and store policies.
 */

import type { FullCustomerContext } from '@/types';
import { getPoliciesByIntent, type PolicyRule } from './policyUtils';
import {
  buildGroundingFactCatalog,
  formatGroundingFactsForPrompt,
} from '@/services/rag/groundingFacts';
import {
  formatRetentionStrategyCatalogForPrompt,
  type RetentionStrategy,
} from '@/services/rag/strategyCatalog';

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
 * Format linked order details for prompt injection.
 */
export function formatLinkedOrder(context: FullCustomerContext): string {
  const { linkedOrder } = context.turn;
  if (!linkedOrder) return '## LINKED ORDER\nNo specific order linked to this conversation.';

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
        `  - ${h.status.name} at ${h.changedAt.toISOString().split('T')[0]}${
          h.note ? ` (${h.note})` : ''
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
      return `  [${msg.timestamp.toISOString().split('T')[1]?.slice(0, 5)}] ${sender}: ${
        msg.text ?? `[${msg.messageType}]`
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
  switch (tierCode) {
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
/**
 * Build a lightweight system prompt for simple inquiries (greetings, general FAQs, product info).
 * Strips heavy dossier metrics and evidence layers, generating exactly 1 fast, polite response draft.
 */
export function buildLiteSystemPrompt(
  context: FullCustomerContext,
  strategies: readonly RetentionStrategy[],
): string {
  const primaryStrategy = strategies[0] ?? {
    code: 'strat_goodwill',
    name: 'Goodwill Assurance',
    tone: 'Empathetic and warm',
    retentionFocus: 'Relationship building and courtesy',
  };

  const intentCode = context.turn.detectedIntent?.code ?? 'general';
  const policies = getPoliciesByIntent(intentCode);
  const factCatalog = buildGroundingFactCatalog(context, policies);
  const formattedFacts = formatGroundingFactsForPrompt(factCatalog);

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
): string {
  const { customer } = context.dossier;
  const intentCode = context.turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);

  const factCatalog = buildGroundingFactCatalog(context, policies);
  const formattedFacts = formatGroundingFactsForPrompt(factCatalog);
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
): string {
  const { turn, dossier } = context;
  const { customer } = dossier;
  const intentCode = turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);

  const factCatalog = buildGroundingFactCatalog(context, policies);
  const formattedFacts = formatGroundingFactsForPrompt(factCatalog);
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

