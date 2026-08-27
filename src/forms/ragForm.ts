import { z } from 'zod';

/**
 * Schema for validating RAG generation API request body
 */
export const ragGenerateSchema = z.object({
  conversationId: z.number().int().positive('conversationId must be a positive integer'),
});

export type RagGenerateInput = z.infer<typeof ragGenerateSchema>;

/**
 * Schema for validating LLM structured JSON output
 */
export const ragResponseSchema = z.object({
  responseText: z.string().min(1, 'responseText cannot be empty'),
  groundedFactsUsed: z.array(z.string()).default([]),
  ungroundedClaims: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  suggestedAction: z.enum(['auto_reply', 'await_approval', 'escalate_to_human']),
  providerUsed: z.string().optional(),
});

export type RagResponseOutput = z.infer<typeof ragResponseSchema>;

const MAX_DRAFT_TEXT_LENGTH = 2_000;
const MAX_FACT_REFERENCE_COUNT = 30;
const MAX_FACT_REFERENCE_LENGTH = 160;
const retentionStrategyCodeSchema = z.string().trim().min(1).max(100);

const factReferencesSchema = z
  .array(z.string().trim().min(1).max(MAX_FACT_REFERENCE_LENGTH))
  .max(MAX_FACT_REFERENCE_COUNT)
  .default([]);

const proposedCompensationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('voucher'),
    amountVnd: z.number().int().positive().max(50_000),
  }),
]);

const rawStrategyDraftSchema = z.strictObject({
  id: retentionStrategyCodeSchema,
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  draftText: z.string().trim().min(1, 'draftText cannot be empty').max(MAX_DRAFT_TEXT_LENGTH),
  groundedFactsUsed: factReferencesSchema,
  ungroundedClaims: factReferencesSchema,
  confidence: z.number().min(0).max(1),
  suggestedAction: z.enum(['auto_reply', 'await_approval', 'escalate_to_human']),
  proposedCompensation: proposedCompensationSchema,
});

/** Normalize customer-facing text before checking that strategy approaches differ. */
export function normalizeDraftText(draftText: string): string {
  return draftText.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * Strict provider-output contract for the Phase 1 single-completion multi-draft flow.
 * Context-specific citation verification is performed later by grounding validation.
 */
export const rawMultiDraftResponseSchema = z
  .strictObject({
    recommendedStrategyId: retentionStrategyCodeSchema,
    recommendationReason: z.string().trim().min(1).max(500),
    recommendationGroundedFactsUsed: factReferencesSchema,
    strategies: z.array(rawStrategyDraftSchema).min(2).max(3),
  })
  .superRefine((response, context) => {
    const strategyIds = response.strategies.map((strategy) => strategy.id);
    const ranks = response.strategies.map((strategy) => strategy.rank);
    const normalizedDrafts = response.strategies.map((strategy) => normalizeDraftText(strategy.draftText));

    if (new Set(strategyIds).size !== strategyIds.length) {
      context.addIssue({ code: 'custom', message: 'strategy IDs must be unique', path: ['strategies'] });
    }

    if (new Set(ranks).size !== ranks.length) {
      context.addIssue({ code: 'custom', message: 'strategy ranks must be unique', path: ['strategies'] });
    }

    const expectedRanks = Array.from({ length: ranks.length }, (_, index) => index + 1);
    if (!expectedRanks.every((rank) => ranks.includes(rank as 1 | 2 | 3))) {
      context.addIssue({ code: 'custom', message: 'strategy ranks must be contiguous starting at 1', path: ['strategies'] });
    }

    if (new Set(normalizedDrafts).size !== normalizedDrafts.length) {
      context.addIssue({ code: 'custom', message: 'strategy draftText values must be distinct', path: ['strategies'] });
    }

    const recommendedStrategy = response.strategies.find(
      (strategy) => strategy.id === response.recommendedStrategyId,
    );
    if (recommendedStrategy?.rank !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'recommendedStrategyId must identify the rank-1 strategy',
        path: ['recommendedStrategyId'],
      });
    }
  });

/**
 * Add database-backed strategy-code validation after the active catalog is loaded.
 * The base schema remains structural so the database is the authority for valid codes.
 */
export function createRawMultiDraftResponseSchema(
  allowedStrategyCodes: readonly string[],
): z.ZodType<RawMultiDraftResponseOutput> {
  const allowedCodes = new Set(allowedStrategyCodes);

  return rawMultiDraftResponseSchema.superRefine((response, context) => {
    if (!allowedCodes.has(response.recommendedStrategyId)) {
      context.addIssue({
        code: 'custom',
        message: 'recommendedStrategyId must identify an active retention strategy',
        path: ['recommendedStrategyId'],
      });
    }

    response.strategies.forEach((strategy, index) => {
      if (!allowedCodes.has(strategy.id)) {
        context.addIssue({
          code: 'custom',
          message: 'strategy ID must identify an active retention strategy',
          path: ['strategies', index, 'id'],
        });
      }
    });
  });
}

export type RawMultiDraftResponseOutput = z.infer<typeof rawMultiDraftResponseSchema>;
