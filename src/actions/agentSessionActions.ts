'use server';

import { revalidatePath } from 'next/cache';
import { appLogger } from '@/lib/logger';
import { getAuthenticatedSessionContextService } from '@/services/authentication/authSessionService';
import {
  takeoverConversationSession,
  sendOperatorMessage,
  handbackSessionToBot,
  resolveConversationSession,
  SessionExpiredError,
  ConversationNotFoundError,
  type TakeoverSessionResult,
  type HandbackSessionResult,
  type ResolveSessionResult,
} from '@/services/agentSessionService';
import {
  takeoverSessionSchema,
  sendApprovedDraftSchema,
  handbackToBotSchema,
  resolveSessionSchema,
  type TakeoverSessionInput,
  type SendApprovedDraftInput,
  type HandbackToBotInput,
  type ResolveSessionInput,
} from '@/forms/agentSessionFormSchema';
import type { ActionResponse, Message } from '@/types';

export async function takeoverSessionAction(
  rawInput: TakeoverSessionInput,
): Promise<ActionResponse<TakeoverSessionResult>> {
  try {
    const parseResult = takeoverSessionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const { conversationId } = parseResult.data;
    const session = await getAuthenticatedSessionContextService();
    const userId = session?.user?.id ?? null;

    const result = await takeoverConversationSession(conversationId, userId);

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to take over conversation session', error);
    if (error instanceof ConversationNotFoundError) {
      return { success: false, error: 'Conversation not found' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error while taking over session',
    };
  }
}

export async function sendApprovedDraftAction(
  rawInput: SendApprovedDraftInput,
): Promise<ActionResponse<Message>> {
  try {
    const parseResult = sendApprovedDraftSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const { conversationId, text, draftId } = parseResult.data;
    const session = await getAuthenticatedSessionContextService();
    const userId = session?.user?.id ?? null;

    const createdMessage = await sendOperatorMessage(
      conversationId,
      text,
      draftId,
      userId,
    );

    revalidatePath('/workspace');
    return {
      success: true,
      data: createdMessage,
    };
  } catch (error) {
    appLogger.error('Failed to send approved message', error);
    if (error instanceof SessionExpiredError) {
      return {
        success: false,
        error: 'Lazada chat session expired (5-day window). Cannot send new messages.',
      };
    }
    if (error instanceof ConversationNotFoundError) {
      return { success: false, error: 'Conversation not found' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error while sending message',
    };
  }
}

export async function handbackToBotAction(
  rawInput: HandbackToBotInput,
): Promise<ActionResponse<HandbackSessionResult>> {
  try {
    const parseResult = handbackToBotSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const { conversationId } = parseResult.data;
    const result = await handbackSessionToBot(conversationId);

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to hand back session control to bot', error);
    if (error instanceof ConversationNotFoundError) {
      return { success: false, error: 'Conversation not found' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error while handing back to bot',
    };
  }
}

export async function resolveSessionAction(
  rawInput: ResolveSessionInput,
): Promise<ActionResponse<ResolveSessionResult>> {
  try {
    const parseResult = resolveSessionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const { conversationId, resolutionNote = 'Resolved by operator', auditLogId } = parseResult.data;
    const session = await getAuthenticatedSessionContextService();
    const userId = session?.user?.id ?? 1;

    const result = await resolveConversationSession(
      conversationId,
      resolutionNote,
      userId,
      auditLogId,
    );

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to resolve conversation session', error);
    if (error instanceof ConversationNotFoundError) {
      return { success: false, error: 'Conversation not found' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error while resolving session',
    };
  }
}
