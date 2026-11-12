/**
 * Conversation and message domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma, MessageType, PlatformCatalog } from '@prisma/client';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from './lazada';

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

/** Escalation audit log record with conversation and operator */
type EscalationAuditLogRecord = Prisma.EscalationAuditLogGetPayload<{
  include: {
    conversation: true;
    handledByUser: true;
  };
}>;

/** Fact catalog record with shop connection */
type FactCatalogRecord = Prisma.FactCatalogGetPayload<{
  include: {
    connection: true;
  };
}>;

/** Trigger sources that can cause an immediate escalation */
type EscalationTriggerSource =
  | 'grounding_failure'
  | 'sentiment_negative'
  | 'vip_dispute'
  | 'tool_error'
  | 'manual_operator';

/** Lifecycle status for autonomous chat sessions */
type SessionLifecycleStatus =
  | 'BOT_PROCESSING'
  | 'BOT_REPLIED'
  | 'ESCALATED_PENDING'
  | 'HUMAN_HANDLING'
  | 'RESOLVED'
  | 'CLOSED';

/** Actions an operator can trigger on an agent session */
type AgentSessionActionType =
  | 'takeover'
  | 'handback'
  | 'send_draft'
  | 'resolve';

/** Server-Sent Events payloads for real-time chat updates */
type ChatStreamEventMessageReceived = {
  type: 'chat:message_received';
  conversationId: number;
  messageId: number;
  platformMessageId: string;
  senderCode: string;
  messageType?: MessageType;
  text: string | null;
  mediaUrl?: string | null;
  referenceId?: string | null;
  status?: string | null;
  processMsg?: string | null;
  timestamp: Date | string;
};

type ChatStreamEventMessageUpdated = {
  type: 'chat:message_updated';
  conversationId: number;
  messageId: number;
  platformMessageId: string;
  status: string;
  text: string | null;
  processMsg?: string | null;
  timestamp: Date | string;
};

type ChatStreamEventSessionEscalated = {
  type: 'chat:session_escalated';
  auditLogId: number;
  conversationId: number;
  triggerSource: EscalationTriggerSource;
  confidenceScore: number;
  reasonSummary: string;
  suggestedDraft: string | null;
  priority: string;
  timestamp: Date | string;
};

type ChatStreamEventBotReplied = {
  type: 'chat:bot_replied';
  conversationId: number;
  messageId: number;
  text: string;
  groundedFacts: readonly string[];
  confidence: number;
  timestamp: Date | string;
};

type ChatStreamEventOperatorTakeover = {
  type: 'chat:operator_takeover';
  sessionId: string;
  conversationId: number;
  sellerAccountId: string;
};

type ChatStreamEventSessionUpdated = {
  type: 'chat:session_updated';
  sessionId: string;
  connectionId: number;
  conversationId?: number;
  unreadCount?: number;
  lastMessageTime?: Date | string;
};

type ChatStreamEventSessionResolved = {
  type: 'chat:session_resolved';
  auditLogId: number;
  conversationId: number;
  handledByUserId: number;
};

type ChatStreamEventPing = {
  type: 'ping';
  timestamp: string;
};

type ChatStreamEvent =
  | ChatStreamEventMessageReceived
  | ChatStreamEventMessageUpdated
  | ChatStreamEventSessionEscalated
  | ChatStreamEventBotReplied
  | ChatStreamEventOperatorTakeover
  | ChatStreamEventSessionUpdated
  | ChatStreamEventSessionResolved
  | ChatStreamEventPing;

export type {
  MessageWithSender,
  ConversationWithRelations,
  ConversationWithMessages,
  InboxConversationRecord,
  EscalationAuditLogRecord,
  FactCatalogRecord,
  EscalationTriggerSource,
  SessionLifecycleStatus,
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
  AgentSessionActionType,
  MessageType,
  ChatStreamEventMessageReceived,
  ChatStreamEventMessageUpdated,
  ChatStreamEventSessionEscalated,
  ChatStreamEventBotReplied,
  ChatStreamEventOperatorTakeover,
  ChatStreamEventSessionUpdated,
  ChatStreamEventSessionResolved,
  ChatStreamEventPing,
  ChatStreamEvent,
};
