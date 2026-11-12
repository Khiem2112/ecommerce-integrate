/**
 * Conversation Service — data access and persistence layer for conversation and message domain.
 * Supports injected transaction clients for composable transactions initiated by Server Actions.
 */

import type { Prisma, PlatformCatalog } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  DbClient,
  ConversationWithRelations,
  ConversationWithMessages,
  InboxConversationRecord,
  MessageWithSender,
} from '@/types';
import { withPlatform, withPlatforms } from '@/utils';

export type ConversationRagSnapshot = Prisma.ConversationGetPayload<{
  include: {
    intent: true;
    assignedAgent: true;
    status: true;
    escalationStatus: true;
    connection: {
      include: {
        platform: true;
      };
    };
    customer: {
      include: {
        vipTier: true;
        connection: {
          include: {
            platform: true;
          };
        };
      };
    };
  };
}> & {
  platformId: number;
  platform: PlatformCatalog;
  messages: MessageWithSender[];
  messageCount: number;
};

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
  connection: {
    include: {
      platform: true,
    },
  },
} as const;



async function findActiveConversationSnapshot(
  id: number,
  tx: DbClient,
): Promise<ConversationWithMessages | null> {
  const conv = await tx.conversation.findUnique({
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

  if (!conv || !conv.isActive || !conv.connection?.isActive) {
    return null;
  }

  return withPlatform(conv);
}

/** Fetch a single conversation by ID scoped strictly to an active tenant organization */
export async function getConversationById(
  id: number,
  organizationId: number,
  tx: DbClient = prisma,
): Promise<ConversationWithMessages | null> {
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return null;
  }

  const conv = await findActiveConversationSnapshot(id, tx);
  if (!conv || conv.connection?.organizationId !== organizationId) {
    return null;
  }

  return conv;
}

/** Fetch a single active conversation snapshot for trusted background system turns */
export async function getConversationByIdInternal(
  id: number,
  tx: DbClient = prisma,
): Promise<ConversationWithMessages | null> {
  return findActiveConversationSnapshot(id, tx);
}

/** Fetch bounded conversation header, customer, latest N active messages, and total active message count for RAG context */
export async function getConversationForRagContext(
  conversationId: number,
  messageLimit: number = 10,
  tx: DbClient = prisma,
  organizationId?: number,
): Promise<ConversationRagSnapshot | null> {
  if (
    organizationId !== undefined &&
    (!Number.isInteger(organizationId) || organizationId <= 0)
  ) {
    return null;
  }

  const conv = await tx.conversation.findUnique({
    where: { id: conversationId },
    include: {
      ...CONVERSATION_INCLUDE,
      customer: {
        include: {
          vipTier: true,
          connection: {
            include: {
              platform: true,
            },
          },
        },
      },
    },
  });

  if (!conv || !conv.isActive || !conv.connection?.isActive) {
    return null;
  }

  if (organizationId !== undefined && conv.connection.organizationId !== organizationId) {
    return null;
  }

  if (conv.customer && conv.customer.isActive === false) {
    return null;
  }

  const boundedLimit = Math.max(1, Math.trunc(messageLimit));
  const [recentMessages, messageCount] = await Promise.all([
    getConversationMessages(conversationId, boundedLimit, tx),
    tx.message.count({
      where: { conversationId, isActive: true },
    }),
  ]);

  return {
    ...withPlatform(conv),
    messages: recentMessages,
    messageCount,
  };
}

/** Fetch inbox conversations scoped strictly to an active tenant organization */
export async function getInboxConversations(
  filters: InboxConversationFilters = {},
  organizationId: number,
  tx: DbClient = prisma,
): Promise<InboxConversationRecord[]> {
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return [];
  }

  const searchQuery = filters.searchQuery?.trim();

  const conversations = await tx.conversation.findMany({
    where: {
      isActive: true,
      connection: {
        organizationId,
        isActive: true,
      },
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
              { customer: { displayName: { contains: searchQuery } } },
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
      aiDrafts: {
        where: { isActive: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return withPlatforms(conversations);
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

  const message = await tx.message.create({
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


  return message;
}

/** Look up the conversation to verify existence and resolve the response sender type code. */
export async function resolveResponseSenderTypeService(
  conversationId: number,
  tx: DbClient = prisma,
): Promise<string> {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId },
    include: { assignedAgent: true },
  });

  if (!conversation || !conversation.isActive) {
    throw new Error(`Conversation ${conversationId} was not found.`);
  }

  return conversation.assignedAgent
    ? `agent_${conversation.assignedAgent.code.replace('_agent', '')}`
    : 'seller';
}

/** Fetch all conversations for a customer (summaries only, no messages) */
export async function getConversationsByCustomerId(
  customerId: number,
  tx: DbClient = prisma,
): Promise<ConversationWithRelations[]> {
  const conversations = await tx.conversation.findMany({
    where: { customerId, isActive: true },
    include: CONVERSATION_INCLUDE,
    orderBy: { startedAt: 'desc' },
  });
  return withPlatforms(conversations);
}

/** Fetch unresolved (non-final status) conversations for a customer */
export async function getUnresolvedConversations(
  customerId: number,
  tx: DbClient = prisma,
): Promise<ConversationWithRelations[]> {
  const conversations = await tx.conversation.findMany({
    where: {
      customerId,
      isActive: true,
      status: { isFinal: false },
    },
    include: CONVERSATION_INCLUDE,
    orderBy: { startedAt: 'desc' },
  });
  return withPlatforms(conversations);
}

/** Count active unresolved (non-final status) conversations for a customer without loading full rows */
export async function getUnresolvedConversationCount(
  customerId: number,
  tx: DbClient = prisma,
): Promise<number> {
  return tx.conversation.count({
    where: {
      customerId,
      isActive: true,
      status: { isFinal: false },
    },
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

/** Check whether the customer has an active order within the specified recent day window */
export async function hasRecentCustomerOrderWithinDays(
  connectionId: number,
  customerId: number,
  days: number = 7,
  tx: DbClient = prisma,
): Promise<boolean> {
  if (typeof tx.order?.findFirst !== 'function') {
    return false;
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recentOrder = await tx.order.findFirst({
    where: {
      connectionId,
      customerId,
      isActive: true,
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  });

  return Boolean(recentOrder);
}
