'use client';

import { useEffect, useState } from 'react';

const FLASH_KEY = 'ECOMMERCE_FLASHING_ORDER_ID';

export function setFlashingId(id: string | number): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(FLASH_KEY, String(id));
  }
}

export function useFlashingRow(timeout: number = 3000) {
  const [flashingId, setFlashingIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(FLASH_KEY);
      if (stored) {
        setFlashingIdState(stored);
        sessionStorage.removeItem(FLASH_KEY);

        const timer = setTimeout(() => {
          setFlashingIdState(null);
        }, timeout);

        return () => {
          clearTimeout(timer);
        };
      }
    }
  }, [timeout]);

  return {
    flashingId,
    isFlashing: (id: string | number): boolean => String(id) === flashingId,
  };
}
