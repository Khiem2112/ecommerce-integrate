import { atom } from 'jotai';
import type { SyncOrderChangeType } from '@/types';

export const selectedSyncOrderIdAtom = atom<string | null>(null);
export const activeDetailTabAtom = atom<SyncOrderChangeType>('updated');
export const rightPanelOpenAtom = atom<boolean>(
  (get) => get(selectedSyncOrderIdAtom) !== null,
);
