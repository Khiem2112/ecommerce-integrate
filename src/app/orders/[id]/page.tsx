'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useOrder,
  useOrderLookups,
  useDeleteOrder,
  useDeleteOrderItem,
  useModalState,
  useBreadcrumb,
} from '@/hooks';
import { Button, Badge } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import {
  OrderGeneralTab,
  OrderItemsTab,
  OrderStatusHistoryTab,
  OrderShippingFinancialTab,
  UpdateOrderStatusModal,
  UpdateOrderGeneralModal,
  UpdateOrderShippingModal,
  AddOrderItemModal,
  ConfirmModal,
} from '@/components/organisms';
import { cn } from '@/lib/cn';

type TabKey = 'general' | 'items' | 'history' | 'shipping';
type ModalKey = 'status' | 'general' | 'shipping' | 'addItem' | 'delete';

export default function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.id);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  // Queries
  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: lookups } = useOrderLookups();

  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const { isOpen, open, close } = useModalState<ModalKey>();

  // Mutations used directly in page
  const { mutateAsync: deleteItem, isPending: isDeletingItem } = useDeleteOrderItem();
  const { mutateAsync: deleteOrder, isPending: isDeletingOrder } = useDeleteOrder();

  // Dynamic Breadcrumb
  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: 'Danh sách', href: '/orders' },
      {
        label: order?.platformOrderId
          ? `Đơn hàng #${order.platformOrderId}`
          : `Đơn hàng #${orderId}`,
      },
    ]);
  }, [order?.platformOrderId, orderId, setBreadcrumb]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 w-1/3 rounded-lg bg-surface-lifted" />
        <div className="h-64 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">Không tìm thấy đơn hàng</h3>
        <p className="mt-1 text-xs text-muted">
          Đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.
        </p>
        <Link href="/orders" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Quay lại danh sách
          </Button>
        </Link>
      </div>
    );
  }

  const handleDeleteConfirm = async () => {
    setErrorMessage(null);
    try {
      await deleteOrder({ id: order.id, updatedAt: String(order.updatedAt) });
      close('delete');
      router.push('/orders');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Xóa đơn hàng thất bại');
    }
  };

  const handleDeleteItemConfirm = async () => {
    if (!itemToDelete) return;
    setErrorMessage(null);
    try {
      await deleteItem({
        orderId: order.id,
        itemId: itemToDelete,
        updatedAt: String(order.updatedAt),
      });
      setItemToDelete(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Xóa sản phẩm thất bại');
    }
  };

  const tabs: readonly { readonly key: TabKey; readonly label: string; readonly count?: number }[] = [
    { key: 'general', label: 'Thông tin chung' },
    { key: 'items', label: 'Sản phẩm', count: order.items.length },
    { key: 'history', label: 'Lịch sử trạng thái', count: order.statusHistory?.length },
    { key: 'shipping', label: 'Vận chuyển & Tài chính' },
  ];

  return (
    <div className="space-y-6">
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Top Banner / Hero Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono tracking-tight text-foreground">
              #{order.platformOrderId}
            </h1>
            <Badge variant="secondary" size="sm">
              {order.platform.name}
            </Badge>
            <Badge variant="info" size="sm">
              {order.currentStatus.name}
            </Badge>
          </div>
          <p className="text-xs text-muted mt-1">
            Khách hàng: <strong className="font-mono text-foreground">{order.customer?.platformBuyerId ?? 'N/A'}</strong> ({order.customer?.vipTier?.name ?? 'Standard'}) • ID hệ thống: #{order.id}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Status Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => open('status')}
          >
            Đổi trạng thái
          </Button>

          {/* Full Edit */}
          <Link href={`/orders/${order.id}/edit`}>
            <Button type="button" variant="primary" size="sm">
              Sửa đơn hàng
            </Button>
          </Link>

          {/* Delete Action */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => open('delete')}
            className="text-semantic-error hover:bg-semantic-error/10 hover:border-semantic-error/30"
          >
            Xóa đơn
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-hairline">
        <nav className="flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-3 text-xs font-semibold transition-all border-b-2 cursor-pointer',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 rounded-full bg-surface-lifted px-1.5 py-0.5 text-xs text-muted">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'general' && (
          <OrderGeneralTab
            order={order}
            onEditGeneral={() => open('general')}
            onEditStatus={() => open('status')}
          />
        )}

        {activeTab === 'items' && (
          <OrderItemsTab
            order={order}
            onAddItem={() => open('addItem')}
            onDeleteItem={(itemId) => setItemToDelete(itemId)}
          />
        )}

        {activeTab === 'history' && (
          <OrderStatusHistoryTab
            order={order}
            onOpenUpdateStatusModal={() => open('status')}
          />
        )}

        {activeTab === 'shipping' && (
          <OrderShippingFinancialTab
            order={order}
            onEditShipping={() => open('shipping')}
          />
        )}
      </div>

      {/* Self-contained In-place Sub-Modals */}
      <UpdateOrderStatusModal
        open={isOpen('status')}
        order={order}
        lookups={lookups}
        onClose={() => close('status')}
        onSaveSuccess={() => close('status')}
      />

      <UpdateOrderGeneralModal
        open={isOpen('general')}
        order={order}
        lookups={lookups}
        onClose={() => close('general')}
        onSaveSuccess={() => close('general')}
      />

      <UpdateOrderShippingModal
        open={isOpen('shipping')}
        order={order}
        onClose={() => close('shipping')}
        onSaveSuccess={() => close('shipping')}
      />

      <AddOrderItemModal
        open={isOpen('addItem')}
        order={order}
        lookups={lookups}
        onClose={() => close('addItem')}
        onSaveSuccess={() => close('addItem')}
      />

      {/* Delete Order Confirm Modal */}
      <ConfirmModal
        open={isOpen('delete')}
        title="Xác nhận xóa đơn hàng"
        description={
          <span>
            Bạn có chắc chắn muốn xóa đơn hàng <strong>#{order.platformOrderId}</strong>?
          </span>
        }
        confirmLabel="Xác nhận xóa"
        isDestructive
        isLoading={isDeletingOrder}
        onConfirm={handleDeleteConfirm}
        onClose={() => close('delete')}
      />

      {/* Delete Item Confirm Modal */}
      <ConfirmModal
        open={Boolean(itemToDelete)}
        title="Xác nhận xóa sản phẩm"
        description="Bạn có chắc chắn muốn xóa sản phẩm này khỏi đơn hàng?"
        confirmLabel="Xóa sản phẩm"
        isDestructive
        isLoading={isDeletingItem}
        onConfirm={handleDeleteItemConfirm}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
}
