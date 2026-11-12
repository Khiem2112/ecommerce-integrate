'use server';

import { revalidatePath } from 'next/cache';
import { appLogger } from '@/lib/logger';
import { getAuthenticatedSessionContextService } from '@/services/authentication/authSessionService';
import {
  takeoverConversationSession,
  sendOperatorMessage,
  handbackSessionToBot,
  resolveConversationSession,
  markConversationAsRead,
  classifyOutboundSessionError,
  type TakeoverSessionResult,
  type HandbackSessionResult,
  type ResolveSessionResult,
  type MarkConversationReadResult,
} from '@/services/agentSessionService';
import {
  takeoverSessionSchema,
  sendApprovedDraftSchema,
  handbackToBotSchema,
  resolveSessionSchema,
  markConversationReadSchema,
  type TakeoverSessionInput,
  type SendApprovedDraftInput,
  type HandbackToBotInput,
  type ResolveSessionInput,
  type MarkConversationReadInput,
} from '@/forms/agentSessionFormSchema';
import type { ActionResponse, Message } from '@/types';

async function resolveAuthorizedActor(): Promise<
  | { readonly ok: true; readonly userId: number; readonly organizationId: number }
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
  return { ok: true, userId, organizationId };
}

export async function takeoverSessionAction(
  rawInput: TakeoverSessionInput,
): Promise<ActionResponse<TakeoverSessionResult>> {
  try {
    const parseResult = takeoverSessionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const { conversationId } = parseResult.data;
    const result = await takeoverConversationSession(
      conversationId,
      auth.userId,
      auth.organizationId,
    );

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to take over conversation session', error);
    const mapped = classifyOutboundSessionError(
      error,
      'System error while taking over session',
    );
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
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
        code: 'INVALID_INPUT',
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const {
      conversationId,
      text,
      draftId,
      selectedStrategyCode,
      customDraftText,
    } = parseResult.data;

    const createdMessage = await sendOperatorMessage(conversationId, text, {
      draftId,
      selectedStrategyCode,
      customDraftText,
      operatorUserId: auth.userId,
      organizationId: auth.organizationId,
      approvedById: String(auth.userId),
    });

    revalidatePath('/workspace');
    return {
      success: true,
      data: createdMessage,
    };
  } catch (error) {
    appLogger.error('Failed to send approved message', error);
    const mapped = classifyOutboundSessionError(
      error,
      'System error while sending message',
    );
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
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
        code: 'INVALID_INPUT',
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const { conversationId } = parseResult.data;
    const result = await handbackSessionToBot(conversationId, auth.organizationId);

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to hand back session control to bot', error);
    const mapped = classifyOutboundSessionError(
      error,
      'System error while handing back to bot',
    );
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
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
        code: 'INVALID_INPUT',
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const { conversationId, resolutionNote = 'Resolved by operator', auditLogId } =
      parseResult.data;

    const result = await resolveConversationSession(
      conversationId,
      resolutionNote,
      auth.userId,
      auditLogId,
      auth.organizationId,
    );

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to resolve conversation session', error);
    const mapped = classifyOutboundSessionError(
      error,
      'System error while resolving session',
    );
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

export async function markConversationReadAction(
  rawInput: MarkConversationReadInput,
): Promise<ActionResponse<MarkConversationReadResult>> {
  try {
    const parseResult = markConversationReadSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        error: parseResult.error.issues[0]?.message || 'Invalid input data',
      };
    }

    const auth = await resolveAuthorizedActor();
    if (!auth.ok) {
      return auth.response;
    }

    const result = await markConversationAsRead(
      parseResult.data.conversationId,
      auth.organizationId,
    );

    revalidatePath('/workspace');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    appLogger.error('Failed to mark conversation as read', error);
    const mapped = classifyOutboundSessionError(
      error,
      'System error while marking conversation as read',
    );
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}
