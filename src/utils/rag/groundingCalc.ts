import type { GroundingViolation, RagResponse, SuggestedAction } from '@/types';

/**
 * Calculate grounding precision score as verified grounded claims over total claims.
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
 * Sanitize response action routing and ungrounded claims list based on evaluation results.
 */
export function sanitizeResponseByGrounding(
  response: RagResponse,
  ungroundedFacts: readonly string[],
  isValid: boolean,
  precision: number,
): RagResponse {
  let finalSuggestedAction: SuggestedAction = response.suggestedAction;

  // Downgrade to human review if grounding fails or precision is substandard
  if (!isValid || precision < 0.7) {
    finalSuggestedAction = 'escalate_to_human';
  }

  return {
    ...response,
    suggestedAction: finalSuggestedAction,
    ungroundedClaims: [...response.ungroundedClaims, ...ungroundedFacts],
  };
}
