'use client';

import { useState, useTransition, useEffect } from 'react';
import { executeLazadaGenericAction } from '@/actions/lazadaDevActions';
import { Badge, Button } from '@/components/atoms';

export function OrderContractInspector() {
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [daysBack, setDaysBack] = useState<number>(30);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, any[]>>({});
  const [loadingItemsMap, setLoadingItemsMap] = useState<Record<number, boolean>>({});

  const handleFetchOrders = () => {
    startTransition(async () => {
      const createdAfter = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d+Z$/, '+07:00');

      const params: Record<string, unknown> = {
        created_after: createdAfter,
        limit: '20',
        sort_by: 'created_at',
        sort_direction: 'DESC',
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const res = await executeLazadaGenericAction('GET', '/orders/get', params);
      if (res.data?.success) {
        const body = res.data.data as any;
        const ordersList = body?.orders ?? [];
        setOrders(ordersList);
        setTotalCount(body?.countTotal ?? ordersList.length);
      }
    });
  };

  useEffect(() => {
    handleFetchOrders();
  }, [daysBack, statusFilter]);

  const handleToggleOrder = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(orderId);

    if (!orderItemsMap[orderId]) {
      setLoadingItemsMap((prev) => ({ ...prev, [orderId]: true }));
      try {
        const res = await executeLazadaGenericAction('GET', '/order/items/get', {
          order_id: String(orderId),
        });
        if (res.data?.success) {
          const items = Array.isArray(res.data.data) ? res.data.data : [];
          setOrderItemsMap((prev) => ({ ...prev, [orderId]: items }));
        }
      } finally {
        setLoadingItemsMap((prev) => ({ ...prev, [orderId]: false }));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-hairline bg-surface-lifted">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted font-medium">Khoảng thời gian:</span>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="h-8 rounded-lg border border-hairline bg-surface px-2.5 text-xs text-foreground focus:outline-none"
            >
              <option value={7}>7 ngày gần nhất</option>
              <option value={14}>14 ngày gần nhất</option>
              <option value={30}>30 ngày gần nhất</option>
              <option value={60}>60 ngày gần nhất</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-hairline bg-surface px-2.5 text-xs text-foreground focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="packed">Packed (Đã đóng gói)</option>
              <option value="ready_to_ship">Ready to Ship</option>
              <option value="delivered">Delivered (Đã giao)</option>
              <option value="canceled">Canceled (Đã hủy)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            Tổng cộng: <strong className="text-foreground">{totalCount}</strong> đơn hàng
          </span>
          <Button
            variant="outline"
            size="xs"
            isLoading={isPending}
            onClick={handleFetchOrders}
          >
            🔄 Tải lại
          </Button>
        </div>
      </div>

      {/* Orders List */}
      {isPending && orders.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted text-xs gap-2">
          <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Đang tải danh sách đơn hàng từ Lazada...</span>
        </div>
      )}

      {!isPending && orders.length === 0 && (
        <div className="rounded-2xl border border-hairline bg-surface-lifted p-8 text-center text-xs text-muted">
          Không tìm thấy đơn hàng nào trong khoảng thời gian này.
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-2.5">
          {orders.map((o) => {
            const oid = o.order_id;
            const isExpanded = expandedOrderId === oid;
            const items = orderItemsMap[oid] ?? [];
            const isLoadingItems = loadingItemsMap[oid] ?? false;
            const status = (o.statuses?.[0] as string) ?? 'unknown';

            return (
              <div
                key={oid}
                className="rounded-2xl border border-hairline bg-surface overflow-hidden shadow-xs transition-colors"
              >
                {/* Order Row Header */}
                <div
                  onClick={() => handleToggleOrder(oid)}
                  className="flex flex-wrap items-center justify-between p-3.5 hover:bg-foreground/2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted text-xs">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          ID: {oid}
                        </span>
                        <Badge
                          variant={
                            status === 'delivered'
                              ? 'success'
                              : status === 'canceled'
                              ? 'error'
                              : 'warning'
                          }
                          size="xs"
                        >
                          {status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        Ngày tạo: {o.created_at} | Người nhận: {o.customer_first_name || 'N/A'} ({o.address_shipping?.city || 'VN'})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        {Number(o.price || 0).toLocaleString('vi-VN')} VND
                      </span>
                      <span className="text-[11px] text-muted">
                        {o.items_count} mặt hàng ({o.payment_method || 'COD'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Order Items */}
                {isExpanded && (
                  <div className="border-t border-hairline bg-surface-lifted p-4 space-y-3">
                    <h5 className="text-xs font-semibold text-foreground">
                      Chi tiết mặt hàng (/order/items/get):
                    </h5>

                    {isLoadingItems && (
                      <div className="text-xs text-muted flex items-center gap-2 py-3">
                        <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang tải items của đơn #{oid}...</span>
                      </div>
                    )}

                    {!isLoadingItems && items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((itm) => (
                          <div
                            key={itm.order_item_id}
                            className="rounded-xl border border-hairline bg-surface p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{itm.name}</span>
                                <Badge variant="secondary" size="xs">
                                  Item ID: {itm.order_item_id}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted font-mono">
                                SKU: {itm.sku} | ShopSKU: {itm.shop_sku} | Vận chuyển: {itm.shipment_provider || itm.shipping_type || 'N/A'}
                              </p>
                              {itm.tracking_code && (
                                <p className="text-[11px] text-status-info font-mono">
                                  Mã Tracking: {itm.tracking_code}
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-semibold text-foreground block">
                                {Number(itm.paid_price || itm.item_price || 0).toLocaleString('vi-VN')} VND
                              </span>
                              <span className="text-[10px] text-muted">
                                Thuế: {Number(itm.tax_amount || 0).toLocaleString('vi-VN')} VND
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
