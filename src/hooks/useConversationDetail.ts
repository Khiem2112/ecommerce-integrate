'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchConversationAction } from '@/actions/conversationActions';

export function useConversationDetail(conversationId: number | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => fetchConversationAction(conversationId!),
    enabled: conversationId !== null,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}
