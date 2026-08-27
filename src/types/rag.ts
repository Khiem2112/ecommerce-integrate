/**
 * RAG (Retrieval-Augmented Generation) domain types.
 * Defines the 3-layer context model, response format, and grounding validation.
 *
 * These are RAG-specific composed types that don't map to Prisma models.
 * They reference Prisma-derived types from sibling modules.
 */

import type { CustomerEvidenceRecord, CustomerWithRelations } from './customer';
import type { MessageWithSender, ConversationWithRelations } from './conversation';
import type { OrderWithHistory } from './order';
import type { RetentionStrategyCatalog } from '@prisma/client';

// ============================================================
// 3-Layer Context Model
// ============================================================

/** Operational context for the current turn (conversation + linked order) */
type TurnContext = {
  readonly conversationId: number;
  readonly recentMessages: readonly MessageWithSender[];
  readonly linkedOrder: OrderWithHistory | null;
  readonly detectedIntent: ConversationWithRelations['intent'];
  readonly conversationPriority: string;
  readonly messageCount: number;
};

/** Customer behavioral dossier (profile + metrics + service history) */
type CustomerDossier = {
  readonly customer: CustomerWithRelations;
  readonly unresolvedConversationCount: number;
  readonly pastIntents: readonly string[];
  readonly totalConversationCount: number;
};

/** Evidence-backed facts with traceable sources */
type EvidenceContext = {
  readonly facts: readonly CustomerEvidenceRecord[];
  readonly totalFactCount: number;
  readonly highConfidenceFactCount: number;
};

/** Combined 3-layer context object fed to the LLM */
type FullCustomerContext = {
  readonly turn: TurnContext;
  readonly dossier: CustomerDossier;
  readonly evidence: EvidenceContext;
};

// ============================================================
// LLM Response & Grounding
// ============================================================

/** Suggested action for the generated response */
type SuggestedAction = 'auto_reply' | 'await_approval' | 'escalate_to_human';

type RetentionStrategyCode = RetentionStrategyCatalog['code'];
type RetentionStrategy = RetentionStrategyCatalog;

type ProposedCompensation =
  | { readonly kind: 'none' }
  | { readonly kind: 'voucher'; readonly amountVnd: number };

type RawStrategyDraft = {
  readonly id: RetentionStrategyCode;
  readonly rank: 1 | 2 | 3;
  readonly draftText: string;
  readonly groundedFactsUsed: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly confidence: number;
  readonly suggestedAction: SuggestedAction;
  readonly proposedCompensation: ProposedCompensation;
};

type RawMultiDraftResponse = {
  readonly recommendedStrategyId: RetentionStrategyCode;
  readonly recommendationReason: string;
  readonly recommendationGroundedFactsUsed: readonly string[];
  readonly strategies: readonly RawStrategyDraft[];
  readonly providerUsed?: string;
};

type MultiDraftStrategy = RawStrategyDraft & {
  readonly strategy: RetentionStrategy;
  readonly isBestMatch: boolean;
};

type MultiDraftResponse = {
  readonly recommendedStrategyId: RetentionStrategyCode;
  readonly recommendationReason: string;
  readonly recommendationGroundedFactsUsed: readonly string[];
  readonly strategies: readonly MultiDraftStrategy[];
  readonly providerUsed: string;
};

/** Structured response from the LLM */
type RagResponse = {
  readonly responseText: string;
  readonly groundedFactsUsed: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly confidence: number;
  readonly suggestedAction: SuggestedAction;
  readonly providerUsed?: string;
};

/** Individual grounding violation */
type GroundingViolation = {
  readonly type: 'ungrounded_claim' | 'pii_exposure' | 'policy_violation' | 'internal_label_exposure';
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
};

/** Result of grounding validation */
type GroundingResult = {
  readonly isValid: boolean;
  readonly groundingPrecision: number;
  readonly totalClaims: number;
  readonly groundedClaims: number;
  readonly violations: readonly GroundingViolation[];
  readonly sanitizedResponse: RagResponse;
};

type StrategyGroundingResult = GroundingResult & {
  readonly strategyId: RetentionStrategyCode;
};

type MultiDraftGroundingResult = {
  readonly isValid: boolean;
  readonly byStrategyId: Readonly<Partial<Record<RetentionStrategyCode, StrategyGroundingResult>>>;
  readonly sanitizedResponse: MultiDraftResponse;
};

// ============================================================
// LLM Provider Config
// ============================================================

/** LLM provider identifier */
type LlmProviderName = 'gemini' | 'openai' | 'grok' | 'deepseek' | 'opencode';

/** Configuration for an LLM provider */
type LlmProviderConfig = {
  readonly name: LlmProviderName;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly temperature: number;
  readonly maxRetries: number;
};

/** Options for logging system and user prompts to file for debugging and token checks */
type PromptLogOptions = {
  readonly enableFileLog?: boolean;
  readonly logFilePath?: string;
  readonly overwrite?: boolean;
};

export type {
  TurnContext,
  CustomerDossier,
  EvidenceContext,
  FullCustomerContext,
  SuggestedAction,
  RetentionStrategyCode,
  RetentionStrategy,
  ProposedCompensation,
  RawStrategyDraft,
  RawMultiDraftResponse,
  MultiDraftStrategy,
  MultiDraftResponse,
  RagResponse,
  GroundingViolation,
  GroundingResult,
  StrategyGroundingResult,
  MultiDraftGroundingResult,
  LlmProviderName,
  LlmProviderConfig,
  PromptLogOptions,
};
