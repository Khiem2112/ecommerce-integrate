'use client';

import { useMutation } from '@tanstack/react-query';
import type { MultiDraftRagDraft } from '@/types';

type GenerateResponse = {
  readonly success: boolean;
  readonly data?: MultiDraftRagDraft;
  readonly error?: string;
};

export function useRagGenerate() {
  return useMutation({
    mutationKey: ['rag-generate'],
    mutationFn: async (conversationId: number): Promise<MultiDraftRagDraft> => {
      const response = await fetch('/api/rag/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Unable to generate an AI response.');
      }
      return payload.data;
    },
  });
}

