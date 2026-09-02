'use client';

import { useCallback, useState } from 'react';

export function useModalState<T extends string>() {
  const [openModals, setOpenModals] = useState<Set<T>>(new Set());

  const isOpen = useCallback((modal: T) => openModals.has(modal), [openModals]);

  const open = useCallback((modal: T) => {
    setOpenModals((prev) => new Set(prev).add(modal));
  }, []);

  const close = useCallback((modal: T) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      next.delete(modal);
      return next;
    });
  }, []);

  const toggle = useCallback((modal: T) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      if (next.has(modal)) {
        next.delete(modal);
      } else {
        next.add(modal);
      }
      return next;
    });
  }, []);

  return { isOpen, open, close, toggle };
}
