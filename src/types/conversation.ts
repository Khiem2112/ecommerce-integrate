/**
 * Conversation and message domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma, MessageType } from '@prisma/client';

/** Message with sender type relation */
type MessageWithSender = Prisma.MessageGetPayload<{
  include: { senderType: true };
}>;

/** Conversation with all classification/status relations (no messages) */
type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: {
    intent: true;
    assignedAgent: true;
    status: true;
    escalationStatus: true;
    platform: true;
  };
}>;

/** Conversation with full message thread and customer inbox information */
type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: {
    intent: true;
    assignedAgent: true;
    status: true;
    escalationStatus: true;
    platform: true;
    customer: { include: { vipTier: true } };
    messages: { include: { senderType: true } };
  };
}>;

export type {
  MessageWithSender,
  ConversationWithRelations,
  ConversationWithMessages,
  MessageType,
};
