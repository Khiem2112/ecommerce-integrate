'use client';

import { useState } from 'react';
import { useModalState } from '@/hooks';
import { ErrorBanner } from '@/components/molecules';
import { CustomerDossierHeader } from './CustomerDossierHeader';
import { CustomerMetricsGrid } from './CustomerMetricsGrid';
import { CustomerOrdersTab } from './CustomerOrdersTab';
import { CustomerConversationsTab } from './CustomerConversationsTab';
import { CustomerEvidencesTab } from './CustomerEvidencesTab';
import { UpdateCustomerModal } from './UpdateCustomerModal';
import { OrderQuickViewModal } from '../Order/OrderQuickViewModal';
import { cn } from '@/lib/cn';
import type { CustomerFullDetail } from '@/types';

export type CustomerTabKey = 'metrics' | 'orders' | 'conversations' | 'evidence';
type ModalKey = 'edit';

export type CustomerDetailContentProps = {
  readonly customer: CustomerFullDetail;
  readonly hideBackLink?: boolean;
  readonly isModal?: boolean;
  readonly initialTab?: CustomerTabKey;
  readonly onViewOrder?: (orderId: number) => void;
};

export function CustomerDetailContent({
  customer,
  hideBackLink = false,
  isModal = false,
  initialTab = 'metrics',
  onViewOrder,
}: CustomerDetailContentProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CustomerTabKey>(initialTab);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { isOpen, open, close } = useModalState<ModalKey>();

  const handleViewOrder = (orderId: number) => {
    if (onViewOrder) {
      onViewOrder(orderId);
    } else {
      setSelectedOrderId(orderId);
    }
  };

  const tabs: readonly { readonly key: CustomerTabKey; readonly label: string; readonly count?: number }[] = [
    { key: 'metrics', label: 'Chỉ số RFM & Sở thích' },
    { key: 'orders', label: 'Đơn hàng đã mua', count: customer.orders?.length ?? 0 },
    { key: 'conversations', label: 'Lịch sử hội thoại', count: customer.conversations?.length ?? 0 },
    { key: 'evidence', label: 'RAG Evidence Facts', count: customer.evidences?.length ?? 0 },
  ];

  return (
    <div className={cn('space-y-6', isModal && 'space-y-4')}>
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Hero Dossier Header */}
      <CustomerDossierHeader
        customer={customer}
        onEdit={() => open('edit')}
        hideBackLink={hideBackLink}
      />

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
        {activeTab === 'metrics' && <CustomerMetricsGrid customer={customer} />}
        {activeTab === 'orders' && (
          <CustomerOrdersTab
            customer={customer}
            onViewOrder={handleViewOrder}
          />
        )}
        {activeTab === 'conversations' && <CustomerConversationsTab customer={customer} />}
        {activeTab === 'evidence' && <CustomerEvidencesTab customer={customer} />}
      </div>

      {/* Edit Customer Modal */}
      <UpdateCustomerModal
        open={isOpen('edit')}
        customer={customer}
        onClose={() => close('edit')}
        onSaveSuccess={() => close('edit')}
      />

      {/* Nested Order Quick View Modal */}
      <OrderQuickViewModal
        open={Boolean(selectedOrderId)}
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
