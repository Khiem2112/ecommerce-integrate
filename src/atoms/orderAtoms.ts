import { atom } from 'jotai';

export type OrderLocalFilterState = {
  platformId?: number;
  statusId?: number;
};

export const initialOrderLocalFilters: OrderLocalFilterState = {
  platformId: undefined,
  statusId: undefined,
};

/**
 * In-memory Jotai atom preserving platform and status filter selections
 * across page transitions (e.g., navigating to order detail and returning).
 */
export const orderLocalFiltersAtom = atom<OrderLocalFilterState>(initialOrderLocalFilters);
