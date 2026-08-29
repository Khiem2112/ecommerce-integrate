/**
 * Conversation Service — data access and persistence layer for conversation and message domain.
 * Supports injected transaction clients for composable transactions initiated by Server Actions.
 */

import { prisma } from '@/lib/prisma';
import type {
  DbClient,
  ConversationWithRelations,
  ConversationWithMessages,
  MessageWithSender,
} from '@/types';

export type InboxConversationFilters = {
  readonly statusCode?: string;
  readonly priority?: string;
  readonly searchQuery?: string;
};

/** Shared include for conversation classification/status relations */
const CONVERSATION_INCLUDE = {
  intent: true,
  assignedAgent: true,
  status: true,
  escalationStatus: true,
  platform: true,
} as const;

/** Fetch a single conversation by ID with messages */
export async function getConversationById(
  id: number,
  tx: DbClient = prisma,
): Promise<ConversationWithMessages | null> {
  return tx.conversation.findUnique({
    where: { id },
    include: {
      ...CONVERSATION_INCLUDE,
      customer: { include: { vipTier: true } },
      messages: {
        where: { isActive: true },
        include: { senderType: true },
        orderBy: { timestamp: 'asc' },
      },
    },
  });
}

/** Fetch inbox conversations with their customer and newest active message */
export async function getInboxConversations(
  filters: InboxConversationFilters = {},
  tx: DbClient = prisma,
): Promise<ConversationWithMessages[]> {
  const searchQuery = filters.searchQuery?.trim();

  return tx.conversation.findMany({
    where: {
      isActive: true,
      ...(filters.statusCode && filters.statusCode !== 'all'
        ? { status: { code: filters.statusCode } }
        : {}),
      ...(filters.priority && filters.priority !== 'all'
        ? { priority: filters.priority }
        : {}),
      ...(searchQuery
        ? {
            OR: [
              { customer: { platformBuyerId: { contains: searchQuery } } },
              { intent: { name: { contains: searchQuery } } },
              { messages: { some: { text: { contains: searchQuery }, isActive: true } } },
            ],
          }
        : {}),
    },
    include: {
      ...CONVERSATION_INCLUDE,
      customer: { include: { vipTier: true } },
      messages: {
        where: { isActive: true },
        include: { senderType: true },
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Persist a seller or AI-agent reply and return it with sender information */
export async function createConversationMessage(
  input: {
    readonly conversationId: number;
    readonly text: string;
    readonly senderTypeCode: string;
    readonly groundedFacts?: readonly string[];
    readonly ungroundedClaims?: readonly string[];
    readonly confidence?: number;
    readonly suggestedAction?: string;
  },
  tx: DbClient = prisma,
): Promise<MessageWithSender> {
  const senderType = await tx.senderType.findUnique({
    where: { code: input.senderTypeCode },
    select: { id: true },
  });

  if (!senderType) {
    throw new Error(`Sender type "${input.senderTypeCode}" was not found.`);
  }

  const persistMessage = async (client: DbClient) => {
    const message = await client.message.create({
      data: {
        conversationId: input.conversationId,
        senderTypeId: senderType.id,
        text: input.text,
        groundedFacts: input.groundedFacts ? [...input.groundedFacts] : undefined,
        ungroundedClaims: input.ungroundedClaims ? [...input.ungroundedClaims] : undefined,
        confidence: input.confidence,
        suggestedAction: input.suggestedAction,
      },
      include: { senderType: true },
    });

    await client.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  };

  // If already executing in a transaction client, run directly; otherwise wrap atomically
  if ('$transaction' in tx && typeof tx.$transaction === 'function') {
    return tx.$transaction((innerTx) => persistMessage(innerTx));
  }

  return persistMessage(tx);
}

/** Fetch all conversations for a customer (summaries only, no messages) */
export async function getConversationsByCustomerId(
  customerId: number,
  tx: DbClient = prisma,
): Promise<ConversationWithRelations[]> {
  return tx.conversation.findMany({
    where: { customerId, isActive: true },
    include: CONVERSATION_INCLUDE,
    orderBy: { startedAt: 'desc' },
  });
}

/** Fetch unresolved (non-final status) conversations for a customer */
export async function getUnresolvedConversations(
  customerId: number,
  tx: DbClient = prisma,
): Promise<ConversationWithRelations[]> {
  return tx.conversation.findMany({
    where: {
      customerId,
      isActive: true,
      status: { isFinal: false },
    },
    include: CONVERSATION_INCLUDE,
    orderBy: { startedAt: 'desc' },
  });
}

/** Fetch the most recent N messages for a conversation (chronological) */
export async function getConversationMessages(
  conversationId: number,
  limit: number = 10,
  tx: DbClient = prisma,
): Promise<MessageWithSender[]> {
  const messages = await tx.message.findMany({
    where: { conversationId, isActive: true },
    include: { senderType: true },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  // Reverse to return chronological order (oldest first)
  return messages.reverse();
}

/** Get distinct past intent codes for a customer */
export async function getCustomerPastIntents(
  customerId: number,
  tx: DbClient = prisma,
): Promise<string[]> {
  const conversations = await tx.conversation.findMany({
    where: {
      customerId,
      isActive: true,
      intentId: { not: null },
    },
    include: { intent: true },
    distinct: ['intentId'],
  });

  return conversations
    .map((c) => c.intent?.code)
    .filter((code): code is string => code != null);
}

/** Count total conversations for a customer */
export async function getConversationCount(
  customerId: number,
  tx: DbClient = prisma,
): Promise<number> {
  return tx.conversation.count({
    where: { customerId, isActive: true },
  });
}
