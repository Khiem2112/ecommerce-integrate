/**
 * Grounding Fact Adapter
 *
 * Builds a deterministic, in-memory reference catalog from the 3-layer FullCustomerContext
 * and active store policies. Provides standard citation keys (Layer 1, Layer 2, Layer 3, Policy)
 * that the LLM is instructed to cite and the Grounding Validator uses to verify claims.
 */

import type { FullCustomerContext } from '@/types';
import type { PolicyRule } from '@/utils/rag/policyUtils';

export type GroundingFactSource = 'turn' | 'dossier' | 'evidence' | 'policy';

export type GroundingFact = {
  readonly id: string;
  readonly label: string;
  readonly source: GroundingFactSource;
  readonly value: string;
  readonly confidence: number;
  readonly observedAt?: Date;
};

/**
 * Build the complete allowed fact-reference catalog from a 3-layer context snapshot.
 * Does NOT perform additional database queries.
 */
export function buildGroundingFactCatalog(
  context: FullCustomerContext,
  policies: readonly PolicyRule[] = [],
): Map<string, GroundingFact> {
  const catalog = new Map<string, GroundingFact>();

  function addFact(fact: GroundingFact, aliases: readonly string[] = []) {
    catalog.set(fact.id, fact);
    for (const alias of aliases) {
      catalog.set(alias, fact);
    }
  }

  // ============================================================
  // Layer 1: Turn & Order Context
  // ============================================================
  const { turn, dossier, evidence } = context;

  if (turn.detectedIntent) {
    addFact({
      id: 'conversation:intent',
      label: 'Detected Intent',
      source: 'turn',
      value: `${turn.detectedIntent.name} (${turn.detectedIntent.code})`,
      confidence: 1.0,
    });
  }

  addFact({
    id: 'conversation:priority',
    label: 'Conversation Priority',
    source: 'turn',
    value: turn.conversationPriority,
    confidence: 1.0,
  });

  addFact({
    id: 'conversation:message_count',
    label: 'Message Count',
    source: 'turn',
    value: String(turn.messageCount),
    confidence: 1.0,
  });

  if (turn.linkedOrder) {
    const order = turn.linkedOrder;

    addFact(
      {
        id: 'order:id',
        label: 'Order ID',
        source: 'turn',
        value: order.platformOrderId,
        confidence: 1.0,
        observedAt: order.createdAt,
      },
      ['order:platform_id'],
    );

    addFact({
      id: 'order:status',
      label: 'Current Order Status',
      source: 'turn',
      value: `${order.currentStatus.name} (${order.currentStatus.code})`,
      confidence: 1.0,
      observedAt: order.updatedAt,
    });

    addFact({
      id: 'order:total_value',
      label: 'Order Total Value',
      source: 'turn',
      value: `${order.totalValue.toLocaleString()} VND`,
      confidence: 1.0,
    });

    addFact({
      id: 'order:discount',
      label: 'Order Discount Amount',
      source: 'turn',
      value: `${order.discountAmount.toLocaleString()} VND`,
      confidence: 1.0,
    });

    addFact({
      id: 'order:shipping_fee',
      label: 'Shipping Fee',
      source: 'turn',
      value: `${order.shippingFee.toLocaleString()} VND`,
      confidence: 1.0,
    });

    if (order.items.length > 0) {
      const itemsSummary = order.items
        .map((item) => `${item.productName} (qty: ${item.quantity})`)
        .join(', ');
      addFact({
        id: 'order:items',
        label: 'Order Items',
        source: 'turn',
        value: itemsSummary,
        confidence: 1.0,
      });
    }

    addFact({
      id: 'order:created_at',
      label: 'Order Creation Date',
      source: 'turn',
      value: order.createdAt.toISOString().split('T')[0],
      confidence: 1.0,
      observedAt: order.createdAt,
    });

    if (order.paidAt) {
      addFact({
        id: 'order:paid_at',
        label: 'Order Payment Date',
        source: 'turn',
        value: order.paidAt.toISOString().split('T')[0],
        confidence: 1.0,
        observedAt: order.paidAt,
      });
    }

    if (order.cancelledAt) {
      addFact({
        id: 'order:cancelled_at',
        label: 'Order Cancellation Date',
        source: 'turn',
        value: order.cancelledAt.toISOString().split('T')[0],
        confidence: 1.0,
        observedAt: order.cancelledAt,
      });
    }

    if (order.cancellationReason) {
      addFact({
        id: 'order:cancel_reason',
        label: 'Order Cancellation Reason',
        source: 'turn',
        value: order.cancellationReason,
        confidence: 1.0,
      });
    }

    if (order.statusHistory.length > 0) {
      const historySummary = order.statusHistory
        .map((h) => `${h.status.name} on ${h.changedAt.toISOString().split('T')[0]}${h.note ? ` (${h.note})` : ''}`)
        .join(' -> ');
      addFact({
        id: 'order:status_history',
        label: 'Order Status History',
        source: 'turn',
        value: historySummary,
        confidence: 1.0,
      });
    }
  }

  // ============================================================
  // Layer 2: Customer Behavioral Dossier (excluding raw Buyer ID)
  // ============================================================
  const { customer } = dossier;

  addFact({
    id: 'customer:tier',
    label: 'VIP Customer Tier',
    source: 'dossier',
    value: `${customer.vipTier.name} (Tier: ${customer.vipTier.code}, Priority: ${customer.vipTier.priority})`,
    confidence: 1.0,
  });

  addFact({
    id: 'customer:score',
    label: 'VIP Engagement Score',
    source: 'dossier',
    value: `${customer.vipScore}/100`,
    confidence: 1.0,
  });

  addFact(
    {
      id: 'customer:spend',
      label: 'Customer Lifetime Spend',
      source: 'dossier',
      value: `${customer.totalSpend.toLocaleString()} VND`,
      confidence: 1.0,
    },
    ['customer:total_spend'],
  );

  addFact({
    id: 'customer:order_count',
    label: 'Lifetime Order Count',
    source: 'dossier',
    value: String(customer.orderCount),
    confidence: 1.0,
  });

  addFact({
    id: 'customer:avg_order_value',
    label: 'Average Order Value',
    source: 'dossier',
    value: `${customer.avgOrderValue.toLocaleString()} VND`,
    confidence: 1.0,
  });

  if (customer.daysSinceLastOrder != null) {
    addFact({
      id: 'customer:days_since_last_order',
      label: 'Days Since Last Order',
      source: 'dossier',
      value: `${customer.daysSinceLastOrder} days`,
      confidence: 1.0,
    });
  }

  addFact({
    id: 'customer:cancellation_rate',
    label: 'Customer Cancellation Rate',
    source: 'dossier',
    value: `${(customer.cancellationRate * 100).toFixed(1)}%`,
    confidence: 1.0,
  });

  addFact({
    id: 'customer:refund_rate',
    label: 'Customer Refund Rate',
    source: 'dossier',
    value: `${(customer.refundRate * 100).toFixed(1)}%`,
    confidence: 1.0,
  });

  addFact({
    id: 'customer:voucher_sensitivity',
    label: 'Customer Voucher Sensitivity',
    source: 'dossier',
    value: `${(customer.voucherSensitivity * 100).toFixed(1)}%`,
    confidence: 1.0,
  });

  if (customer.preferredLanguage) {
    addFact({
      id: 'customer:preferred_language',
      label: 'Preferred Language',
      source: 'dossier',
      value: customer.preferredLanguage,
      confidence: 1.0,
    });
  }

  addFact({
    id: 'customer:total_conversations',
    label: 'Total Service Inquiries',
    source: 'dossier',
    value: String(dossier.totalConversationCount),
    confidence: 1.0,
  });

  addFact({
    id: 'customer:unresolved_conversations',
    label: 'Unresolved Inquiries',
    source: 'dossier',
    value: String(dossier.unresolvedConversationCount),
    confidence: 1.0,
  });

  if (dossier.pastIntents.length > 0) {
    addFact({
      id: 'customer:past_intents',
      label: 'Past Inquired Intents',
      source: 'dossier',
      value: dossier.pastIntents.join(', '),
      confidence: 1.0,
    });
  }

  // ============================================================
  // Layer 3: Evidence Context
  // ============================================================
  for (const fact of evidence.facts) {
    const evidenceFact: GroundingFact = {
      id: `evidence:${fact.id}`,
      label: `Customer Evidence #${fact.id}`,
      source: 'evidence',
      value: `"${fact.fact}" — Evidence: "${fact.evidence}"`,
      confidence: fact.confidence,
      observedAt: fact.lastObserved,
    };

    // Support both canonical "evidence:<id>" and legacy numeric "<id>"
    addFact(evidenceFact, [String(fact.id)]);
  }

  // ============================================================
  // Store Policies
  // ============================================================
  for (const policy of policies) {
    addFact(
      {
        id: `policy:${policy.code}`,
        label: `Store Policy [${policy.code}]`,
        source: 'policy',
        value: policy.rule,
        confidence: 1.0,
      },
      [policy.code],
    );
  }

  return catalog;
}

/**
 * Format allowed citation facts for inclusion in the LLM system prompt.
 * Only outputs distinct canonical IDs to keep token count clean.
 */
export function formatGroundingFactsForPrompt(
  catalog: Map<string, GroundingFact>,
): string {
  const uniqueFacts = Array.from(
    new Map(Array.from(catalog.values()).map((f) => [f.id, f])).values(),
  );

  if (uniqueFacts.length === 0) {
    return '## ALLOWED FACT CITATIONS\nNo specific context fact citations available.';
  }

  const lines = uniqueFacts.map(
    (f) => `  - [${f.id}] ${f.label} (conf: ${f.confidence.toFixed(2)})`,
  );

  return `## ALLOWED FACT CITATIONS (cite these EXACT IDs in groundedFactsUsed & recommendationGroundedFactsUsed)
${lines.join('\n')}`;
}
