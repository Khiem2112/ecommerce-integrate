/**
 * Context Builder — assembles the 3-layer customer context for a conversation.
 *
 * TurnContext:       Current conversation messages + linked order + intent
 * CustomerDossier:   Customer profile (with VIP tier, metrics), service history
 * EvidenceContext:   Evidence-backed facts with confidence levels
 */

import { prisma } from '@/lib/prisma';
import {
  getConversationById,
  getUnresolvedConversations,
  getCustomerPastIntents,
  getConversationCount,
} from '@/services/conversationService';
import { getCustomerById, getCustomerEvidences } from '@/services/customerService';
import { getOrderById } from '@/services/orderService';
import type {
  TurnContext,
  CustomerDossier,
  EvidenceContext,
  FullCustomerContext,
  ConversationWithMessages,
  DbClient,
} from '@/types';

const MAX_RECENT_MESSAGES = 10;
const MIN_EVIDENCE_CONFIDENCE = 0.5;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

/** Build the turn-level operational context from a pre-loaded conversation snapshot */
async function buildTurnContext(
  conversation: ConversationWithMessages,
  tx: DbClient = prisma,
): Promise<TurnContext> {
  const recentMessages = conversation.messages.slice(-MAX_RECENT_MESSAGES);

  const linkedOrder = conversation.orderId
    ? await getOrderById(conversation.orderId, tx)
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
async function buildCustomerDossier(
  customerId: number,
  tx: DbClient = prisma,
): Promise<CustomerDossier | null> {
  const [customer, unresolvedConvs, pastIntents, totalCount] = await Promise.all([
    getCustomerById(customerId, tx),
    getUnresolvedConversations(customerId, tx),
    getCustomerPastIntents(customerId, tx),
    getConversationCount(customerId, tx),
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
async function buildEvidenceContext(
  customerId: number,
  tx: DbClient = prisma,
): Promise<EvidenceContext> {
  const facts = await getCustomerEvidences(customerId, MIN_EVIDENCE_CONFIDENCE, tx);
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
 * @param tx - Optional database transaction client
 * @returns FullCustomerContext or null if conversation/customer not found
 */
export async function buildFullContext(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<FullCustomerContext | null> {
  const conversation = await getConversationById(conversationId, tx);
  if (!conversation) return null;

  const customerId = conversation.customerId;

  const [turn, dossier, evidence] = await Promise.all([
    buildTurnContext(conversation, tx),
    buildCustomerDossier(customerId, tx),
    buildEvidenceContext(customerId, tx),
  ]);

  if (!turn || !dossier) return null;

  return { turn, dossier, evidence };
}
