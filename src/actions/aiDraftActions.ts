'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  getLatestAiDraftService,
  getAiDraftDetailService,
  getAiDraftHistoryService,
  rejectAiDraftService,
} from '@/services/aiDraftService';
import { rejectAiDraftSchema } from '@/forms/aiDraftForm';
import type {
  ActionResponse,
  AiDraftDetailDto,
  AiDraftSummaryDto,
  RejectAiDraftInput,
} from '@/types';

/** Fetch the most recent AI draft response for a conversation thread. */
export async function fetchLatestAiDraftAction(
  conversationId: number,
): Promise<ActionResponse<AiDraftDetailDto | null>> {
  try {
    if (!conversationId || conversationId <= 0) {
      return { success: false, error: 'A valid conversation ID is required.' };
    }

    const draft = await getLatestAiDraftService(conversationId);
    return { success: true, data: draft };
  } catch (error) {
    console.error('Error in fetchLatestAiDraftAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch latest AI draft.',
    };
  }
}

/** Fetch a specific historical AI draft detail by ID and conversation ID. */
export async function fetchAiDraftDetailAction(
  draftId: number,
  conversationId: number,
): Promise<ActionResponse<AiDraftDetailDto | null>> {
  try {
    if (!draftId || draftId <= 0 || !conversationId || conversationId <= 0) {
      return { success: false, error: 'Valid draft and conversation IDs are required.' };
    }

    const draft = await getAiDraftDetailService(draftId, conversationId);
    return { success: true, data: draft };
  } catch (error) {
    console.error('Error in fetchAiDraftDetailAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch AI draft detail.',
    };
  }
}

/** Fetch all historical AI draft summaries for a conversation. */
export async function fetchAiDraftHistoryAction(
  conversationId: number,
): Promise<ActionResponse<AiDraftSummaryDto[]>> {
  try {
    if (!conversationId || conversationId <= 0) {
      return { success: false, error: 'A valid conversation ID is required.' };
    }

    const history = await getAiDraftHistoryService(conversationId);
    return { success: true, data: history };
  } catch (error) {
    console.error('Error in fetchAiDraftHistoryAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch AI draft history.',
    };
  }
}

/** Reject a pending AI draft response with a recorded reason. */
export async function rejectAiDraftAction(
  input: RejectAiDraftInput,
): Promise<ActionResponse<void>> {
  try {
    const parsed = rejectAiDraftSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
    }

    await prisma.$transaction(async (tx) => {
      await rejectAiDraftService(
        parsed.data.draftId,
        {
          conversationId: parsed.data.conversationId,
          rejectionReason: parsed.data.rejectionReason,
        },
        tx,
      );
    });

    revalidatePath('/conversations');
    return { success: true };
  } catch (error) {
    console.error('Error in rejectAiDraftAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to reject AI draft.',
    };
  }
}
