'use client';

import { useCallback, useState } from 'react';

export function useClipboard({ timeout = 2000 }: { readonly timeout?: number } = {}) {
  const [hasCopied, setHasCopied] = useState(false);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!navigator?.clipboard) return false;
      try {
        await navigator.clipboard.writeText(text);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), timeout);
        return true;
      } catch {
        return false;
      }
    },
    [timeout],
  );

  return { copy, hasCopied };
}
