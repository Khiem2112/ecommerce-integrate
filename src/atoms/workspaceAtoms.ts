import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import type { InboxFilters } from '@/types';

const getSessionStorage = (): Storage => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      get length() { return 0; },
    };
  }
  return window.sessionStorage;
};

const getLocalStorage = (): Storage => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      get length() { return 0; },
    };
  }
  return window.localStorage;
};

const sessionStorageAdapter = createJSONStorage<number | null>(getSessionStorage);
const filterStorageAdapter = createJSONStorage<InboxFilters>(getSessionStorage);
const localStorageAdapter = createJSONStorage<boolean>(getLocalStorage);

export const selectedConversationIdAtom = atomWithStorage<number | null>(
  'vip-workspace:selected-conversation-id',
  null,
  sessionStorageAdapter,
  { getOnInit: true },
);

export const inboxFiltersAtom = atomWithStorage<InboxFilters>(
  'vip-workspace:inbox-filters',
  {},
  filterStorageAdapter,
  { getOnInit: true },
);

export const sidebarCollapsedAtom = atom(true);

/** Controls the global left app sidebar (collapse to icon-only mode). */
export const appSidebarCollapsedAtom = atomWithStorage<boolean>(
  'vip-workspace:app-sidebar-collapsed',
  false,
  localStorageAdapter,
  { getOnInit: true },
);
