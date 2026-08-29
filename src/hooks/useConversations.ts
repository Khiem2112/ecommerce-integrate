'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInboxAction } from '@/actions/conversationActions';
import type { InboxFilters } from '@/types';

export function useConversations(filters: InboxFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: async () => {
      const res = await fetchInboxAction(filters);
      if (!res.success) {
        throw new Error(res.error ?? 'Unable to load conversations.');
      }
      return res.data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
