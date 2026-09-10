/**
 * Conversation and message domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma, MessageType, PlatformCatalog } from '@prisma/client';

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
    connection: { include: { platform: true } };
  };
}> & {
  platform: PlatformCatalog;
};

/** Conversation with full message thread and customer inbox information */
type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: {
    intent: true;
    assignedAgent: true;
    status: true;
    escalationStatus: true;
    connection: { include: { platform: true } };
    customer: { include: { vipTier: true } };
    messages: { include: { senderType: true } };
  };
}> & {
  platform: PlatformCatalog;
};

/** Inbox conversation record with latest message and latest active ai draft */
type InboxConversationRecord = Prisma.ConversationGetPayload<{
  include: {
    intent: true;
    assignedAgent: true;
    status: true;
    escalationStatus: true;
    connection: { include: { platform: true } };
    customer: { include: { vipTier: true } };
    messages: { include: { senderType: true } };
    aiDrafts: true;
  };
}> & {
  platform: PlatformCatalog;
};

export type {
  MessageWithSender,
  ConversationWithRelations,
  ConversationWithMessages,
  InboxConversationRecord,
  MessageType,
};
