/**
 * Policy Store Utilities — hardcoded e-commerce store policies and category helpers.
 * Constrains what the LLM can promise or do.
 */

export type PolicyRule = {
  readonly code: string;
  readonly category: string;
  readonly rule: string;
};

/** All store policies */
export const STORE_POLICIES: readonly PolicyRule[] = [
  // Return & Refund
  {
    code: 'RETURN_WINDOW',
    category: 'returns',
    rule: 'Customers may request returns within 15 calendar days of delivery. After 15 days, returns are not accepted unless the item is defective.',
  },
  {
    code: 'RETURN_ELECTRONICS',
    category: 'returns',
    rule: 'Electronics must be returned in original packaging with all accessories. Opened software/digital items are non-returnable.',
  },
  {
    code: 'RETURN_FASHION',
    category: 'returns',
    rule: 'Fashion items must be unworn with original tags attached. Undergarments and swimwear are non-returnable for hygiene reasons.',
  },
  {
    code: 'REFUND_TIMELINE',
    category: 'returns',
    rule: 'Refunds are processed within 3–5 business days after the returned item passes inspection.',
  },
  {
    code: 'REFUND_METHOD',
    category: 'returns',
    rule: 'Refunds are issued to the original payment method. Store credit is offered as an alternative if requested.',
  },

  // Shipping & Delivery
  {
    code: 'SHIPPING_STANDARD',
    category: 'shipping',
    rule: 'Standard delivery takes 3–7 business days within Vietnam. Express delivery is 1–3 business days at additional cost.',
  },
  {
    code: 'SHIPPING_FREE',
    category: 'shipping',
    rule: 'Free shipping is available on orders above 300,000 VND. VIP (Gold/Platinum) customers receive free shipping on all orders.',
  },
  {
    code: 'SHIPPING_DELAY_COMP',
    category: 'shipping',
    rule: 'For delays exceeding 3 days beyond estimated delivery: Standard customers receive an apology. Silver customers receive a 10,000 VND voucher. Gold customers receive a 25,000 VND voucher. Platinum customers receive a 50,000 VND voucher and priority re-shipment.',
  },

  // Voucher & Compensation
  {
    code: 'VOUCHER_MAX',
    category: 'vouchers',
    rule: 'Maximum voucher value for any single compensation event is 50,000 VND. Vouchers exceeding this amount require human manager approval.',
  },
  {
    code: 'VOUCHER_STACKING',
    category: 'vouchers',
    rule: 'Only one voucher can be applied per order. Vouchers cannot be combined with platform-wide promotions.',
  },

  // Cancellation
  {
    code: 'CANCEL_BEFORE_SHIP',
    category: 'cancellation',
    rule: 'Orders can be cancelled without penalty before shipment (status: unpaid, paid, or processing). Once shipped, cancellation requires a return process.',
  },
  {
    code: 'CANCEL_PARTIAL',
    category: 'cancellation',
    rule: 'Partial order cancellation is not supported. The entire order must be cancelled and re-placed if partial changes are needed.',
  },

  // Privacy & Security
  {
    code: 'PII_PROHIBITION',
    category: 'privacy',
    rule: 'Never expose full phone numbers, email addresses, payment card details, or home addresses in chat responses. Use masked formats only (e.g., "***1234").',
  },
  {
    code: 'CONSENT_CHECK',
    category: 'privacy',
    rule: 'Only personalize responses using customer data when consent status is "granted". If consent is "revoked" or "pending", provide generic assistance only.',
  },

  // Prohibited Actions
  {
    code: 'NO_CUSTOM_DISCOUNT',
    category: 'prohibited',
    rule: 'Never promise custom discounts, price matching, or special pricing outside of existing voucher/promotion policies without human manager approval.',
  },
  {
    code: 'NO_COMPETITOR_REF',
    category: 'prohibited',
    rule: 'Never reference competitor platforms, suggest purchasing from competitors, or compare prices with competitor listings.',
  },
  {
    code: 'NO_MEDICAL_LEGAL',
    category: 'prohibited',
    rule: 'Never provide medical, legal, or financial advice. Redirect such questions to appropriate professional services.',
  },
] as const;

/**
 * Get all store policies.
 */
export function getAllPolicies(): readonly PolicyRule[] {
  return STORE_POLICIES;
}

/**
 * Map intent codes to relevant policy categories.
 */
export function getRelevantCategories(intentCode: string | null): readonly string[] {
  switch (intentCode) {
    case 'delivery_status':
      return ['shipping'];
    case 'refund_request':
      return ['returns', 'shipping'];
    case 'cancellation':
      return ['cancellation', 'returns'];
    case 'voucher':
      return ['vouchers', 'shipping'];
    case 'complaint':
      return ['returns', 'shipping', 'vouchers', 'cancellation'];
    case 'product_info':
    case 'repurchase':
    case 'general':
    default:
      return [];
  }
}

/**
 * Get policies relevant to a specific intent.
 */
export function getPoliciesByIntent(intentCode: string | null): readonly PolicyRule[] {
  const relevantCategories = getRelevantCategories(intentCode);

  // Always include privacy and prohibited policies
  const alwaysInclude = ['privacy', 'prohibited'];

  return STORE_POLICIES.filter(
    (p) => relevantCategories.includes(p.category) || alwaysInclude.includes(p.category),
  );
}
