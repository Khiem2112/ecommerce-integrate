'use client';

import { useQuery } from '@tanstack/react-query';
import type { CustomerContext } from '@/types';

type ContextResponse = {
  readonly success: boolean;
  readonly data?: CustomerContext;
  readonly error?: string;
};

export function useCustomerContext(conversationId: number | null) {
  return useQuery({
    queryKey: ['context', conversationId],
    queryFn: async (): Promise<CustomerContext> => {
      const response = await fetch(`/api/rag/context?conversationId=${conversationId}`);
      const payload = (await response.json()) as ContextResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Unable to load customer context.');
      }
      return payload.data;
    },
    enabled: conversationId !== null,
    staleTime: 60_000,
  });
}
