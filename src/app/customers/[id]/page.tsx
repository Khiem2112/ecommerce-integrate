'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCustomer, useBreadcrumb, useModalState } from '@/hooks';
import { Button } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import {
  CustomerDossierHeader,
  CustomerMetricsGrid,
  CustomerOrdersTab,
  CustomerConversationsTab,
  CustomerEvidencesTab,
  UpdateCustomerModal,
} from '@/components/organisms';
import { cn } from '@/lib/cn';

type TabKey = 'metrics' | 'orders' | 'conversations' | 'evidence';
type ModalKey = 'edit';

export default function CustomerDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const resolvedParams = use(params);
  const customerId = Number(resolvedParams.id);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('metrics');
  const { isOpen, open, close } = useModalState<ModalKey>();

  const { data: customer, isLoading, error } = useCustomer(customerId);

  const isValidId = !Number.isNaN(customerId) && customerId > 0;

  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: 'Khách hàng', href: '/customers' },
      {
        label: customer?.platformBuyerId
          ? `Hồ sơ ${customer.platformBuyerId}`
          : isValidId
          ? `Khách hàng #${customerId}`
          : 'Hồ sơ khách hàng',
      },
    ]);
  }, [customer?.platformBuyerId, customerId, isValidId, setBreadcrumb]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-xl bg-surface-lifted" />
        <div className="grid grid-cols-4 gap-3">
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
        </div>
        <div className="h-64 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">Không tìm thấy khách hàng</h3>
        <p className="mt-1 text-xs text-muted">
          Hồ sơ khách hàng không tồn tại hoặc đã bị vô hiệu hóa khỏi hệ thống.
        </p>
        <Link href="/customers" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Quay lại danh sách khách hàng
          </Button>
        </Link>
      </div>
    );
  }

  const tabs: readonly { readonly key: TabKey; readonly label: string; readonly count?: number }[] = [
    { key: 'metrics', label: 'Chỉ số RFM & Sở thích' },
    { key: 'orders', label: 'Đơn hàng đã mua', count: customer.orders?.length ?? 0 },
    { key: 'conversations', label: 'Lịch sử hội thoại', count: customer.conversations?.length ?? 0 },
    { key: 'evidence', label: 'RAG Evidence Facts', count: customer.evidences?.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
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
        {activeTab === 'orders' && <CustomerOrdersTab customer={customer} />}
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
    </div>
  );
}
