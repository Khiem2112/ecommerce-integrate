'use client';

import { Combobox, type ComboboxItem } from '@/components/atoms';

type InboxFiltersProps = {
  readonly selectedStatus: string;
  readonly selectedPriority: string;
  readonly onStatusChange: (status: string) => void;
  readonly onPriorityChange: (priority: string) => void;
};

const STATUS_ITEMS: readonly ComboboxItem[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open', dotColor: 'bg-emerald-400' },
  { value: 'awaiting_reply', label: 'Awaiting Reply', dotColor: 'bg-amber-400' },
  { value: 'in_progress', label: 'In Progress', dotColor: 'bg-violet-400' },
  { value: 'escalated', label: 'Escalated', dotColor: 'bg-rose-400' },
  { value: 'resolved', label: 'Resolved', dotColor: 'bg-teal-400' },
  { value: 'closed', label: 'Closed', dotColor: 'bg-slate-500' },
];

const PRIORITY_ITEMS: readonly ComboboxItem[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent', dotColor: 'bg-rose-400' },
  { value: 'high', label: 'High', dotColor: 'bg-amber-400' },
  { value: 'normal', label: 'Normal', dotColor: 'bg-sky-400' },
  { value: 'low', label: 'Low', dotColor: 'bg-slate-500' },
];

export function InboxFilters({
  selectedStatus,
  selectedPriority,
  onStatusChange,
  onPriorityChange,
}: InboxFiltersProps) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Combobox
        ariaLabel="Filter by status"
        placeholder="Status"
        items={STATUS_ITEMS}
        value={selectedStatus}
        onChange={onStatusChange}
        searchable={false}
      />
      <Combobox
        ariaLabel="Filter by priority"
        placeholder="Priority"
        items={PRIORITY_ITEMS}
        value={selectedPriority}
        onChange={onPriorityChange}
        searchable={false}
      />
    </div>
  );
}
