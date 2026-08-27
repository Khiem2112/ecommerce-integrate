/**
 * RAG Orchestrator — central entry point for generating grounded customer responses.
 *
 * Pipeline Flow:
 * 1. Assemble 3-layer customer context (TurnContext, CustomerDossier, EvidenceContext)
 * 2. Formulate system and user prompts with VIP handling and policy rules
 * 3. Generate structured response via multi-provider LLM service
 * 4. Validate output with grounding validator (anti-hallucination & PII check)
 * 5. Return safe, grounded response
 */

import { buildFullContext } from './contextBuilder';
import { getActiveRetentionStrategies } from './strategyCatalog';
import { generateResponse } from './llmService';
import {
  buildSystemPrompt,
  buildUserPrompt,
  validateMultiDraftGrounding,
} from '@/utils/rag';
import type { FullCustomerContext, MultiDraftGroundingResult, MultiDraftResponse } from '@/types';

export type GenerateGroundedResponseResult = {
  readonly context: FullCustomerContext;
  readonly response: MultiDraftResponse;
  readonly grounding: MultiDraftGroundingResult;
};

/**
 * Generate a grounded, personalized customer-care multi-draft response for a conversation.
 *
 * @param conversationId - The ID of the conversation to handle
 * @returns Result object containing context, generated multi-draft response, and grounding evaluation
 */
export async function generateGroundedResponse(
  conversationId: number,
): Promise<GenerateGroundedResponseResult> {
  // Build 3-Layer Context
  const context = await buildFullContext(conversationId);
  if (!context) {
    throw new Error(`Conversation with ID ${conversationId} or associated customer not found.`);
  }

  // Extract latest customer message
  const messages = context.turn.recentMessages;
  const lastCustomerMessage = [...messages]
    .reverse()
    .find((m) => m.senderType.code === 'buyer' || m.senderType.isHuman);

  const latestText = lastCustomerMessage?.text ?? 'Hello, I need assistance with my order.';

  // Load active retention strategies from database
  const activeStrategies = await getActiveRetentionStrategies();
  const allowedCodes = activeStrategies.map((s) => s.code);

  // Build Prompts
  const systemPrompt = buildSystemPrompt(context, activeStrategies);
  const userPrompt = buildUserPrompt(latestText);

  // Generate LLM Output (Multi-Draft)
  const rawResponse = await generateResponse(systemPrompt, userPrompt, allowedCodes);

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
export * from './llmService';
export * from '@/utils/rag';
