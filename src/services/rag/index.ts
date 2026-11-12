/**
 * RAG Orchestrator — central entry point for generating grounded customer responses.
 *
 * Pipeline Flow:
 * - Assemble 3-layer customer context (TurnContext, CustomerDossier, EvidenceContext)
 * - Formulate system and user prompts with VIP handling and policy rules
 * - Generate structured response via multi-provider LLM service
 * - Validate output with grounding validator (anti-hallucination & PII check)
 * - Return safe, grounded response
 */

import { appLogger } from '@/lib/logger';
import { ConversationNotFoundError } from '@/services/agentSessionService';
import { buildFullContext } from './contextBuilder';
import { getActiveRetentionStrategies } from './strategyCatalog';
import { generateResponse, getAvailableProvidersForTier } from './llmService';
import { resolveIntentTier, filterStrategiesForTier } from './intentRouter';
import { validateMultiDraftGrounding } from './groundingValidator';
import {
  buildLiteSystemPrompt,
  buildStandardSystemPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from '@/utils/rag';
import type {
  FullCustomerContext,
  GenerateGroundedOptions,
  MultiDraftGroundingResult,
  MultiDraftResponse,
  RagResponseMode,
} from '@/types';

const DEFAULT_TIER_OUTPUT_TOKENS: Record<'simple' | 'standard' | 'complex', number> = {
  simple: 500,
  standard: 900,
  complex: 1400,
};

const FAST_SINGLE_OUTPUT_TOKEN_CAP = 500;

export type GenerateGroundedResponseResult = {
  readonly context: FullCustomerContext;
  readonly response: MultiDraftResponse;
  readonly grounding: MultiDraftGroundingResult;
  readonly triggerMessage: {
    readonly id: number;
    readonly text: string | null;
    readonly timestamp: string;
  } | null;
};

/**
 * Generate a grounded, personalized customer-care response for a conversation.
 * Accepts either legacy `(conversationId, organizationId)` or `(conversationId, options)`
 * and forwards tier-optimized output token budgets and response mode to the LLM service.
 */
export async function generateGroundedResponse(
  conversationId: number,
  options?: GenerateGroundedOptions,
): Promise<GenerateGroundedResponseResult>;
export async function generateGroundedResponse(
  conversationId: number,
  organizationId?: number,
  options?: GenerateGroundedOptions,
): Promise<GenerateGroundedResponseResult>;
export async function generateGroundedResponse(
  conversationId: number,
  organizationIdOrOptions?: number | GenerateGroundedOptions,
  maybeOptions?: GenerateGroundedOptions,
): Promise<GenerateGroundedResponseResult> {
  const resolvedOptions: GenerateGroundedOptions =
    typeof organizationIdOrOptions === 'object' && organizationIdOrOptions !== null
      ? organizationIdOrOptions
      : (maybeOptions ?? {});
  const organizationId =
    typeof organizationIdOrOptions === 'number'
      ? organizationIdOrOptions
      : resolvedOptions.organizationId;
  const mode: RagResponseMode = resolvedOptions.mode ?? 'copilot_multi';

  const totalStart = Date.now();

  // Build 3-layer context and load cached active retention strategies concurrently
  const contextStart = Date.now();
  const [context, activeStrategies] = await Promise.all([
    organizationId !== undefined
      ? buildFullContext(conversationId, organizationId)
      : buildFullContext(conversationId),
    getActiveRetentionStrategies(),
  ]);
  const contextBuildMs = Date.now() - contextStart;

  if (!context) {
    throw new ConversationNotFoundError(
      `Conversation with ID ${conversationId} or associated customer not found.`,
    );
  }

  // Extract latest incoming buyer turn
  const messages = context.turn.recentMessages;
  const lastCustomerMessage = [...messages]
    .reverse()
    .find((m) => m.senderType.code === 'buyer');

  const latestText = lastCustomerMessage?.text ?? 'Hello, I need assistance with my order.';

  // Resolve Intent Tier dynamically
  const resolved = resolveIntentTier(latestText, context.turn.detectedIntent?.code);
  console.log(
    `[RAG Orchestrator] Resolved Intent: ${resolved.code} | Tier: ${resolved.tier} | Mode: ${mode} (source: ${resolved.source})`,
  );

  const tierStrategies = filterStrategiesForTier(resolved.tier, activeStrategies);
  const allowedCodes = tierStrategies.map((s) => s.code);

  // Build Tiered Prompts
  let systemPrompt: string;
  if (resolved.tier === 'simple') {
    systemPrompt = buildLiteSystemPrompt(context, tierStrategies, undefined, { mode });
  } else if (resolved.tier === 'standard') {
    systemPrompt = buildStandardSystemPrompt(context, tierStrategies, undefined, { mode });
  } else {
    systemPrompt = buildSystemPrompt(context, tierStrategies, undefined, { mode });
  }

  const userPrompt = buildUserPrompt(latestText);

  // Select provider chain and output token budget optimized for tier and mode
  const tierProviders = getAvailableProvidersForTier(resolved.tier);
  const defaultBudget =
    mode === 'fast_single'
      ? Math.min(DEFAULT_TIER_OUTPUT_TOKENS[resolved.tier], FAST_SINGLE_OUTPUT_TOKEN_CAP)
      : DEFAULT_TIER_OUTPUT_TOKENS[resolved.tier];
  const maxOutputTokens = resolvedOptions.maxOutputTokens ?? defaultBudget;

  // Generate LLM Output (Multi-Draft / Single-Draft)
  const llmStart = Date.now();
  const rawResponse = await generateResponse(
    systemPrompt,
    userPrompt,
    allowedCodes,
    tierProviders,
    { maxOutputTokens, tier: resolved.tier },
  );
  const llmMs = Date.now() - llmStart;

  // Validate Grounding & Safety across all strategy drafts
  const groundingStart = Date.now();
  const grounding = validateMultiDraftGrounding(rawResponse, context, activeStrategies);
  const groundingMs = Date.now() - groundingStart;
  const totalMs = Date.now() - totalStart;

  appLogger.info('RAG response generation timings', {
    conversationId,
    mode,
    intentCode: resolved.code,
    tier: resolved.tier,
    contextBuildMs,
    llmMs,
    groundingMs,
    totalMs,
    providerUsed: grounding.sanitizedResponse.providerUsed,
  });

  return {
    context,
    response: grounding.sanitizedResponse,
    grounding,
    triggerMessage: lastCustomerMessage
      ? {
          id: lastCustomerMessage.id,
          text: lastCustomerMessage.text,
          timestamp: lastCustomerMessage.timestamp.toISOString(),
        }
      : null,
  };
}

export * from './contextBuilder';
export * from './groundingFacts';
export * from './strategyCatalog';
export * from './intentRouter';
export * from './llmService';
export * from './groundingValidator';
