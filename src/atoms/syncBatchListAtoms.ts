import { atom } from 'jotai';
import type { SyncBatchListFilter } from '@/types';

export const syncBatchFilterAtom = atom<SyncBatchListFilter>({
  page: 1,
  limit: 20,
});
