'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export function useQueryFilters<T extends Record<string, string | number | boolean | undefined>>(
  defaultFilters: T,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const serializedDefaults = useMemo(() => JSON.stringify(defaultFilters), [defaultFilters]);

  const filters = useMemo(() => {
    const paramsObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      paramsObj[key] = val;
    });

    const parsedDefaults = JSON.parse(serializedDefaults) as T;
    const merged = { ...parsedDefaults } as Record<string, unknown>;
    Object.keys(parsedDefaults).forEach((key) => {
      if (paramsObj[key] !== undefined) {
        const defaultVal = parsedDefaults[key];
        if (typeof defaultVal === 'number') {
          const num = Number(paramsObj[key]);
          merged[key] = Number.isNaN(num) ? defaultVal : num;
        } else if (typeof defaultVal === 'boolean') {
          merged[key] = paramsObj[key] === 'true';
        } else {
          merged[key] = paramsObj[key];
        }
      }
    });

    return merged as T;
  }, [searchParams, serializedDefaults]);

  const setFilters = useCallback(
    (newFilters: Partial<T> | ((prev: T) => Partial<T>)) => {
      const updated = typeof newFilters === 'function' ? newFilters(filters) : newFilters;
      const merged = { ...filters, ...updated };
      const params = new URLSearchParams();

      Object.entries(merged).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [filters, pathname, router],
  );

  const resetFilters = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  return { filters, setFilters, resetFilters };
}
