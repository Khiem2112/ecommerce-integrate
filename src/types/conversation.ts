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

/** Raw webhook message push payload from Lazada IM Open API */
type LazadaPushMessagePayload = {
  session_id: string;
  message_id: string;
  content: string;
  from_account_id: string;
  from_account_type: number;
  send_time: number;
  template_id: number;
  to_account_id: string;
  to_account_type: number;
  type: number;
  site_id: string;
  process_msg?: string;
  auto_reply?: boolean;
  status?: number;
};

/** Raw webhook session update push payload from Lazada IM Open API */
type LazadaPushSessionUpdatePayload = {
  sync_type: string;
  user_account_id: string;
  user_account_type: number;
  last_message_id?: string;
  unread_count?: number;
  last_message_time?: number;
  session_id?: string;
};

/** Actions an operator can trigger on an agent session */
type AgentSessionActionType =
  | 'takeover'
  | 'handback'
  | 'send_draft'
  | 'resolve';

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
};
