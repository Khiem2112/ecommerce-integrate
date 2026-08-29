'use server';

import { revalidatePath } from 'next/cache';
import {
  createConversationMessage,
  getConversationById,
  getInboxConversations,
} from '@/services/conversationService';
import {
  inboxFiltersSchema,
  sendMessageSchema,
  saveAiResponseSchema,
} from '@/forms/conversationForm';
import type {
  ActionResponse,
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

function toConversationSummary(
  conversation: Awaited<ReturnType<typeof getInboxConversations>>[number],
): ConversationSummary {
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

/** Retrieve the agent inbox list in a browser-safe format. */
export async function fetchInboxAction(
  filters: InboxFilters = {},
): Promise<ActionResponse<ConversationSummary[]>> {
  try {
    const parsed = inboxFiltersSchema.safeParse(filters);
    const validFilters = parsed.success ? parsed.data : {};
    const conversations = await getInboxConversations(validFilters);
    return { success: true, data: conversations.map(toConversationSummary) };
  } catch (error) {
    console.error('Error in fetchInboxAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch inbox conversations.',
    };
  }
}

/** Retrieve an active conversation thread with full messages. */
export async function fetchConversationAction(
  conversationId: number,
): Promise<ActionResponse<ConversationDetail | null>> {
  try {
    if (!conversationId || conversationId <= 0) {
      return { success: false, error: 'A valid conversation ID is required.' };
    }

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return { success: true, data: null };
    }

    const detail: ConversationDetail = {
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
      latestMessage: conversation.messages.at(-1)
        ? toWorkspaceMessage(conversation.messages.at(-1)!)
        : null,
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map(toWorkspaceMessage),
    };

    return { success: true, data: detail };
  } catch (error) {
    console.error('Error in fetchConversationAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch conversation details.',
    };
  }
}

/** Send a manually written seller reply. */
export async function sendMessageAction(
  conversationId: number,
  text: string,
): Promise<ActionResponse<WorkspaceMessage>> {
  try {
    const parsed = sendMessageSchema.safeParse({ conversationId, text });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
    }

    const message = await createConversationMessage({
      conversationId: parsed.data.conversationId,
      text: parsed.data.text,
      senderTypeCode: 'seller',
    });

    revalidatePath('/conversations');
    return { success: true, data: toWorkspaceMessage(message) };
  } catch (error) {
    console.error('Error in sendMessageAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to send message.',
    };
  }
}

/** Persist a reviewed AI co-pilot response with its grounding citations. */
export async function saveAiResponseAction(
  input: SaveAiResponseInput,
): Promise<ActionResponse<WorkspaceMessage>> {
  try {
    const parsed = saveAiResponseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
    }

    const conversation = await getConversationById(parsed.data.conversationId);
    if (!conversation) {
      return { success: false, error: `Conversation ${parsed.data.conversationId} was not found.` };
    }

    const senderTypeCode = conversation.assignedAgent
      ? `agent_${conversation.assignedAgent.code.replace('_agent', '')}`
      : 'seller';

    const message = await createConversationMessage({
      conversationId: parsed.data.conversationId,
      text: parsed.data.text,
      senderTypeCode,
      groundedFacts: parsed.data.groundedFactsUsed,
      ungroundedClaims: parsed.data.ungroundedClaims,
      confidence: parsed.data.confidence,
      suggestedAction: parsed.data.suggestedAction,
    });

    revalidatePath('/conversations');
    return { success: true, data: toWorkspaceMessage(message) };
  } catch (error) {
    console.error('Error in saveAiResponseAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to save AI response.',
    };
  }
}
