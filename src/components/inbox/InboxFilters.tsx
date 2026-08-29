'use client';

import { Combobox, type ComboboxItem } from '@/components/atoms';

type InboxFiltersProps = {
  readonly selectedStatus: string;
  readonly selectedPriority: string;
  readonly onStatusChange: (status: string) => void;
  readonly onPriorityChange: (priority: string) => void;
};

const STATUS_ITEMS: readonly ComboboxItem[] = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open', dotColor: 'bg-status-success' },
  { value: 'awaiting_reply', label: 'Awaiting', dotColor: 'bg-status-warning' },
  { value: 'in_progress', label: 'In Progress', dotColor: 'bg-foreground' },
  { value: 'escalated', label: 'Escalated', dotColor: 'bg-status-warning' },
  { value: 'resolved', label: 'Resolved', dotColor: 'bg-status-success' },
  { value: 'closed', label: 'Closed', dotColor: 'bg-muted' },
];

const PRIORITY_ITEMS: readonly ComboboxItem[] = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent', dotColor: 'bg-status-warning' },
  { value: 'high', label: 'High', dotColor: 'bg-status-accent' },
  { value: 'normal', label: 'Normal', dotColor: 'bg-status-info' },
  { value: 'low', label: 'Low', dotColor: 'bg-muted' },
];

export function InboxFilters({
  selectedStatus,
  selectedPriority,
  onStatusChange,
  onPriorityChange,
}: InboxFiltersProps) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      <Combobox
        ariaLabel="Filter by status"
        placeholder="Status"
        items={STATUS_ITEMS}
        value={selectedStatus}
        onChange={onStatusChange}
        searchable={false}
        size="md"
      />
      <Combobox
        ariaLabel="Filter by priority"
        placeholder="Priority"
        items={PRIORITY_ITEMS}
        value={selectedPriority}
        onChange={onPriorityChange}
        searchable={false}
        size="sm"
      />
    </div>
  );
}
