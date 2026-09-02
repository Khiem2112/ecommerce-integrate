'use client';

import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';

export type BreadcrumbItem = {
  readonly label: string;
  readonly href?: string;
};

export const breadcrumbAtom = atom<readonly BreadcrumbItem[]>([]);

/** Read-only hook for displaying breadcrumbs (used by Header/Breadcrumb molecule) */
export const useBreadcrumbValue = () => useAtomValue(breadcrumbAtom);

/** Write-only action hook (standard TMS pattern: does not cause caller to re-render) */
export function useBreadcrumb() {
  const setBreadcrumbs = useSetAtom(breadcrumbAtom);

  const setBreadcrumb = useCallback(
    (items: readonly BreadcrumbItem[]) => {
      setBreadcrumbs(items);
    },
    [setBreadcrumbs],
  );

  const clearBreadcrumb = useCallback(() => {
    setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  return { setBreadcrumb, clearBreadcrumb };
}
