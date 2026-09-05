/**
 * Lazada Channel Connector Implementation
 * Adapts Lazada Open Platform API responses to domain-standard External DTOs.
 */

import { LazadaClient } from './lazadaClient';
import type {
  ChannelConnector,
  ConnectionHealth,
  ExternalOrder,
  ExternalOrderItem,
  ExternalCustomer,
  ExternalOrderPage,
  FetchOrdersParams,
  LazadaOrderDTO,
  LazadaOrderItemDTO,
  LazadaOrdersGetResponse,
} from '@/types';

/**
 * Maps raw buyer info and shipping address from Lazada Order DTO to domain ExternalCustomer.
 */
export function mapLazadaBuyerToExternal(raw: LazadaOrderDTO): ExternalCustomer {
  const buyerId = raw.buyer?.buyer_id || raw.address_shipping?.phone || 'unknown_buyer';
  const firstName = raw.buyer?.first_name || raw.address_shipping?.first_name || 'Khách hàng';
  const lastName = raw.buyer?.last_name || raw.address_shipping?.last_name || '';
  const phone = raw.buyer?.phone ?? raw.address_shipping?.phone;
  const email = raw.buyer?.email;
  const city = raw.address_shipping?.city;
  const fullAddress = raw.address_shipping
    ? [raw.address_shipping.address1, raw.address_shipping.address2, raw.address_shipping.city, raw.address_shipping.country]
        .filter(Boolean)
        .join(', ')
    : undefined;

  return {
    externalBuyerId: String(buyerId),
    firstName,
    lastName,
    phone,
    email,
    city,
    fullAddress,
  };
}

/**
 * Maps raw item DTO from Lazada Order to domain ExternalOrderItem.
 */
export function mapLazadaItemToExternal(
  rawItem: LazadaOrderItemDTO,
  externalOrderId: string,
): ExternalOrderItem {
  return {
    externalItemId: String(rawItem.order_item_id),
    externalOrderId,
    name: rawItem.name,
    sku: rawItem.sku || rawItem.shop_sku || '',
    unitPrice: rawItem.item_price,
    paidPrice: rawItem.paid_price,
    quantity: 1, // Lazada line items are individual or count per record
    shippingFee: rawItem.shipping_fee ?? 0,
    status: rawItem.status ?? 'pending',
    trackingCode: rawItem.tracking_code,
    shippingProvider: rawItem.shipping_provider,
    productImage: rawItem.product_main_image,
    cancelReason: rawItem.reason,
  };
}

/**
 * Maps complete Lazada Order DTO to domain ExternalOrder.
 */
export function mapLazadaOrderToExternal(raw: LazadaOrderDTO): ExternalOrder {
  const externalOrderId = String(raw.order_id);
  const status = raw.statuses && raw.statuses.length > 0 ? raw.statuses[0] : 'pending';
  const buyer = mapLazadaBuyerToExternal(raw);
  const hasItems = Array.isArray(raw.items);
  const items = (raw.items ?? []).map((it) => mapLazadaItemToExternal(it, externalOrderId));

  return {
    externalOrderId,
    orderNumber: raw.order_number || `LAZ-${raw.order_id}`,
    platform: 'lazada',
    status,
    totalAmount: parseFloat(raw.price || '0'),
    shippingFee: raw.shipping_fee ?? 0,
    voucherDiscount: raw.voucher ?? (raw.voucher_platform ?? 0) + (raw.voucher_seller ?? 0),
    paymentMethod: raw.payment_method || 'COD',
    remarks: raw.remarks,
    createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
    updatedAt: raw.updated_at ? new Date(raw.updated_at) : new Date(),
    buyer,
    items,
    itemsComplete: hasItems,
    rawPayload: raw as unknown as Record<string, unknown>,
  };
}

export class LazadaConnector implements ChannelConnector {
  private readonly client: LazadaClient;

  constructor(client?: LazadaClient) {
    this.client = client ?? new LazadaClient({ apiScope: 'business' });
  }

  public getClient(): LazadaClient {
    return this.client;
  }

  /**
   * Health check: Probes the `/orders/get` endpoint with limit=1 to verify connection and signature.
   * Enforces created_after parameter required by Lazada API and uses fast fail timeout (3000ms, 0 retries).
   */
  public async getConnectionHealth(): Promise<ConnectionHealth> {
    const start = Date.now();
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await this.client.get<LazadaOrdersGetResponse>(
        '/orders/get',
        { limit: 1, created_after: thirtyDaysAgo },
        { timeoutMs: 3000, maxRetries: 0 },
      );
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ Lazada';
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        message,
        lastCheckedAt: new Date(),
      };
    }
  }

  /**
   * Fetch paginated orders from Lazada API.
   */
  public async fetchOrders(params: FetchOrdersParams = {}): Promise<ExternalOrderPage> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const queryParams: Record<string, unknown> = {
      offset,
      limit: pageSize,
    };

    if (params.status && params.status.trim() !== '') {
      queryParams.status = params.status.trim();
    }

    if (params.createdAfter) {
      queryParams.created_after = params.createdAfter.toISOString();
    }

    if (params.createdBefore) {
      queryParams.created_before = params.createdBefore.toISOString();
    }

    if (params.updateAfter) {
      queryParams.update_after = params.updateAfter.toISOString();
    }

    if (params.updateBefore) {
      queryParams.update_before = params.updateBefore.toISOString();
    }

    if (params.seed) {
      queryParams.seed = params.seed;
    }

    // Default fallback to past 90 days if neither created_after nor update_after is specified (Lazada requirement)
    if (!queryParams.created_after && !queryParams.update_after) {
      queryParams.created_after = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const rawData = await this.client.get<LazadaOrdersGetResponse>('/orders/get', queryParams);
    const rawOrders = rawData.orders ?? [];
    const orders = rawOrders.map(mapLazadaOrderToExternal);
    const totalCount = rawData.countTotal ?? orders.length;

    return {
      orders,
      totalCount,
      page,
      pageSize,
      hasMore: offset + orders.length < totalCount,
    };
  }

  /**
   * Fetch single order detail from Lazada API.
   */
  public async fetchOrderDetail(externalOrderId: string): Promise<ExternalOrder> {
    const orderData = await this.client.get<LazadaOrderDTO>('/order/get', {
      order_id: externalOrderId,
    });
    return mapLazadaOrderToExternal(orderData);
  }

  /**
   * Look up buyer profile from external buyer ID.
   */
  public async fetchCustomer(externalBuyerId: string): Promise<ExternalCustomer | null> {
    // If Lazada provides an explicit customer endpoint in future, call it here.
    // For now we look up via order query.
    try {
      const page = await this.fetchOrders({ pageSize: 20 });
      const found = page.orders.find((o) => o.buyer.externalBuyerId === externalBuyerId);
      return found ? found.buyer : null;
    } catch {
      return null;
    }
  }
}
