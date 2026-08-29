/**
 * Grounding Validator Service — anti-hallucination verification and safety evaluation orchestrator.
 * Orchestrates fact checking against Layer 1-3 context, store policies, PII detection, and voucher compliance.
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
import {
  getPoliciesByIntent,
  detectPiiViolations,
  detectInternalLabelViolations,
  checkVoucherPolicyViolations,
  getTierMaxVoucherLimit,
  calculateGroundingPrecision,
  isSafeAndGrounded,
  sanitizeResponseByGrounding,
} from '@/utils/rag';

export {
  detectPiiViolations,
  detectInternalLabelViolations,
  checkVoucherPolicyViolations,
  getTierMaxVoucherLimit,
  calculateGroundingPrecision,
  isSafeAndGrounded,
  sanitizeResponseByGrounding,
};

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
      const isKnown =
        catalog.has(factId) ||
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

  // Scan for sensitive PII exposure
  const piiViolations = detectPiiViolations(draft.draftText);

  // Scan for forbidden internal classification terms
  const internalLabelViolations = detectInternalLabelViolations(draft.draftText);

  // Scan customer-facing text for voucher limits
  const voucherViolations = checkVoucherPolicyViolations(draft.draftText, tierLimit);

  // Validate proposed compensation payload against tier limits
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

  // Verify cited fact keys against context evidence catalog
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
 * Complete grounding validation pipeline for single RAG response (legacy compatibility).
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
