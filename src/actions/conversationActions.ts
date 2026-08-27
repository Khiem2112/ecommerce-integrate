'use server';

import {
  createConversationMessage,
  getConversationById,
  getInboxConversations,
} from '@/services/conversationService';
import type {
  ConversationDetail,
  ConversationSummary,
  InboxFilters,
  SaveAiResponseInput,
  WorkspaceMessage,
} from '@/types';

function serializeJsonArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toWorkspaceMessage(message: {
  id: number;
  text: string | null;
  messageType: string;
  timestamp: Date;
  confidence: number | null;
  groundedFacts: unknown;
  ungroundedClaims: unknown;
  suggestedAction: string | null;
  senderType: {
    code: string;
    name: string;
    isHuman: boolean;
    isAgent: boolean;
  };
}): WorkspaceMessage {
  return {
    id: message.id,
    senderCode: message.senderType.code,
    senderName: message.senderType.name,
    isHuman: message.senderType.isHuman,
    isAgent: message.senderType.isAgent,
    messageType: message.messageType,
    text: message.text,
    timestamp: message.timestamp.toISOString(),
    confidence: message.confidence,
    groundedFacts: serializeJsonArray(message.groundedFacts),
    ungroundedClaims: serializeJsonArray(message.ungroundedClaims),
    suggestedAction: message.suggestedAction,
  };
}

function toConversationSummary(conversation: Awaited<ReturnType<typeof getInboxConversations>>[number]): ConversationSummary {
  return {
    id: conversation.id,
    customerId: conversation.customerId,
    customerIdentifier: conversation.customer.platformBuyerId,
    vipTierCode: conversation.customer.vipTier.code,
    vipTierName: conversation.customer.vipTier.name,
    intent: conversation.intent
      ? { code: conversation.intent.code, name: conversation.intent.name }
      : null,
    priority: conversation.priority,
    status: { code: conversation.status.code, name: conversation.status.name },
    assignedAgentName: conversation.assignedAgent?.name ?? null,
    humanApprovalRequired: conversation.humanApprovalRequired,
    latestMessage: conversation.messages[0] ? toWorkspaceMessage(conversation.messages[0]) : null,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

/** Retrieve the agent inbox in a browser-safe format. */
export async function fetchInboxAction(filters: InboxFilters = {}): Promise<ConversationSummary[]> {
  const conversations = await getInboxConversations(filters);
  return conversations.map(toConversationSummary);
}

/** Retrieve an active conversation thread in a browser-safe format. */
export async function fetchConversationAction(conversationId: number): Promise<ConversationDetail | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return null;

  return {
    id: conversation.id,
    customerId: conversation.customerId,
    customerIdentifier: conversation.customer.platformBuyerId,
    vipTierCode: conversation.customer.vipTier.code,
    vipTierName: conversation.customer.vipTier.name,
    intent: conversation.intent
      ? { code: conversation.intent.code, name: conversation.intent.name }
      : null,
    priority: conversation.priority,
    status: { code: conversation.status.code, name: conversation.status.name },
    assignedAgentName: conversation.assignedAgent?.name ?? null,
    humanApprovalRequired: conversation.humanApprovalRequired,
    latestMessage: conversation.messages.at(-1) ? toWorkspaceMessage(conversation.messages.at(-1)!) : null,
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map(toWorkspaceMessage),
  };
}

/** Send a manually written seller reply. */
export async function sendMessageAction(conversationId: number, text: string): Promise<WorkspaceMessage> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('A message cannot be empty.');
  }

  const message = await createConversationMessage({
    conversationId,
    text: normalizedText,
    senderTypeCode: 'seller',
  });

  return toWorkspaceMessage(message);
}

/** Persist a reviewed AI response with its grounding metadata. */
export async function saveAiResponseAction(input: SaveAiResponseInput): Promise<WorkspaceMessage> {
  const normalizedText = input.text.trim();
  if (!normalizedText) {
    throw new Error('An AI response cannot be empty.');
  }

  const conversation = await getConversationById(input.conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${input.conversationId} was not found.`);
  }

  const senderTypeCode = conversation.assignedAgent
    ? `agent_${conversation.assignedAgent.code.replace('_agent', '')}`
    : 'seller';

  const message = await createConversationMessage({
    conversationId: input.conversationId,
    text: normalizedText,
    senderTypeCode,
    groundedFacts: input.groundedFactsUsed,
    ungroundedClaims: input.ungroundedClaims,
    confidence: input.confidence,
    suggestedAction: input.suggestedAction,
  });

  return toWorkspaceMessage(message);
}
