/**
 * Client-Side IndexedDB Storage Service for Multi-Platform Order Previews.
 * Protects channel rate limits by maintaining short-lived preview pages and order items locally.
 * Degrades gracefully when browser storage or IndexedDB APIs are unavailable or blocked.
 */

import type { OrderPreviewPage, OrderPreviewItemRow } from '@/types';

const DB_NAME = 'PlatformOrderPreviewDB';
const DB_VERSION = 1;
const STORE_PAGES = 'page_previews';
const STORE_ITEMS = 'item_previews';

type CachedPageRecord = {
  readonly key: string;
  readonly data: OrderPreviewPage;
  readonly cachedAt: number;
  readonly expiresAt: number;
};

type CachedItemRecord = {
  readonly key: string;
  readonly items: readonly OrderPreviewItemRow[];
  readonly cachedAt: number;
  readonly expiresAt: number;
};

function isClientEnvironment(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openPreviewDatabase(): Promise<IDBDatabase | null> {
  if (!isClientEnvironment()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PAGES)) {
          db.createObjectStore(STORE_PAGES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          db.createObjectStore(STORE_ITEMS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Builds a deterministic cache identifier based on marketplace platform and query filter bounds.
 */
export function generatePreviewCacheKey(params: {
  platform?: string;
  connectionId?: number;
  createdAfter?: string | Date;
  createdBefore?: string | Date;
  status?: string;
  page?: number;
  pageSize?: number;
}): string {
  const platform = params.platform ?? 'lazada';
  const from = params.createdAfter ? new Date(params.createdAfter).toISOString().slice(0, 10) : 'all';
  const to = params.createdBefore ? new Date(params.createdBefore).toISOString().slice(0, 10) : 'all';
  const status = params.status ?? 'all';
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const connectionId = params.connectionId ?? 1;

  return `preview:${platform}:${connectionId}:${from}:${to}:${status}:p${page}:s${pageSize}`;
}

/**
 * Persists an order preview page with an expiry timestamp to avoid redundant external network roundtrips.
 */
export async function savePreviewPage(
  key: string,
  data: OrderPreviewPage,
  ttlMinutes = 120,
): Promise<void> {
  const db = await openPreviewDatabase();
  if (!db) return;

  const now = Date.now();
  const record: CachedPageRecord = {
    key,
    data: {
      ...data,
      cachedAt: new Date(now).toISOString(),
    },
    cachedAt: now,
    expiresAt: now + ttlMinutes * 60 * 1000,
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PAGES, 'readwrite');
      const store = tx.objectStore(STORE_PAGES);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieves an active preview page if within its validity window; purges stale cache automatically.
 */
export async function getPreviewPage(key: string): Promise<OrderPreviewPage | null> {
  const db = await openPreviewDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PAGES, 'readonly');
      const store = tx.objectStore(STORE_PAGES);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as CachedPageRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }

        // Invalidate expired cache entries to free browser storage and enforce freshness
        if (Date.now() > record.expiresAt) {
          try {
            const delTx = db.transaction(STORE_PAGES, 'readwrite');
            delTx.objectStore(STORE_PAGES).delete(key);
          } catch {
            // Non-critical cleanup failure
          }
          resolve(null);
          return;
        }

        resolve(record.data);
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists lazy-loaded line items associated with a marketplace order.
 */
export async function saveOrderItemsPreview(
  platform: string,
  externalOrderId: string,
  items: readonly OrderPreviewItemRow[],
  ttlMinutes = 120,
): Promise<void> {
  const db = await openPreviewDatabase();
  if (!db) return;

  const now = Date.now();
  const record: CachedItemRecord = {
    key: `${platform}:${externalOrderId}`,
    items,
    cachedAt: now,
    expiresAt: now + ttlMinutes * 60 * 1000,
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieves cached line items for an order, returning null if un-cached or expired.
 */
export async function getOrderItemsPreview(
  platform: string,
  externalOrderId: string,
): Promise<readonly OrderPreviewItemRow[] | null> {
  const db = await openPreviewDatabase();
  if (!db) return null;

  const key = `${platform}:${externalOrderId}`;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const store = tx.objectStore(STORE_ITEMS);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as CachedItemRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }

        if (Date.now() > record.expiresAt) {
          resolve(null);
          return;
        }

        resolve(record.items);
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Clears all cached preview data across stores upon sync execution or user refresh.
 */
export async function clearAllPreviews(): Promise<void> {
  const db = await openPreviewDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PAGES, STORE_ITEMS], 'readwrite');
      tx.objectStore(STORE_PAGES).clear();
      tx.objectStore(STORE_ITEMS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
