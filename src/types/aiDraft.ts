/**
 * AI Draft domain types.
 * Derives Prisma-backed relation types via `prisma generate`,
 * then defines browser-safe DTOs with computed freshness/selection flags.
 */

import type { Prisma } from '@prisma/client';
import type { MultiDraftResponse, MultiDraftGroundingResult } from './rag';

// ============================================================
// Prisma-derived relation types (match service query includes)
// ============================================================

/** AiDraftResponse with strategies and trigger/applied message relations */
export type AiDraftResponseWithRelations = Prisma.AiDraftResponseGetPayload<{
  include: {
    strategies: true;
    triggerMessage: { include: { senderType: true } };
    appliedMessage: true;
  };
}>;

/** AiDraftStrategy base record (no extra includes) */
export type AiDraftStrategyRecord = Prisma.AiDraftStrategyGetPayload<object>;

/** AiDraftResponse with only strategy count and trigger text (for history) */
export type AiDraftResponseForHistory = Prisma.AiDraftResponseGetPayload<{
  include: {
    strategies: { select: { id: true } };
    triggerMessage: { select: { text: true } };
  };
}>;

// ============================================================
// Lifecycle & Computed Enums
// ============================================================

/** Persisted draft lifecycle status */
export type AiDraftStatus = 'pending' | 'applied' | 'rejected';

/** Computed at read time; never persisted as a database status */
export type AiDraftOutdatedReason = 'newer_buyer_message' | 'older_generation';

// ============================================================
// Browser-safe DTOs
// ============================================================

/** Compact representation of the buyer message that triggered draft generation */
export type AiDraftTriggerMessageDto = {
  readonly id: number;
  readonly text: string | null;
  readonly timestamp: string;
  readonly senderName: string;
};

/** Strategy option DTO with computed recommendation/selection flags */
export type AiDraftStrategyDto = {
  readonly id: number;
  readonly strategyCode: string;
  readonly rank: number;
  readonly draftText: string;
  readonly confidence: number;
  readonly suggestedAction: 'auto_reply' | 'await_approval' | 'escalate_to_human';
  readonly isBestMatch: boolean;
  /** Computed: strategy.strategyCode === draft.recommendedStrategyCode */
  readonly isRecommended: boolean;
  /** Computed: draft.selectedStrategyCode != null && strategy.strategyCode === draft.selectedStrategyCode */
  readonly isSelected: boolean;
  readonly groundedFactsUsed: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly proposedCompensation: { readonly kind: string; readonly amountVnd?: number } | null;
  readonly groundingIsValid: boolean;
  readonly groundingPrecision: number;
};

/** Complete draft DTO for the AI Draft review panel UI */
export type AiDraftDetailDto = {
  readonly id: number;
  readonly conversationId: number;
  readonly status: AiDraftStatus;
  readonly rejectionReason: string | null;
  readonly recommendedStrategyCode: string;
  readonly selectedStrategyCode: string | null;
  readonly customDraftText: string | null;
  readonly isOutdated: boolean;
  readonly isApprovable: boolean;
  readonly outdatedReason: AiDraftOutdatedReason | null;
  readonly createdAt: string;
  readonly triggerMessage: AiDraftTriggerMessageDto | null;
  readonly appliedMessageId: number | null;
  readonly approvedById: string | null;
  readonly approvedAt: string | null;
  readonly rejectedById: string | null;
  readonly rejectedAt: string | null;
  readonly strategies: readonly AiDraftStrategyDto[];
  readonly response: MultiDraftResponse;
  readonly grounding: MultiDraftGroundingResult;
};

/** Compact draft summary for history selector and audit timeline */
export type AiDraftSummaryDto = {
  readonly id: number;
  readonly status: AiDraftStatus;
  readonly recommendedStrategyCode: string;
  readonly selectedStrategyCode: string | null;
  readonly isOutdated: boolean;
  readonly isApprovable: boolean;
  readonly createdAt: string;
  readonly strategyCount: number;
  readonly triggerMessagePreview: string | null;
};

// ============================================================
// Service Input Types
// ============================================================

/** Input for creating a draft record from RAG pipeline output */
export type CreateAiDraftInput = {
  readonly conversationId: number;
  readonly triggerMessageId: number | null;
  readonly recommendedStrategyCode: string;
  readonly recommendationReason: string | null;
  readonly recommendationGroundedFacts: readonly string[] | null;
  readonly providerUsed: string | null;
  readonly groundingIsValid: boolean;
  readonly groundingPrecision: number;
  readonly groundingViolations: unknown;
  readonly strategies: readonly CreateAiDraftStrategyInput[];
};

/** Input for a single strategy within a draft */
export type CreateAiDraftStrategyInput = {
  readonly strategyCode: string;
  readonly rank: number;
  readonly draftText: string;
  readonly confidence: number;
  readonly suggestedAction: string;
  readonly groundedFactsUsed: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly proposedCompensation: unknown;
  readonly isBestMatch: boolean;
  readonly groundingIsValid: boolean;
  readonly groundingPrecision: number;
  readonly groundingViolations: unknown;
};

/** Input for applying (approving) a draft */
export type ApplyAiDraftInput = {
  readonly draftId: number;
  readonly conversationId: number;
  readonly selectedStrategyCode: string;
  readonly customDraftText?: string | null;
};

/** Input for rejecting a draft */
export type RejectAiDraftInput = {
  readonly draftId: number;
  readonly conversationId: number;
  readonly rejectionReason: string;
};
