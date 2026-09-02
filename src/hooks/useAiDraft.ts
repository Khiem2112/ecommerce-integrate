'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLatestAiDraftAction,
  fetchAiDraftDetailAction,
  fetchAiDraftHistoryAction,
  rejectAiDraftAction,
} from '@/actions/aiDraftActions';
import { saveAiResponseAction } from '@/actions/conversationActions';
import type {
  AiDraftDetailDto,
  AiDraftSummaryDto,
  RejectAiDraftInput,
  SaveAiResponseInput,
} from '@/types';

/** TanStack Query hook to fetch the latest AI draft for a conversation thread. */
export function useLatestAiDraft(conversationId: number | null) {
  return useQuery<AiDraftDetailDto | null>({
    queryKey: ['ai-draft', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await fetchLatestAiDraftAction(conversationId);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to fetch latest AI draft.');
      }
      return res.data ?? null;
    },
    enabled: conversationId !== null && conversationId > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/** TanStack Query hook to fetch a specific AI draft detail by draftId and conversationId. */
export function useAiDraftDetail(
  draftId: number | null,
  conversationId: number | null,
) {
  return useQuery<AiDraftDetailDto | null>({
    queryKey: ['ai-draft-detail', conversationId, draftId],
    queryFn: async () => {
      if (!draftId || !conversationId) return null;
      const res = await fetchAiDraftDetailAction(draftId, conversationId);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to fetch AI draft detail.');
      }
      return res.data ?? null;
    },
    enabled:
      conversationId !== null &&
      conversationId > 0 &&
      draftId !== null &&
      draftId > 0,
    staleTime: 60_000,
  });
}

/** TanStack Query hook to fetch the historical draft summaries for a conversation. */
export function useAiDraftHistory(conversationId: number | null) {
  return useQuery<AiDraftSummaryDto[]>({
    queryKey: ['ai-draft-history', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await fetchAiDraftHistoryAction(conversationId);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to fetch AI draft history.');
      }
      return res.data ?? [];
    },
    enabled: conversationId !== null && conversationId > 0,
    staleTime: 30_000,
  });
}

/** TanStack Mutation hook to reject a pending AI draft response. */
export function useRejectAiDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RejectAiDraftInput) => {
      const res = await rejectAiDraftAction(input);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to reject AI draft.');
      }
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-draft', variables.conversationId] });
      void queryClient.invalidateQueries({
        queryKey: ['ai-draft-history', variables.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['conversation', variables.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** TanStack Mutation hook to approve (apply) an AI draft and save the message internally. */
export function useApplyAiDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveAiResponseInput) => {
      const res = await saveAiResponseAction(input);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to save AI response.');
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-draft', variables.conversationId] });
      void queryClient.invalidateQueries({
        queryKey: ['ai-draft-history', variables.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['conversation', variables.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
