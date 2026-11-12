'use server';

import { revalidatePath } from 'next/cache';
import { appLogger } from '@/lib/logger';
import { getAuthenticatedSessionContextService } from '@/services/authentication/authSessionService';
import {
  getConversationById,
  getInboxConversations,
  hasRecentCustomerOrderWithinDays,
} from '@/services/conversationService';
import {
  sendOperatorMessage,
  classifyOutboundSessionError,
} from '@/services/agentSessionService';
import { triggerManualLazadaChatHistorySyncService } from '@/services/connectors';
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
  SyncLazadaChatHistoryResult,
  WorkspaceMessage,
} from '@/types';

const RECENT_ORDER_WINDOW_DAYS = 7;

function serializeJsonArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function toWorkspaceMessage(message: {
  id: number;
  text: string | null;
  messageType?: string;
  status?: string | null;
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
    messageType: message.messageType ?? 'TEXT',
    status: message.status ?? null,
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
  const latestDraft = conversation.aiDrafts?.[0] ?? null;
  const latestMsg = conversation.messages[0];
  const isOutdated =
    latestDraft &&
    latestDraft.status === 'pending' &&
    latestMsg &&
    latestMsg.senderType.code === 'buyer' &&
    latestDraft.triggerMessageId !== null &&
    latestDraft.triggerMessageId !== latestMsg.id;

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
    platformCode: conversation.connection?.platform?.code ?? conversation.platform?.code,
    status: { code: conversation.status.code, name: conversation.status.name },
    assignedAgentName: conversation.assignedAgent?.name ?? null,
    humanApprovalRequired: conversation.humanApprovalRequired,
    unreadCount: conversation.unreadCount,
    latestMessage: latestMsg ? toWorkspaceMessage(latestMsg) : null,
    latestDraft: latestDraft
      ? {
          status: latestDraft.status,
          recommendedStrategyCode: latestDraft.recommendedStrategyCode,
          selectedStrategyCode: latestDraft.selectedStrategyCode,
          isOutdated: Boolean(isOutdated),
        }
      : null,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function resolveAuthorizedActor(): Promise<
  | {
      readonly ok: true;
      readonly userId: number;
      readonly organizationId: number;
      readonly roleCode: string | null;
    }
  | { readonly ok: false; readonly response: ActionResponse<never> }
> {
  const session = await getAuthenticatedSessionContextService();
  const userId = session?.user?.id;
  const organizationId = session?.activeOrganization?.organizationId;
  if (!userId || organizationId == null) {
    return {
      ok: false,
      response: {
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Unauthorized',
      },
    };
  }
  return {
    ok: true,
    userId,
    organizationId,
    roleCode: session?.user?.role ?? null,
  };
}

/** Retrieve the agent inbox list in a browser-safe format. */
export async function fetchInboxAction(
  filters: InboxFilters = {},
): Promise<ActionResponse<ConversationSummary[]>> {
  try {
    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const parsed = inboxFiltersSchema.safeParse(filters);
    const validFilters = parsed.success ? parsed.data : {};
    const conversations = await getInboxConversations(validFilters, auth.organizationId);
    return { success: true, data: conversations.map(toConversationSummary) };
  } catch (error) {
    appLogger.error('Error in fetchInboxAction', error);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
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
      return {
        success: false,
        code: 'INVALID_INPUT',
        error: 'A valid conversation ID is required.',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const conversation = await getConversationById(conversationId, auth.organizationId);
    if (!conversation) {
      return { success: true, data: null };
    }

    const latestBuyerMsg = [...conversation.messages]
      .reverse()
      .find((msg) => msg.senderType.code === 'buyer');
    const effectiveBuyerTimestamp =
      latestBuyerMsg?.timestamp ??
      (conversation.messages.length === 0 ? conversation.lastMessageTime : null);

    const hasRecentOrder = await hasRecentCustomerOrderWithinDays(
      conversation.connectionId,
      conversation.customerId,
      RECENT_ORDER_WINDOW_DAYS,
    );

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
      platformCode: conversation.connection?.platform?.code ?? conversation.platform?.code,
      status: { code: conversation.status.code, name: conversation.status.name },
      assignedAgentName: conversation.assignedAgent?.name ?? null,
      humanApprovalRequired: conversation.humanApprovalRequired,
      unreadCount: conversation.unreadCount,
      lastBuyerMessageTime: effectiveBuyerTimestamp
        ? effectiveBuyerTimestamp.toISOString()
        : null,
      hasRecentOrderWithin7Days: hasRecentOrder,
      latestMessage: conversation.messages.at(-1)
        ? toWorkspaceMessage(conversation.messages.at(-1)!)
        : null,
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map(toWorkspaceMessage),
    };

    return { success: true, data: detail };
  } catch (error) {
    appLogger.error('Error in fetchConversationAction', error);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      error: error instanceof Error ? error.message : 'Unable to fetch conversation details.',
    };
  }
}

/** Send a manually written seller reply through unified outbound delivery. */
export async function sendMessageAction(
  conversationId: number,
  text: string,
): Promise<ActionResponse<WorkspaceMessage>> {
  try {
    const parsed = sendMessageSchema.safeParse({ conversationId, text });
    if (!parsed.success) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const message = await sendOperatorMessage(
      parsed.data.conversationId,
      parsed.data.text,
      {
        operatorUserId: auth.userId,
        organizationId: auth.organizationId,
      },
    );

    revalidatePath('/conversations');
    revalidatePath('/workspace');
    return { success: true, data: toWorkspaceMessage(message) };
  } catch (error) {
    appLogger.error('Error in sendMessageAction', error);
    const mapped = classifyOutboundSessionError(error, 'Unable to send message.');
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

/** Approve and deliver a reviewed AI co-pilot response to the marketplace channel. */
export async function saveAiResponseAction(
  input: SaveAiResponseInput,
): Promise<ActionResponse<WorkspaceMessage>> {
  try {
    const parsed = saveAiResponseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const {
      draftId,
      selectedStrategyCode,
      customDraftText,
      conversationId,
      text,
    } = parsed.data;

    const message = await sendOperatorMessage(conversationId, text ?? '', {
      draftId,
      operatorUserId: auth.userId,
      organizationId: auth.organizationId,
      selectedStrategyCode,
      customDraftText:
        customDraftText !== undefined ? customDraftText : (text ?? null),
      approvedById: String(auth.userId),
    });

    revalidatePath('/conversations');
    revalidatePath('/workspace');
    return { success: true, data: toWorkspaceMessage(message) };
  } catch (error) {
    appLogger.error('Error in saveAiResponseAction', error);
    const mapped = classifyOutboundSessionError(error, 'Unable to save AI response.');
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

/** Trigger manual Lazada chat history recovery sync with per-shop Redis cooldown protection. */
export async function syncShopChatHistoryAction(
  connectionId: number,
): Promise<ActionResponse<SyncLazadaChatHistoryResult>> {
  try {
    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    if (!Number.isInteger(connectionId) || connectionId <= 0) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        error: 'A valid shop connection ID is required.',
      };
    }

    const result = await triggerManualLazadaChatHistorySyncService({
      connectionId,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      actorRoleCode: auth.roleCode,
    });

    if (result.success) {
      revalidatePath('/conversations');
      revalidatePath('/workspace');
    }

    return result;
  } catch (error) {
    appLogger.error('Error in syncShopChatHistoryAction', error);
    return {
      success: false,
      code: 'SYSTEM_ERROR',
      error:
        error instanceof Error
          ? error.message
          : 'Unable to synchronize shop chat history.',
    };
  }
}
