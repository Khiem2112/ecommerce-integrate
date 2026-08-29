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
import type { FullCustomerContext, MultiDraftGroundingResult, MultiDraftResponse } from '@/types';

export type GenerateGroundedResponseResult = {
  readonly context: FullCustomerContext;
  readonly response: MultiDraftResponse;
  readonly grounding: MultiDraftGroundingResult;
};

/**
 * Generate a grounded, personalized customer-care multi-draft response for a conversation.
 * Routes simple/standard/complex queries to appropriate prompts, strategies, and LLM tiers.
 */
export async function generateGroundedResponse(
  conversationId: number,
): Promise<GenerateGroundedResponseResult> {
  // Build 3-Layer Context
  const context = await buildFullContext(conversationId);
  if (!context) {
    throw new Error(`Conversation with ID ${conversationId} or associated customer not found.`);
  }

  // Extract latest incoming buyer turn
  const messages = context.turn.recentMessages;
  const lastCustomerMessage = [...messages]
    .reverse()
    .find((m) => m.senderType.code === 'buyer' || m.senderType.isHuman);

  const latestText = lastCustomerMessage?.text ?? 'Hello, I need assistance with my order.';

  // Resolve Intent Tier dynamically
  const resolved = resolveIntentTier(latestText, context.turn.detectedIntent?.code);
  console.log(
    `[RAG Orchestrator] Resolved Intent: ${resolved.code} | Tier: ${resolved.tier} (source: ${resolved.source})`,
  );

  // Load and filter retention strategies for the resolved tier
  const activeStrategies = await getActiveRetentionStrategies();
  const tierStrategies = filterStrategiesForTier(resolved.tier, activeStrategies);
  const allowedCodes = tierStrategies.map((s) => s.code);

  // Build Tiered Prompts
  let systemPrompt: string;
  if (resolved.tier === 'simple') {
    systemPrompt = buildLiteSystemPrompt(context, tierStrategies);
  } else if (resolved.tier === 'standard') {
    systemPrompt = buildStandardSystemPrompt(context, tierStrategies);
  } else {
    systemPrompt = buildSystemPrompt(context, tierStrategies);
  }

  const userPrompt = buildUserPrompt(latestText);

  // Select provider chain optimized for tier latency
  const tierProviders = getAvailableProvidersForTier(resolved.tier);

  // Generate LLM Output (Multi-Draft / Single-Draft)
  const rawResponse = await generateResponse(
    systemPrompt,
    userPrompt,
    allowedCodes,
    tierProviders,
  );

  // Validate Grounding & Safety across all strategy drafts
  const grounding = validateMultiDraftGrounding(rawResponse, context, activeStrategies);

  return {
    context,
    response: grounding.sanitizedResponse,
    grounding,
  };
}

export * from './contextBuilder';
export * from './groundingFacts';
export * from './strategyCatalog';
export * from './intentRouter';
export * from './llmService';
export * from './groundingValidator';
