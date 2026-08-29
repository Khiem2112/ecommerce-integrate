import type { GroundingViolation } from '@/types';

// Sensitive PII detection patterns for Vietnamese e-commerce customer channels
export const PHONE_REGEX = /(\+?84|0)(3|5|7|8|9)[0-9]{8}\b/g;
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

// Numeric currency mentions and store limits (VND)
export const VOUCHER_AMOUNT_REGEX = /(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:vnd|đ|k|nghìn|dong)/gi;
export const MAX_VOUCHER_LIMIT = 50000;

// Internal classification terms and identifiers forbidden in customer-facing drafts
const INTERNAL_LABEL_PATTERNS = [
  { pattern: /\bvip\b/i, label: 'VIP' },
  { pattern: /\b(platinum|gold|silver|standard)\b/i, label: 'Tier name' },
  { pattern: /\brfm\b/i, label: 'RFM' },
  { pattern: /\bvipScore\b/i, label: 'VIP Score' },
  { pattern: /\bstrat_[a-z0-9_]+\b/i, label: 'Strategy ID' },
  { pattern: /\bevidence:\d+\b/i, label: 'Evidence ID' },
  { pattern: /\b\[ID:\d+\]\b/i, label: 'Evidence ID' },
  { pattern: /\bBYR-\d+\b/i, label: 'Buyer ID' },
];

/**
 * Determine the maximum allowed compensation voucher amount based on VIP tier code.
 */
export function getTierMaxVoucherLimit(tierCode?: string): number {
  switch (tierCode?.toLowerCase()) {
    case 'platinum':
      return 50_000;
    case 'gold':
      return 25_000;
    case 'silver':
      return 10_000;
    case 'standard':
      return 0;
    default:
      return 0;
  }
}

/**
 * Scan generated customer-facing text for exposed PII (phone numbers, email addresses, credit cards).
 * Uses fresh regex instances to prevent state leakage across concurrent invocations.
 */
export function detectPiiViolations(text: string): GroundingViolation[] {
  const violations: GroundingViolation[] = [];

  const phoneRegex = new RegExp(PHONE_REGEX.source, 'i');
  if (phoneRegex.test(text)) {
    violations.push({
      type: 'pii_exposure',
      description: 'Response contains potential unmasked phone number.',
      severity: 'high',
    });
  }

  const emailRegex = new RegExp(EMAIL_REGEX.source, 'i');
  if (emailRegex.test(text)) {
    violations.push({
      type: 'pii_exposure',
      description: 'Response contains potential raw email address.',
      severity: 'high',
    });
  }

  const cardRegex = new RegExp(CREDIT_CARD_REGEX.source, '');
  if (cardRegex.test(text)) {
    violations.push({
      type: 'pii_exposure',
      description: 'Response contains potential credit/debit card number.',
      severity: 'high',
    });
  }

  return violations;
}

/**
 * Scan customer-facing text for internal classification terms (VIP, tier names, RFM, strategy IDs, evidence IDs).
 */
export function detectInternalLabelViolations(text: string): GroundingViolation[] {
  const violations: GroundingViolation[] = [];

  for (const { pattern, label } of INTERNAL_LABEL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match) {
      violations.push({
        type: 'internal_label_exposure',
        description: `Customer-facing draft contains internal classification jargon (${label}): "${match[0]}".`,
        severity: 'high',
      });
    }
  }

  return violations;
}

/**
 * Validate that voucher compensation amounts stay within store and tier policy limits.
 */
export function checkVoucherPolicyViolations(
  text: string,
  maxVoucherLimit: number = MAX_VOUCHER_LIMIT,
): GroundingViolation[] {
  const violations: GroundingViolation[] = [];
  const voucherRegex = new RegExp(VOUCHER_AMOUNT_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = voucherRegex.exec(text)) !== null) {
    const rawVal = match[1].replace(/[.,]/g, '');
    let amount = parseInt(rawVal, 10);

    // Convert shorthand "k" suffix to numeric thousands value
    if (match[0].toLowerCase().includes('k') && amount < 1000) {
      amount *= 1000;
    }

    if (amount > maxVoucherLimit) {
      violations.push({
        type: 'policy_violation',
        description: `Offered compensation voucher of ${amount.toLocaleString()} VND exceeds allowed tier limit of ${maxVoucherLimit.toLocaleString()} VND.`,
        severity: 'high',
      });
    }
  }

  return violations;
}
