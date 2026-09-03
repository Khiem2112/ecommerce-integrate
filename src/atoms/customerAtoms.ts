import { atom } from 'jotai';

export type CustomerLocalFilterState = {
  platformId?: number;
  vipTierId?: number;
  minVipScore?: number;
  maxVipScore?: number;
  sortBy?: 'vipScore' | 'totalSpend' | 'orderCount' | 'createdAt' | 'daysSinceLastOrder' | 'avgOrderValue';
  sortOrder?: 'asc' | 'desc';
};

export const initialCustomerLocalFilters: CustomerLocalFilterState = {
  platformId: undefined,
  vipTierId: undefined,
  minVipScore: undefined,
  maxVipScore: undefined,
  sortBy: 'totalSpend',
  sortOrder: 'desc',
};

/**
 * In-memory Jotai atom preserving filter selections for customer directory
 * across page transitions.
 */
export const customerLocalFiltersAtom = atom<CustomerLocalFilterState>(
  initialCustomerLocalFilters,
);
