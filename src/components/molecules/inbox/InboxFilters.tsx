'use client';

import { Combobox, type ComboboxItem } from '@/components/atoms';
import { useTranslations } from 'next-intl';

type InboxFiltersProps = {
  readonly selectedStatus: string;
  readonly selectedPriority: string;
  readonly onStatusChange: (status: string) => void;
  readonly onPriorityChange: (priority: string) => void;
};

export function InboxFilters({
  selectedStatus,
  selectedPriority,
  onStatusChange,
  onPriorityChange,
}: InboxFiltersProps) {
  const t = useTranslations('workspace');
  const statusItems: readonly ComboboxItem[] = [
    { value: 'all', label: t('filters.allStatus') },
    { value: 'open', label: t('filters.open'), dotColor: 'bg-status-success' },
    { value: 'awaiting_reply', label: t('filters.awaitingReply'), dotColor: 'bg-status-warning' },
    { value: 'in_progress', label: t('filters.inProgress'), dotColor: 'bg-foreground' },
    { value: 'escalated', label: t('filters.escalated'), dotColor: 'bg-status-warning' },
    { value: 'resolved', label: t('filters.resolved'), dotColor: 'bg-status-success' },
    { value: 'closed', label: t('filters.closed'), dotColor: 'bg-muted' },
  ];
  const priorityItems: readonly ComboboxItem[] = [
    { value: 'all', label: t('filters.allPriority') },
    { value: 'urgent', label: t('filters.urgent'), dotColor: 'bg-status-warning' },
    { value: 'high', label: t('filters.high'), dotColor: 'bg-status-accent' },
    { value: 'normal', label: t('filters.normal'), dotColor: 'bg-status-info' },
    { value: 'low', label: t('filters.low'), dotColor: 'bg-muted' },
  ];
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      <Combobox
        ariaLabel={t('filters.statusAria')}
        placeholder={t('filters.status')}
        items={statusItems}
        value={selectedStatus}
        onChange={onStatusChange}
        searchable={false}
        size="sm"
      />
      <Combobox
        ariaLabel={t('filters.priorityAria')}
        placeholder={t('filters.priority')}
        items={priorityItems}
        value={selectedPriority}
        onChange={onPriorityChange}
        searchable={false}
        size="sm"
      />
    </div>
  );
}
