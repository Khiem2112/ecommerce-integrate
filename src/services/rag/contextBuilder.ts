/**
 * Context Builder — assembles the 3-layer customer context for a conversation.
 *
 * TurnContext:       Current conversation messages + linked order + intent
 * CustomerDossier:   Customer profile (with VIP tier, metrics), service history
 * EvidenceContext:   Evidence-backed facts with confidence levels
 */

import { prisma } from '@/lib/prisma';
import {
  getConversationForRagContext,
  getUnresolvedConversationCount,
  getCustomerPastIntents,
  getConversationCount,
  type ConversationRagSnapshot,
} from '@/services/conversationService';
import { getCustomerById, getCustomerEvidences } from '@/services/customerService';
import { getOrderForRagContextService } from '@/services/orderService';
import { withPlatform } from '@/utils';
import type {
  TurnContext,
  CustomerDossier,
  EvidenceContext,
  FullCustomerContext,
  CustomerWithRelations,
  DbClient,
} from '@/types';

const MAX_RECENT_MESSAGES = 10;
const MIN_EVIDENCE_CONFIDENCE = 0.5;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

/** Build the turn-level operational context from a bounded conversation snapshot */
async function buildTurnContext(
  conversation: ConversationRagSnapshot,
  tx: DbClient = prisma,
): Promise<TurnContext> {
  const recentMessages = conversation.messages.slice(-MAX_RECENT_MESSAGES);

  const linkedOrder = conversation.orderId
    ? await getOrderForRagContextService(conversation.orderId, tx)
    : null;

  return {
    conversationId: conversation.id,
    recentMessages,
    linkedOrder,
    detectedIntent: conversation.intent,
    conversationPriority: conversation.priority,
    messageCount: conversation.messageCount,
  };
}

/** Build the customer behavioral dossier */
async function buildCustomerDossier(
  customerId: number,
  preloadedCustomer: CustomerWithRelations | null,
  tx: DbClient = prisma,
): Promise<CustomerDossier | null> {
  const [customer, unresolvedConversationCount, pastIntents, totalConversationCount] =
    await Promise.all([
      preloadedCustomer ? Promise.resolve(preloadedCustomer) : getCustomerById(customerId, tx),
      getUnresolvedConversationCount(customerId, tx),
      getCustomerPastIntents(customerId, tx),
      getConversationCount(customerId, tx),
    ]);

  if (!customer) return null;

  return {
    customer,
    unresolvedConversationCount,
    pastIntents,
    totalConversationCount,
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
 * @param organizationIdOrTx - Tenant organization ID or optional database transaction client
 * @param maybeTx - Optional database transaction client when organizationId is provided
 * @returns FullCustomerContext or null if conversation/customer not found
 */
export async function buildFullContext(
  conversationId: number,
  organizationIdOrTx: number | DbClient = prisma,
  maybeTx?: DbClient,
): Promise<FullCustomerContext | null> {
  const organizationId =
    typeof organizationIdOrTx === 'number' ? organizationIdOrTx : undefined;
  const tx: DbClient =
    typeof organizationIdOrTx === 'number' ? (maybeTx ?? prisma) : organizationIdOrTx;

  const conversation = await getConversationForRagContext(
    conversationId,
    MAX_RECENT_MESSAGES,
    tx,
    organizationId,
  );
  if (!conversation) return null;

  if (conversation.customer && conversation.customer.isActive === false) {
    return null;
  }

  const customerId = conversation.customerId;
  const preloadedCustomer: CustomerWithRelations | null =
    conversation.customer?.isActive && conversation.customer.connection?.platform
      ? withPlatform(conversation.customer)
      : null;

  const [turn, dossier, evidence] = await Promise.all([
    buildTurnContext(conversation, tx),
    buildCustomerDossier(customerId, preloadedCustomer, tx),
    buildEvidenceContext(customerId, tx),
  ]);

  if (!turn || !dossier) return null;

  return { turn, dossier, evidence };
}
