/**
 * Context Builder — assembles the 3-layer customer context for a conversation.
 *
 * TurnContext:       Current conversation messages + linked order + intent
 * CustomerDossier:   Customer profile (with VIP tier, metrics), service history
 * EvidenceContext:   Evidence-backed facts with confidence levels
 */

import {
  getConversationById,
  getUnresolvedConversations,
  getCustomerPastIntents,
  getConversationCount,
  getConversationMessages,
} from '@/services/conversationService';
import { getCustomerById, getCustomerEvidences } from '@/services/customerService';
import { getOrderById } from '@/services/orderService';
import type { TurnContext, CustomerDossier, EvidenceContext, FullCustomerContext } from '@/types';

const MAX_RECENT_MESSAGES = 10;
const MIN_EVIDENCE_CONFIDENCE = 0.5;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

/** Build the turn-level operational context */
async function buildTurnContext(conversationId: number): Promise<TurnContext | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return null;

  const recentMessages = await getConversationMessages(conversationId, MAX_RECENT_MESSAGES);

  const linkedOrder = conversation.orderId
    ? await getOrderById(conversation.orderId)
    : null;

  return {
    conversationId: conversation.id,
    recentMessages,
    linkedOrder,
    detectedIntent: conversation.intent,
    conversationPriority: conversation.priority,
    messageCount: conversation.messages.length,
  };
}

/** Build the customer behavioral dossier */
async function buildCustomerDossier(customerId: number): Promise<CustomerDossier | null> {
  const [customer, unresolvedConvs, pastIntents, totalCount] = await Promise.all([
    getCustomerById(customerId),
    getUnresolvedConversations(customerId),
    getCustomerPastIntents(customerId),
    getConversationCount(customerId),
  ]);

  if (!customer) return null;

  return {
    customer,
    unresolvedConversationCount: unresolvedConvs.length,
    pastIntents,
    totalConversationCount: totalCount,
  };
}

/** Build the evidence-backed facts context */
async function buildEvidenceContext(customerId: number): Promise<EvidenceContext> {
  const facts = await getCustomerEvidences(customerId, MIN_EVIDENCE_CONFIDENCE);
  const highConfidenceCount = facts.filter((f) => f.confidence >= HIGH_CONFIDENCE_THRESHOLD).length;

  return {
    facts,
    totalFactCount: facts.length,
    highConfidenceFactCount: highConfidenceCount,
  };
}

/**
 * Build the complete 3-layer customer context for a conversation.
 *
 * @param conversationId - The conversation to build context for
 * @returns FullCustomerContext or null if conversation/customer not found
 */
export async function buildFullContext(conversationId: number): Promise<FullCustomerContext | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return null;

  const customerId = conversation.customerId;

  const [turn, dossier, evidence] = await Promise.all([
    buildTurnContext(conversationId),
    buildCustomerDossier(customerId),
    buildEvidenceContext(customerId),
  ]);

  if (!turn || !dossier) return null;

  return { turn, dossier, evidence };
}
