/**
 * Raw Lazada Open Platform DTOs
 */

export type LazadaOrderStatus =
  | 'unpaid'
  | 'pending'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'canceled'
  | 'returned'
  | 'failed';

export type LazadaAddressDTO = {
  readonly first_name: string;
  readonly last_name: string;
  readonly phone: string;
  readonly address1: string;
  readonly address2?: string;
  readonly city: string;
  readonly post_code: string;
  readonly country: string;
};

export type LazadaOrderItemDTO = {
  readonly order_item_id: number;
  readonly order_id: number;
  readonly shop_id?: string;
  readonly name: string;
  readonly sku: string;
  readonly shop_sku?: string;
  readonly item_price: number;
  readonly paid_price: number;
  readonly currency?: string;
  readonly wallet_discount?: number;
  readonly voucher_seller?: number;
  readonly voucher_platform?: number;
  readonly shipping_fee: number;
  readonly status: LazadaOrderStatus;
  readonly tracking_code?: string;
  readonly shipping_provider?: string;
  readonly package_id?: string;
  readonly product_main_image?: string;
  readonly reason?: string;
};

export type LazadaOrderDTO = {
  readonly order_id: number;
  readonly order_number: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly statuses: readonly LazadaOrderStatus[];
  readonly price: string;
  readonly items_count: number;
  readonly payment_method: string;
  readonly shipping_fee: number;
  readonly voucher: number;
  readonly voucher_platform?: number;
  readonly voucher_seller?: number;
  readonly branch_number?: string;
  readonly tax_code?: string;
  readonly extra_attributes?: string;
  readonly remarks?: string;
  readonly delivery_info?: string;
  readonly promised_shipping_times?: string;
  readonly address_billing?: LazadaAddressDTO;
  readonly address_shipping?: LazadaAddressDTO;
  readonly buyer: {
    readonly buyer_id: string;
    readonly first_name: string;
    readonly last_name: string;
    readonly phone?: string;
    readonly email?: string;
  };
  readonly items?: readonly LazadaOrderItemDTO[];
};

export type LazadaApiResponse<T> = {
  readonly code: string;
  readonly type?: string;
  readonly message?: string;
  readonly request_id: string;
  readonly data?: T;
};

export type LazadaOrdersGetResponse = {
  readonly count: number;
  readonly countTotal: number;
  readonly orders: readonly LazadaOrderDTO[];
};

export type SeedKey = 'default' | 'mega_sale' | 'high_returns' | 'fresh_orders';

export type SeedProfile = {
  readonly key: SeedKey;
  readonly name: string;
  readonly description: string;
  readonly orderCount: number;
};

export type LazadaCategoryTreeNode = {
  readonly category_id: number;
  readonly name: string;
  readonly leaf?: boolean;
  readonly children?: readonly LazadaCategoryTreeNode[];
};

export type LazadaCategoryAttributeOption = {
  readonly name: string;
  readonly en_name?: string;
  readonly id?: number | string;
};

export type LazadaCategoryAttribute = {
  readonly name: string;
  readonly label?: string;
  readonly input_type?: string;
  readonly attribute_type?: string;
  readonly is_mandatory?: number | string;
  readonly options?: readonly LazadaCategoryAttributeOption[];
};

