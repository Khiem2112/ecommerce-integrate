/**
 * AI Draft Service — data access and business logic for AI draft lifecycle.
 * Handles creation, retrieval, freshness computation, approval, and rejection.
 * All functions accept an optional transaction client for composable transactions.
 */

import { prisma } from '@/lib/prisma';
import {
  createConversationMessage,
  resolveResponseSenderTypeService,
} from '@/services/conversationService';
import {
  detectPiiViolations,
  detectInternalLabelViolations,
  checkVoucherPolicyViolations,
} from '@/utils/rag';
import type {
  DbClient,
  AiDraftResponseWithRelations,
  AiDraftStrategyRecord,
  AiDraftResponseForHistory,
  AiDraftDetailDto,
  AiDraftSummaryDto,
  AiDraftStrategyDto,
  AiDraftTriggerMessageDto,
  AiDraftOutdatedReason,
  CreateAiDraftInput,
  MultiDraftResponse,
  MultiDraftGroundingResult,
  GroundingViolation,
  StrategyGroundingResult,
  RetentionStrategy,
} from '@/types';

// ============================================================
// Shared Prisma include for draft queries
// ============================================================

const DRAFT_INCLUDE = {
  strategies: {
    where: { isActive: true },
    orderBy: { rank: 'asc' as const },
  },
  triggerMessage: {
    include: { senderType: true },
  },
  appliedMessage: true,
} as const;

// ============================================================
// Internal helpers
// ============================================================

function serializeJsonStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Retrieve the latest buyer message for freshness comparison */
async function getLatestBuyerMessage(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<{ id: number; timestamp: Date } | null> {
  const buyerMessage = await tx.message.findFirst({
    where: {
      conversationId,
      isActive: true,
      senderType: { code: 'buyer' },
    },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    select: { id: true, timestamp: true },
  });
  return buyerMessage;
}

/** Compute freshness and approvability for a draft given the latest buyer message */
function computeFreshness(
  draft: { id: number; status: string; triggerMessageId: number | null; createdAt: Date },
  latestBuyerMessageId: number | null,
  isNewestDraftForTrigger: boolean,
): { isOutdated: boolean; isApprovable: boolean; outdatedReason: AiDraftOutdatedReason | null } {
  // Draft is not outdated if there's no buyer message to compare against
  if (latestBuyerMessageId === null) {
    return {
      isOutdated: false,
      isApprovable: draft.status === 'pending',
      outdatedReason: null,
    };
  }

  // Outdated if trigger message differs from latest buyer message
  const isOutdatedByMessage =
    draft.triggerMessageId !== null && draft.triggerMessageId !== latestBuyerMessageId;

  // Outdated if a newer draft exists for the same trigger
  const isOutdatedByGeneration = !isNewestDraftForTrigger;

  const isOutdated = isOutdatedByMessage || isOutdatedByGeneration;
  const outdatedReason: AiDraftOutdatedReason | null = isOutdatedByMessage
    ? 'newer_buyer_message'
    : isOutdatedByGeneration
      ? 'older_generation'
      : null;

  return {
    isOutdated,
    isApprovable: draft.status === 'pending' && !isOutdated,
    outdatedReason,
  };
}

/** Map a Prisma draft strategy to the browser-safe DTO */
function toStrategyDto(
  strategy: AiDraftStrategyRecord,
  recommendedStrategyCode: string,
  selectedStrategyCode: string | null,
): AiDraftStrategyDto {
  const compensation = strategy.proposedCompensation as
    | { kind: string; amountVnd?: number }
    | null;

  return {
    id: strategy.id,
    strategyCode: strategy.strategyCode,
    rank: strategy.rank,
    draftText: strategy.draftText,
    confidence: strategy.confidence,
    suggestedAction: strategy.suggestedAction as
      | 'auto_reply'
      | 'await_approval'
      | 'escalate_to_human',
    isBestMatch: strategy.isBestMatch,
    isRecommended: strategy.strategyCode === recommendedStrategyCode,
    isSelected:
      selectedStrategyCode !== null && strategy.strategyCode === selectedStrategyCode,
    groundedFactsUsed: serializeJsonStringArray(strategy.groundedFactsUsed),
    ungroundedClaims: serializeJsonStringArray(strategy.ungroundedClaims),
    proposedCompensation: compensation,
    groundingIsValid: strategy.groundingIsValid,
    groundingPrecision: strategy.groundingPrecision,
  };
}

/** Map trigger message from Prisma to DTO */
function toTriggerMessageDto(
  msg: AiDraftResponseWithRelations['triggerMessage'],
): AiDraftTriggerMessageDto | null {
  if (!msg) return null;
  return {
    id: msg.id,
    text: msg.text,
    timestamp: msg.timestamp.toISOString(),
    senderName: msg.senderType.name,
  };
}

/**
 * Reconstruct MultiDraftResponse and MultiDraftGroundingResult from stored draft data.
 * These are serialized composites originally produced by the RAG pipeline.
 */
function reconstructRagData(
  draft: AiDraftResponseWithRelations,
  catalogMap?: Map<string, RetentionStrategy>,
): { response: MultiDraftResponse; grounding: MultiDraftGroundingResult } {
  const response: MultiDraftResponse = {
    recommendedStrategyId: draft.recommendedStrategyCode,
    recommendationReason: draft.recommendationReason ?? '',
    recommendationGroundedFactsUsed: serializeJsonStringArray(
      draft.recommendationGroundedFacts,
    ),
    strategies: draft.strategies.map((s: AiDraftStrategyRecord) => {
      const catalogStrategy = catalogMap?.get(s.strategyCode);
      return {
        id: s.strategyCode,
        rank: s.rank as 1 | 2 | 3,
        draftText: s.draftText,
        confidence: s.confidence,
        suggestedAction: s.suggestedAction as 'auto_reply' | 'await_approval' | 'escalate_to_human',
        groundedFactsUsed: serializeJsonStringArray(s.groundedFactsUsed),
        ungroundedClaims: serializeJsonStringArray(s.ungroundedClaims),
        proposedCompensation: (s.proposedCompensation as { kind: 'none' } | { kind: 'voucher'; amountVnd: number }) ?? { kind: 'none' as const },
        isBestMatch: s.isBestMatch,
        strategy: catalogStrategy ?? {
          id: 0,
          code: s.strategyCode,
          name: s.strategyCode,
          strategyType: 'standard',
          tone: 'neutral',
          retentionFocus: '',
          selectionGuidance: '',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
    }),
    providerUsed: draft.providerUsed ?? 'unknown',
  };

  const byStrategyId: Record<string, StrategyGroundingResult> = {};

  for (const s of draft.strategies) {
    const grounded = serializeJsonStringArray(s.groundedFactsUsed);
    const ungrounded = serializeJsonStringArray(s.ungroundedClaims);
    const violations = Array.isArray(s.groundingViolations)
      ? (s.groundingViolations as GroundingViolation[])
      : [];

    byStrategyId[s.strategyCode] = {
      isValid: s.groundingIsValid,
      groundingPrecision: s.groundingPrecision,
      totalClaims: grounded.length + ungrounded.length,
      groundedClaims: grounded.length,
      violations,
      strategyId: s.strategyCode,
      sanitizedResponse: {
        responseText: s.draftText,
        groundedFactsUsed: grounded,
        ungroundedClaims: ungrounded,
        confidence: s.confidence,
        suggestedAction: s.suggestedAction as 'auto_reply' | 'await_approval' | 'escalate_to_human',
      },
    };
  }

  const grounding: MultiDraftGroundingResult = {
    isValid: draft.groundingIsValid,
    byStrategyId,
    sanitizedResponse: response,
  };

  return { response, grounding };
}

// ============================================================
// Public Service Functions
// ============================================================

/** Create a new AI draft response with child strategies from RAG pipeline output */
export async function createAiDraftService(
  input: CreateAiDraftInput,
  tx: DbClient = prisma,
): Promise<{ id: number }> {
  const draft = await tx.aiDraftResponse.create({
    data: {
      conversationId: input.conversationId,
      triggerMessageId: input.triggerMessageId,
      recommendedStrategyCode: input.recommendedStrategyCode,
      recommendationReason: input.recommendationReason,
      recommendationGroundedFacts: input.recommendationGroundedFacts
        ? [...input.recommendationGroundedFacts]
        : undefined,
      providerUsed: input.providerUsed,
      groundingIsValid: input.groundingIsValid,
      groundingPrecision: input.groundingPrecision,
      groundingViolations: input.groundingViolations ?? undefined,
      strategies: {
        create: input.strategies.map((s) => ({
          strategyCode: s.strategyCode,
          rank: s.rank,
          draftText: s.draftText,
          confidence: s.confidence,
          suggestedAction: s.suggestedAction,
          groundedFactsUsed: [...s.groundedFactsUsed],
          ungroundedClaims: [...s.ungroundedClaims],
          proposedCompensation: s.proposedCompensation ?? undefined,
          isBestMatch: s.isBestMatch,
          groundingIsValid: s.groundingIsValid,
          groundingPrecision: s.groundingPrecision,
          groundingViolations: s.groundingViolations ?? undefined,
        })),
      },
    },
    select: { id: true },
  });

  return { id: draft.id };
}

/** Retrieve the latest AI draft for a conversation with computed freshness */
export async function getLatestAiDraftService(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<AiDraftDetailDto | null> {
  const draft = await tx.aiDraftResponse.findFirst({
    where: { conversationId, isActive: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: DRAFT_INCLUDE,
  });

  if (!draft) return null;

  const latestBuyerMsg = await getLatestBuyerMessage(conversationId, tx);

  // Determine if this draft is the newest for its triggerMessageId
  const newestDraftForTrigger = draft.triggerMessageId !== null
    ? await tx.aiDraftResponse.findFirst({
      where: {
        conversationId,
        triggerMessageId: draft.triggerMessageId,
        isActive: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    : null;

  const isNewestForTrigger = newestDraftForTrigger === null || newestDraftForTrigger.id === draft.id;
  const freshness = computeFreshness(draft, latestBuyerMsg?.id ?? null, isNewestForTrigger);

  const activeStrategies = await tx.retentionStrategyCatalog.findMany({ where: { isActive: true } });
  const catalogMap = new Map(activeStrategies.map((s) => [s.code, s]));
  const { response, grounding } = reconstructRagData(draft, catalogMap);

  return {
    id: draft.id,
    conversationId: draft.conversationId,
    status: draft.status as 'pending' | 'applied' | 'rejected',
    rejectionReason: draft.rejectionReason,
    recommendedStrategyCode: draft.recommendedStrategyCode,
    selectedStrategyCode: draft.selectedStrategyCode,
    customDraftText: draft.customDraftText,
    isOutdated: freshness.isOutdated,
    isApprovable: freshness.isApprovable,
    outdatedReason: freshness.outdatedReason,
    createdAt: draft.createdAt.toISOString(),
    triggerMessage: toTriggerMessageDto(draft.triggerMessage),
    appliedMessageId: draft.appliedMessageId,
    approvedById: draft.approvedById,
    approvedAt: draft.approvedAt?.toISOString() ?? null,
    rejectedById: draft.rejectedById,
    rejectedAt: draft.rejectedAt?.toISOString() ?? null,
    strategies: draft.strategies.map((s) =>
      toStrategyDto(s, draft.recommendedStrategyCode, draft.selectedStrategyCode),
    ),
    response,
    grounding,
  };
}

/** Retrieve a specific AI draft detail by ID and conversation ID with computed freshness */
export async function getAiDraftDetailService(
  draftId: number,
  conversationId: number,
  tx: DbClient = prisma,
): Promise<AiDraftDetailDto | null> {
  const draft = await tx.aiDraftResponse.findFirst({
    where: { id: draftId, conversationId, isActive: true },
    include: DRAFT_INCLUDE,
  });

  if (!draft) return null;

  const latestBuyerMsg = await getLatestBuyerMessage(conversationId, tx);

  // Determine if this draft is the newest for its triggerMessageId
  const newestDraftForTrigger = draft.triggerMessageId !== null
    ? await tx.aiDraftResponse.findFirst({
      where: {
        conversationId,
        triggerMessageId: draft.triggerMessageId,
        isActive: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    : null;

  const isNewestForTrigger = newestDraftForTrigger === null || newestDraftForTrigger.id === draft.id;
  const freshness = computeFreshness(draft, latestBuyerMsg?.id ?? null, isNewestForTrigger);

  const activeStrategies = await tx.retentionStrategyCatalog.findMany({ where: { isActive: true } });
  const catalogMap = new Map(activeStrategies.map((s) => [s.code, s]));
  const { response, grounding } = reconstructRagData(draft, catalogMap);

  return {
    id: draft.id,
    conversationId: draft.conversationId,
    status: draft.status as 'pending' | 'applied' | 'rejected',
    rejectionReason: draft.rejectionReason,
    recommendedStrategyCode: draft.recommendedStrategyCode,
    selectedStrategyCode: draft.selectedStrategyCode,
    customDraftText: draft.customDraftText,
    isOutdated: freshness.isOutdated,
    isApprovable: freshness.isApprovable,
    outdatedReason: freshness.outdatedReason,
    createdAt: draft.createdAt.toISOString(),
    triggerMessage: toTriggerMessageDto(draft.triggerMessage),
    appliedMessageId: draft.appliedMessageId,
    approvedById: draft.approvedById,
    approvedAt: draft.approvedAt?.toISOString() ?? null,
    rejectedById: draft.rejectedById,
    rejectedAt: draft.rejectedAt?.toISOString() ?? null,
    strategies: draft.strategies.map((s) =>
      toStrategyDto(s, draft.recommendedStrategyCode, draft.selectedStrategyCode),
    ),
    response,
    grounding,
  };
}

/** Retrieve draft history summaries for a conversation with computed freshness */
export async function getAiDraftHistoryService(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<AiDraftSummaryDto[]> {
  const drafts = await tx.aiDraftResponse.findMany({
    where: { conversationId, isActive: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      strategies: { where: { isActive: true }, select: { id: true } },
      triggerMessage: { select: { text: true } },
    },
  });

  if (drafts.length === 0) return [];

  const latestBuyerMsg = await getLatestBuyerMessage(conversationId, tx);

  // Build a map of newest draft ID per triggerMessageId for older_generation detection
  const newestByTrigger = new Map<number, number>();
  for (const d of drafts) {
    if (d.triggerMessageId !== null && !newestByTrigger.has(d.triggerMessageId)) {
      newestByTrigger.set(d.triggerMessageId, d.id);
    }
  }

  return drafts.map((draft) => {
    const isNewest =
      draft.triggerMessageId === null ||
      newestByTrigger.get(draft.triggerMessageId) === draft.id;

    const freshness = computeFreshness(draft, latestBuyerMsg?.id ?? null, isNewest);

    const previewText = draft.triggerMessage?.text ?? null;
    const triggerMessagePreview = previewText
      ? previewText.length > 80
        ? `${previewText.slice(0, 80)}…`
        : previewText
      : null;

    return {
      id: draft.id,
      status: draft.status as 'pending' | 'applied' | 'rejected',
      recommendedStrategyCode: draft.recommendedStrategyCode,
      selectedStrategyCode: draft.selectedStrategyCode,
      isOutdated: freshness.isOutdated,
      isApprovable: freshness.isApprovable,
      createdAt: draft.createdAt.toISOString(),
      strategyCount: draft.strategies.length,
      triggerMessagePreview,
    };
  });
}

/**
 * Apply (approve) a draft: validate it's still pending & fresh,
 * verify the strategy belongs to this draft, re-validate edited text safety,
 * create an internal message with strategy metadata,
 * and conditional-update the draft to 'applied'.
 */
export async function applyAiDraftService(
  draftId: number,
  input: {
    readonly conversationId: number;
    readonly selectedStrategyCode: string;
    readonly customDraftText?: string | null;
    readonly approvedById?: string | null;
  },
  tx: DbClient = prisma,
): Promise<{ appliedMessageId: number }> {
  // Load the draft and verify ownership + status + active
  const draft = await tx.aiDraftResponse.findFirst({
    where: { id: draftId, isActive: true },
    include: {
      strategies: { where: { isActive: true } },
    },
  });

  if (!draft) {
    throw new Error(`AI Draft ${draftId} was not found or is inactive.`);
  }
  if (draft.conversationId !== input.conversationId) {
    throw new Error('Draft does not belong to the specified conversation.');
  }
  if (draft.status !== 'pending') {
    throw new Error(`Draft has already been ${draft.status}. Cannot approve again.`);
  }

  // Validate selected strategy exists within this draft
  const selectedStrategy = draft.strategies.find(
    (s) => s.strategyCode === input.selectedStrategyCode,
  );
  if (!selectedStrategy) {
    throw new Error(
      `Strategy "${input.selectedStrategyCode}" does not belong to draft ${draftId}.`,
    );
  }

  // Verify freshness:
  // Check if a newer buyer message has arrived
  const latestBuyerMsg = await getLatestBuyerMessage(input.conversationId, tx);
  if (
    latestBuyerMsg &&
    draft.triggerMessageId !== null &&
    draft.triggerMessageId !== latestBuyerMsg.id
  ) {
    throw new Error(
      'This draft is outdated because a newer buyer message has been received. Please generate a new draft.',
    );
  }

  // Check if a newer draft exists for the same trigger
  if (draft.triggerMessageId !== null) {
    const newestDraftForTrigger = await tx.aiDraftResponse.findFirst({
      where: {
        conversationId: input.conversationId,
        triggerMessageId: draft.triggerMessageId,
        isActive: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });

    if (newestDraftForTrigger && newestDraftForTrigger.id !== draftId) {
      throw new Error(
        'This draft is outdated because a newer AI response has been generated for this customer message.',
      );
    }
  }

  // Determine effective message text and run server-side safety checks if customDraftText is provided
  const effectiveCustomText = input.customDraftText?.trim() || null;
  const messageText = effectiveCustomText || selectedStrategy.draftText;

  if (effectiveCustomText) {
    const piiViolations = detectPiiViolations(effectiveCustomText);
    const internalLabelViolations = detectInternalLabelViolations(effectiveCustomText);
    const voucherViolations = checkVoucherPolicyViolations(effectiveCustomText);
    const allViolations = [...piiViolations, ...internalLabelViolations, ...voucherViolations];

    if (allViolations.length > 0) {
      const errorMsg = allViolations.map((v) => v.description).join(' ');
      throw new Error(`Safety validation failed for edited text: ${errorMsg}`);
    }
  }

  // Resolve the sender type for the response message
  const senderTypeCode = await resolveResponseSenderTypeService(input.conversationId, tx);

  // Create the internal message with AI grounding metadata derived from the selected strategy in DB
  const message = await createConversationMessage(
    {
      conversationId: input.conversationId,
      text: messageText,
      senderTypeCode,
      groundedFacts: serializeJsonStringArray(selectedStrategy.groundedFactsUsed),
      ungroundedClaims: serializeJsonStringArray(selectedStrategy.ungroundedClaims),
      confidence: selectedStrategy.confidence,
      suggestedAction: selectedStrategy.suggestedAction,
    },
    tx,
  );

  // Conditional-update: only set applied if draft is still pending & active (idempotency guard)
  const updateResult = await tx.aiDraftResponse.updateMany({
    where: { id: draftId, status: 'pending', isActive: true },
    data: {
      status: 'applied',
      selectedStrategyCode: input.selectedStrategyCode,
      customDraftText: effectiveCustomText,
      appliedMessageId: message.id,
      approvedById: input.approvedById ?? null,
      approvedAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    throw new Error('Draft was concurrently reviewed by another request. Rolling back.');
  }

  return { appliedMessageId: message.id };
}

/**
 * Reject a draft: validate it's still pending & fresh,
 * then conditional-update to 'rejected'. Does not create a message.
 */
export async function rejectAiDraftService(
  draftId: number,
  input: {
    readonly conversationId: number;
    readonly rejectionReason: string;
    readonly rejectedById?: string | null;
  },
  tx: DbClient = prisma,
): Promise<void> {
  const draft = await tx.aiDraftResponse.findFirst({
    where: { id: draftId, isActive: true },
    select: { id: true, conversationId: true, status: true, triggerMessageId: true },
  });

  if (!draft) {
    throw new Error(`AI Draft ${draftId} was not found or is inactive.`);
  }
  if (draft.conversationId !== input.conversationId) {
    throw new Error('Draft does not belong to the specified conversation.');
  }
  if (draft.status !== 'pending') {
    throw new Error(`Draft has already been ${draft.status}. Cannot reject again.`);
  }

  // Verify freshness:
  // Check if a newer buyer message has arrived
  const latestBuyerMsg = await getLatestBuyerMessage(input.conversationId, tx);
  if (
    latestBuyerMsg &&
    draft.triggerMessageId !== null &&
    draft.triggerMessageId !== latestBuyerMsg.id
  ) {
    throw new Error('This draft is outdated. Rejection is not necessary for outdated drafts.');
  }

  // Check if a newer draft exists for the same trigger
  if (draft.triggerMessageId !== null) {
    const newestDraftForTrigger = await tx.aiDraftResponse.findFirst({
      where: {
        conversationId: input.conversationId,
        triggerMessageId: draft.triggerMessageId,
        isActive: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });

    if (newestDraftForTrigger && newestDraftForTrigger.id !== draftId) {
      throw new Error('This draft is an older generation and is already outdated.');
    }
  }

  // Conditional-update: only reject if still pending & active
  const updateResult = await tx.aiDraftResponse.updateMany({
    where: { id: draftId, status: 'pending', isActive: true },
    data: {
      status: 'rejected',
      rejectionReason: input.rejectionReason,
      rejectedById: input.rejectedById ?? null,
      rejectedAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    throw new Error('Draft was concurrently reviewed by another request.');
  }
}
