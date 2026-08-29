'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchConversationAction } from '@/actions/conversationActions';

export function useConversationDetail(conversationId: number | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const res = await fetchConversationAction(conversationId!);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to load conversation detail.');
      }
      return res.data ?? null;
    },
    enabled: conversationId !== null,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}
