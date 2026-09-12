import { atom } from 'jotai';

export type SyncDrawerState = {
  isOpen: boolean;
  batchCode: string | null;
  platformName?: string;
};

export const initialSyncDrawerState: SyncDrawerState = {
  isOpen: false,
  batchCode: null,
  platformName: 'Lazada Open Platform',
};

/**
 * Global Jotai atom tracking the Sync Progress Drawer state.
 */
export const syncDrawerAtom = atom<SyncDrawerState>(initialSyncDrawerState);

/**
 * Convenience write-only atom to open the drawer for a given batch.
 */
export const openSyncDrawerAtom = atom(
  null,
  (_get, set, payload: { batchCode: string | null; platformName?: string }) => {
    set(syncDrawerAtom, {
      isOpen: true,
      batchCode: payload.batchCode,
      platformName: payload.platformName ?? 'Lazada Open Platform',
    });
  },
);

/**
 * Convenience write-only atom to close the sync drawer.
 */
export const closeSyncDrawerAtom = atom(
  null,
  (_get, set) => {
    set(syncDrawerAtom, (prev) => ({
      ...prev,
      isOpen: false,
    }));
  },
);
