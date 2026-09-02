import { z } from 'zod';

/** Allowed rejection reasons for draft review */
const REJECTION_REASONS = [
  'manual_reply',
  'hallucination',
  'tone_inappropriate',
  'policy_violation',
  'customer_cancelled',
] as const;

/** Validate input for applying (approving) an AI draft */
export const applyAiDraftSchema = z.object({
  draftId: z.number().int().positive({ message: 'A valid draft ID is required.' }),
  conversationId: z.number().int().positive({ message: 'A valid conversation ID is required.' }),
  selectedStrategyCode: z
    .string()
    .trim()
    .min(1, { message: 'A strategy code must be selected.' }),
  customDraftText: z.string().trim().nullable().optional(),
});

/** Validate input for rejecting an AI draft */
export const rejectAiDraftSchema = z.object({
  draftId: z.number().int().positive({ message: 'A valid draft ID is required.' }),
  conversationId: z.number().int().positive({ message: 'A valid conversation ID is required.' }),
  rejectionReason: z.enum(REJECTION_REASONS, {
    error: 'A valid rejection reason is required.',
  }),
});

/** Validate strategy sub-input for draft creation */
const createAiDraftStrategySchema = z.object({
  strategyCode: z.string().min(1),
  rank: z.number().int().min(1).max(3),
  draftText: z.string().min(1),
  confidence: z.number().min(0).max(1),
  suggestedAction: z.string().min(1),
  groundedFactsUsed: z.array(z.string()).readonly(),
  ungroundedClaims: z.array(z.string()).readonly(),
  proposedCompensation: z.unknown().nullable().optional(),
  isBestMatch: z.boolean(),
  groundingIsValid: z.boolean(),
  groundingPrecision: z.number().min(0).max(1),
  groundingViolations: z.unknown().nullable().optional(),
});

/** Validate full input for creating an AI draft from RAG pipeline output */
export const createAiDraftSchema = z.object({
  conversationId: z.number().int().positive(),
  triggerMessageId: z.number().int().positive().nullable(),
  recommendedStrategyCode: z.string().min(1),
  recommendationReason: z.string().nullable().optional(),
  recommendationGroundedFacts: z.array(z.string()).readonly().nullable().optional(),
  providerUsed: z.string().nullable().optional(),
  groundingIsValid: z.boolean(),
  groundingPrecision: z.number().min(0).max(1),
  groundingViolations: z.unknown().nullable().optional(),
  strategies: z.array(createAiDraftStrategySchema).min(1).max(3),
});

export type ApplyAiDraftFormInput = z.infer<typeof applyAiDraftSchema>;
export type RejectAiDraftFormInput = z.infer<typeof rejectAiDraftSchema>;
export type CreateAiDraftFormInput = z.infer<typeof createAiDraftSchema>;
