'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useDeleteOrder,
  useDeleteOrderItem,
  useModalState,
  useRefreshOrderFromLazada,
} from '@/hooks';
import { Button, Badge } from '@/components/atoms';
import { ErrorBanner, SuccessBanner } from '@/components/molecules';
import { OrderGeneralTab } from './OrderGeneralTab';
import { OrderItemsTab } from './OrderItemsTab';
import { OrderStatusHistoryTab } from './OrderStatusHistoryTab';
import { OrderShippingFinancialTab } from './OrderShippingFinancialTab';
import { UpdateOrderStatusModal } from './SubModals/UpdateOrderStatusModal';
import { UpdateOrderGeneralModal } from './SubModals/UpdateOrderGeneralModal';
import { UpdateOrderShippingModal } from './SubModals/UpdateOrderShippingModal';
import { AddOrderItemModal } from './SubModals/AddOrderItemModal';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { cn } from '@/lib/cn';
import type { OrderWithHistory, OrderLookupOptions } from '@/types';

export type OrderTabKey = 'general' | 'items' | 'history' | 'shipping';
type ModalKey = 'status' | 'general' | 'shipping' | 'addItem' | 'delete';

export type OrderDetailContentProps = {
  readonly order: OrderWithHistory;
  readonly lookups?: OrderLookupOptions;
  readonly isModal?: boolean;
  readonly initialTab?: OrderTabKey;
  readonly onOrderDeleted?: () => void;
};

export function OrderDetailContent({
  order,
  lookups,
  isModal = false,
  initialTab = 'general',
  onOrderDeleted,
}: OrderDetailContentProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<OrderTabKey>(initialTab);
  const { isOpen, open, close } = useModalState<ModalKey>();

  const { mutateAsync: deleteItem, isPending: isDeletingItem } = useDeleteOrderItem();
  const { mutateAsync: deleteOrder, isPending: isDeletingOrder } = useDeleteOrder();
  const { mutateAsync: refreshFromLazada, isPending: isRefreshingLazada } = useRefreshOrderFromLazada();
  const [refreshSuccessMsg, setRefreshSuccessMsg] = useState<string | null>(null);

  const handleRefreshFromLazada = async () => {
    setErrorMessage(null);
    setRefreshSuccessMsg(null);
    try {
      const res = await refreshFromLazada(order.platformOrderId);
      setRefreshSuccessMsg(`Đã làm mới dữ liệu từ Lazada thành công (${res.outcome}).`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Làm mới từ Lazada thất bại');
    }
  };

  const handleDeleteConfirm = async () => {
    setErrorMessage(null);
    try {
      await deleteOrder({ id: order.id, updatedAt: String(order.updatedAt) });
      close('delete');
      onOrderDeleted?.();
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

  const tabs: readonly { readonly key: OrderTabKey; readonly label: string; readonly count?: number }[] = [
    { key: 'general', label: 'Thông tin chung' },
    { key: 'items', label: 'Sản phẩm', count: order.items.length },
    { key: 'history', label: 'Lịch sử trạng thái', count: order.statusHistory?.length },
    { key: 'shipping', label: 'Vận chuyển & Tài chính' },
  ];

  return (
    <div className={cn('space-y-6', isModal && 'space-y-4')}>
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {refreshSuccessMsg && (
        <SuccessBanner
          message={refreshSuccessMsg}
          onDismiss={() => setRefreshSuccessMsg(null)}
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
            Khách hàng:{' '}
            <strong className="font-mono text-foreground">
              {order.customer?.platformBuyerId ?? 'N/A'}
            </strong>{' '}
            ({order.customer?.vipTier?.name ?? 'Standard'}) • ID hệ thống: #{order.id}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh From Marketplace Button */}
          {order.platform.code === 'lazada' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isRefreshingLazada}
              onClick={handleRefreshFromLazada}
              icon={
                <svg aria-hidden="true" className="size-3.5 text-status-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              }
            >
              Làm mới từ Lazada
            </Button>
          )}

          {/* Quick Status Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => open('status')}
          >
            Đổi trạng thái
          </Button>

          {/* Full Edit Link */}
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
