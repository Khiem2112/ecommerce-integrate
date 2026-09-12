/**
 * Synchronization & Marketplace Connector Constants
 */

/**
 * Lazada limits /orders/items/get to a maximum of 50 orders per batch request.
 */
export const LAZADA_ORDER_ITEMS_BATCH_CHUNK_SIZE = 50;

/**
 * Maximum number of orders to synchronize in a single apply sync batch.
 */
export const MAX_ORDERS_TO_SYNC = 400;

/**
 * Default page size when querying orders from marketplace connectors.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum allowed page size for paginated order queries.
 */
export const MAX_PAGE_SIZE = 100;
