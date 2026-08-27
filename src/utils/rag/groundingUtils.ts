/**
 * Grounding Utilities — fact-checking, anti-hallucination, and safety evaluation engine.
 * Supports multi-layer context references, internal-label detection, PII scans, and tier-specific voucher limits.
 */

import type {
  FullCustomerContext,
  GroundingResult,
  GroundingViolation,
  MultiDraftGroundingResult,
  MultiDraftResponse,
  MultiDraftStrategy,
  RagResponse,
  RawMultiDraftResponse,
  RawStrategyDraft,
  RetentionStrategy,
  RetentionStrategyCode,
  StrategyGroundingResult,
  SuggestedAction,
} from '@/types';
import {
  buildGroundingFactCatalog,
  type GroundingFact,
} from '@/services/rag/groundingFacts';
import { getPoliciesByIntent } from './policyUtils';

// Regex patterns for sensitive PII detection
export const PHONE_REGEX = /(\+?84|0)(3|5|7|8|9)[0-9]{8}\b/g;
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

// Regex for extracting numeric currency mentions (VND)
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
 * Determine the maximum allowed compensation voucher amount by VIP tier.
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
 * Uses fresh regex state to prevent lastIndex leakage across multiple candidate validations.
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

    // Handle shorthand "k" for thousands
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

/**
 * Verify cited fact IDs against the allowed multi-layer fact catalog or Layer 3 evidence records.
 */
export function verifyFactGrounding(
  groundedFactsUsed: readonly string[],
  evidenceFactsOrCatalog:
    | FullCustomerContext['evidence']['facts']
    | Map<string, GroundingFact>
    | FullCustomerContext,
): string[] {
  let catalog: Map<string, GroundingFact> | null = null;
  let legacyEvidenceIds: Set<string> | null = null;

  if (evidenceFactsOrCatalog instanceof Map) {
    catalog = evidenceFactsOrCatalog;
  } else if ('evidence' in evidenceFactsOrCatalog && 'turn' in evidenceFactsOrCatalog) {
    const intentCode = evidenceFactsOrCatalog.turn.detectedIntent?.code ?? null;
    const policies = getPoliciesByIntent(intentCode);
    catalog = buildGroundingFactCatalog(evidenceFactsOrCatalog, policies);
  } else if (Array.isArray(evidenceFactsOrCatalog)) {
    legacyEvidenceIds = new Set(evidenceFactsOrCatalog.map((f) => String(f.id)));
  }

  const ungroundedFacts: string[] = [];

  for (const factId of groundedFactsUsed) {
    if (catalog) {
      const isKnown = catalog.has(factId) ||
        catalog.has(`evidence:${factId}`) ||
        (factId.startsWith('evidence:') && catalog.has(factId.replace('evidence:', '')));

      if (!isKnown) {
        ungroundedFacts.push(`Fact citation [${factId}] not found in customer context.`);
      }
    } else if (legacyEvidenceIds) {
      const isNumericId = /^\d+$/.test(factId);
      if (isNumericId && !legacyEvidenceIds.has(factId)) {
        ungroundedFacts.push(`Evidence ID [${factId}] not found in customer evidence.`);
      }
    }
  }

  return ungroundedFacts;
}

/**
 * Calculate grounding precision score as grounded claims over total claims.
 */
export function calculateGroundingPrecision(
  response: { readonly groundedFactsUsed: readonly string[]; readonly ungroundedClaims: readonly string[] },
  ungroundedFacts: readonly string[],
  violations: readonly GroundingViolation[],
): number {
  const totalClaims =
    response.groundedFactsUsed.length +
    response.ungroundedClaims.length +
    (violations.length > 0 ? 1 : 0);
  const groundedClaims = Math.max(0, response.groundedFactsUsed.length - ungroundedFacts.length);
  const rawPrecision = totalClaims > 0 ? groundedClaims / totalClaims : 1.0;
  return Number(rawPrecision.toFixed(2));
}

/**
 * Check if the candidate draft is safe and free of critical grounding violations.
 */
export function isSafeAndGrounded(
  violations: readonly GroundingViolation[],
  ungroundedFacts: readonly string[],
): boolean {
  const hasHighSeverityViolations = violations.some((v) => v.severity === 'high');
  return !hasHighSeverityViolations && ungroundedFacts.length === 0;
}

/**
 * Sanitize single response action and claims based on grounding evaluation.
 */
export function sanitizeResponseByGrounding(
  response: RagResponse,
  ungroundedFacts: readonly string[],
  isValid: boolean,
  precision: number,
): RagResponse {
  let finalSuggestedAction: SuggestedAction = response.suggestedAction;

  if (!isValid || precision < 0.7) {
    finalSuggestedAction = 'escalate_to_human';
  }

  return {
    ...response,
    suggestedAction: finalSuggestedAction,
    ungroundedClaims: [...response.ungroundedClaims, ...ungroundedFacts],
  };
}

/**
 * Validate grounding, safety, PII, voucher policy, and internal jargon for a single strategy draft.
 */
export function validateStrategyDraftGrounding(
  draft: RawStrategyDraft,
  context: FullCustomerContext,
  factCatalog?: Map<string, GroundingFact>,
): StrategyGroundingResult {
  const catalog =
    factCatalog ??
    buildGroundingFactCatalog(
      context,
      getPoliciesByIntent(context.turn.detectedIntent?.code ?? null),
    );

  const tierLimit = getTierMaxVoucherLimit(context.dossier.customer.vipTier.code);

  // 1. Scan for PII exposure
  const piiViolations = detectPiiViolations(draft.draftText);

  // 2. Scan for internal classification labels
  const internalLabelViolations = detectInternalLabelViolations(draft.draftText);

  // 3. Scan for voucher policy violations against customer tier limit
  const voucherViolations = checkVoucherPolicyViolations(draft.draftText, tierLimit);

  // 4. Validate proposedCompensation structure vs tier limit
  const compensationViolations: GroundingViolation[] = [];
  if (draft.proposedCompensation.kind === 'voucher') {
    if (draft.proposedCompensation.amountVnd > tierLimit) {
      compensationViolations.push({
        type: 'policy_violation',
        description: `Proposed compensation of ${draft.proposedCompensation.amountVnd.toLocaleString()} VND exceeds tier maximum of ${tierLimit.toLocaleString()} VND.`,
        severity: 'high',
      });
    }
  }

  // 5. Verify cited fact references against the multi-layer catalog
  const ungroundedFacts = verifyFactGrounding(draft.groundedFactsUsed, catalog);

  const violations: GroundingViolation[] = [
    ...piiViolations,
    ...internalLabelViolations,
    ...voucherViolations,
    ...compensationViolations,
  ];

  if (ungroundedFacts.length > 0) {
    violations.push({
      type: 'ungrounded_claim',
      description: `Referenced unknown context facts: ${ungroundedFacts.join('; ')}`,
      severity: 'medium',
    });
  }

  if (draft.ungroundedClaims.length > 0) {
    violations.push({
      type: 'ungrounded_claim',
      description: `Draft reported ungrounded claims: ${draft.ungroundedClaims.join('; ')}`,
      severity: 'medium',
    });
  }

  // 6. Calculate precision and safety
  const precision = calculateGroundingPrecision(draft, ungroundedFacts, violations);
  const isValid =
    isSafeAndGrounded(violations, ungroundedFacts) &&
    draft.ungroundedClaims.length === 0 &&
    precision >= 0.7;

  let finalSuggestedAction: SuggestedAction = draft.suggestedAction;
  if (!isValid || precision < 0.7) {
    finalSuggestedAction = 'escalate_to_human';
  }

  const sanitizedDraft: RagResponse = {
    responseText: draft.draftText,
    groundedFactsUsed: draft.groundedFactsUsed,
    ungroundedClaims: [...draft.ungroundedClaims, ...ungroundedFacts],
    confidence: draft.confidence,
    suggestedAction: finalSuggestedAction,
  };

  const totalClaims =
    draft.groundedFactsUsed.length +
    draft.ungroundedClaims.length +
    (violations.length > 0 ? 1 : 0);
  const groundedClaims = Math.max(0, draft.groundedFactsUsed.length - ungroundedFacts.length);

  return {
    strategyId: draft.id,
    isValid,
    groundingPrecision: precision,
    totalClaims,
    groundedClaims,
    violations,
    sanitizedResponse: sanitizedDraft,
  };
}

/**
 * Complete grounding validation pipeline for single RAG response (legacy & compatibility).
 */
export function validateGrounding(
  response: RagResponse,
  context: FullCustomerContext,
): GroundingResult {
  const intentCode = context.turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);
  const catalog = buildGroundingFactCatalog(context, policies);
  const tierLimit = getTierMaxVoucherLimit(context.dossier.customer.vipTier.code);

  const piiViolations = detectPiiViolations(response.responseText);
  const internalLabelViolations = detectInternalLabelViolations(response.responseText);
  const policyViolations = checkVoucherPolicyViolations(response.responseText, tierLimit);
  const ungroundedFacts = verifyFactGrounding(response.groundedFactsUsed, catalog);

  const violations: GroundingViolation[] = [
    ...piiViolations,
    ...internalLabelViolations,
    ...policyViolations,
  ];

  if (ungroundedFacts.length > 0) {
    violations.push({
      type: 'ungrounded_claim',
      description: `Referenced unknown evidence facts: ${ungroundedFacts.join('; ')}`,
      severity: 'medium',
    });
  }

  const precision = calculateGroundingPrecision(response, ungroundedFacts, violations);
  const isValid = isSafeAndGrounded(violations, ungroundedFacts);
  const sanitizedResponse = sanitizeResponseByGrounding(
    response,
    ungroundedFacts,
    isValid,
    precision,
  );

  const totalClaims =
    response.groundedFactsUsed.length +
    response.ungroundedClaims.length +
    (violations.length > 0 ? 1 : 0);
  const groundedClaims = Math.max(0, response.groundedFactsUsed.length - ungroundedFacts.length);

  return {
    isValid,
    groundingPrecision: precision,
    totalClaims,
    groundedClaims,
    violations,
    sanitizedResponse,
  };
}

/**
 * Validate grounding, safety, PII, voucher policy, and internal jargon across all strategy drafts.
 */
export function validateMultiDraftGrounding(
  rawResponse: RawMultiDraftResponse,
  context: FullCustomerContext,
  activeStrategies: readonly RetentionStrategy[],
): MultiDraftGroundingResult {
  const intentCode = context.turn.detectedIntent?.code ?? null;
  const policies = getPoliciesByIntent(intentCode);
  const catalog = buildGroundingFactCatalog(context, policies);

  const byStrategyId: Partial<Record<RetentionStrategyCode, StrategyGroundingResult>> = {};

  for (const draft of rawResponse.strategies) {
    byStrategyId[draft.id] = validateStrategyDraftGrounding(draft, context, catalog);
  }

  const strategyMap = new Map<string, RetentionStrategy>(
    activeStrategies.map((s) => [s.code, s]),
  );

  const enrichedStrategies: MultiDraftStrategy[] = rawResponse.strategies.map((draft) => {
    const strategyMeta = strategyMap.get(draft.id) ?? {
      id: 0,
      code: draft.id,
      name: draft.id,
      strategyType: 'custom',
      tone: 'professional',
      retentionFocus: 'general',
      selectionGuidance: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const strategyGrounding = byStrategyId[draft.id];
    const sanitized = strategyGrounding?.sanitizedResponse;

    return {
      ...draft,
      draftText: sanitized?.responseText ?? draft.draftText,
      suggestedAction: sanitized?.suggestedAction ?? draft.suggestedAction,
      ungroundedClaims: sanitized?.ungroundedClaims ?? draft.ungroundedClaims,
      strategy: strategyMeta,
      isBestMatch: draft.id === rawResponse.recommendedStrategyId,
    };
  });

  const recommendedGrounding = byStrategyId[rawResponse.recommendedStrategyId];
  const isValid = Boolean(recommendedGrounding?.isValid);

  const sanitizedResponse: MultiDraftResponse = {
    recommendedStrategyId: rawResponse.recommendedStrategyId,
    recommendationReason: rawResponse.recommendationReason,
    recommendationGroundedFactsUsed: rawResponse.recommendationGroundedFactsUsed,
    strategies: enrichedStrategies,
    providerUsed: rawResponse.providerUsed ?? 'unknown',
  };

  return {
    isValid,
    byStrategyId,
    sanitizedResponse,
  };
}

