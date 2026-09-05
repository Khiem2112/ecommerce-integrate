/**
 * Channel Connector & External Integration Domain Types
 * Follows Hexagonal / Ports & Adapters Architecture.
 */

export type PlatformCode = 'lazada' | 'mock' | 'shopify' | 'tiktok_shop';

export type ExternalOrderItem = {
  readonly externalItemId: string;
  readonly externalOrderId: string;
  readonly name: string;
  readonly sku: string;
  readonly unitPrice: number;
  readonly paidPrice: number;
  readonly quantity: number;
  readonly shippingFee: number;
  readonly status: string;
  readonly trackingCode?: string;
  readonly shippingProvider?: string;
  readonly productImage?: string;
  readonly cancelReason?: string;
};

export type ExternalCustomer = {
  readonly externalBuyerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string;
  readonly email?: string;
  readonly city?: string;
  readonly fullAddress?: string;
};

export type ExternalOrder = {
  readonly externalOrderId: string;
  readonly orderNumber: string;
  readonly platform: PlatformCode;
  readonly status: string;
  readonly totalAmount: number;
  readonly shippingFee: number;
  readonly voucherDiscount: number;
  readonly paymentMethod: string;
  readonly remarks?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly buyer: ExternalCustomer;
  readonly items: readonly ExternalOrderItem[];
  readonly rawPayload?: Record<string, unknown>;
};

export type ExternalOrderPage = {
  readonly orders: readonly ExternalOrder[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
};

export type FetchOrdersParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: string;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly updateAfter?: Date;
  readonly updateBefore?: Date;
  readonly seed?: string;
};

export type ConnectionHealth = {
  readonly status: 'connected' | 'expired' | 'error' | 'disconnected';
  readonly latencyMs: number;
  readonly message?: string;
  readonly lastCheckedAt: Date;
};

export type IntegrationSummary = {
  readonly platform: 'lazada' | 'shopify' | 'tiktok_shop';
  readonly environment: 'mock' | 'sandbox' | 'production';
  readonly status: 'connected' | 'expired' | 'error' | 'disconnected';
  readonly shopName?: string;
  readonly latencyMs?: number;
  readonly lastCheckedAt?: string;
  readonly lastSyncedAt?: string;
  readonly totalOrders?: number;
  readonly failedRecords?: number;
  readonly errorMessage?: string;
};

export type SyncRecordError = {
  readonly externalOrderId: string;
  readonly message: string;
};

export type SyncResult = {
  readonly syncId: string;
  readonly status: 'completed' | 'partial' | 'failed';
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly failed: number;
  readonly errors?: readonly SyncRecordError[];
  readonly startedAt: string;
  readonly completedAt?: string;
};

export type SyncRunLog = {
  readonly syncId: string;
  readonly platform: 'lazada' | 'shopify' | 'tiktok_shop';
  readonly status: 'completed' | 'partial' | 'failed';
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly failed: number;
  readonly errors?: readonly SyncRecordError[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
};

export type ChannelConnector = {
  getConnectionHealth(): Promise<ConnectionHealth>;
  fetchOrders(params: FetchOrdersParams): Promise<ExternalOrderPage>;
  fetchOrderDetail(externalOrderId: string): Promise<ExternalOrder>;
  fetchCustomer(externalBuyerId: string): Promise<ExternalCustomer | null>;
};
