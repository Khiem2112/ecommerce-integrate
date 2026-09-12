import { cn } from '@/lib/cn';
import type { SyncBatchDetail, SyncOrderChangeType } from '@/types';

const TAB_LABELS: Record<SyncOrderChangeType, string> = {
  created: 'Tạo mới',
  updated: 'Cập nhật',
  unchanged: 'Không đổi',
  failed: 'Lỗi',
};

type SyncOrderTabsProps = {
  readonly detail: SyncBatchDetail;
  readonly activeTab: SyncOrderChangeType;
  readonly onChange: (tab: SyncOrderChangeType) => void;
};

export function SyncOrderTabs({ detail, activeTab, onChange }: SyncOrderTabsProps) {
  const tabs: readonly { readonly key: SyncOrderChangeType; readonly count: number }[] = [
    { key: 'created', count: detail.createdCount },
    { key: 'updated', count: detail.updatedCount },
    { key: 'unchanged', count: detail.unchangedCount },
    ...(detail.failedCount > 0 ? [{ key: 'failed' as const, count: detail.failedCount }] : []),
  ];

  return (
    <div role="tablist" aria-label="Phân loại kết quả đồng bộ" className="flex overflow-x-auto border-b border-hairline custom-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          id={`sync-tab-${tab.key}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`sync-panel-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={cn(
            'min-h-11 whitespace-nowrap border-b-2 px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            activeTab === tab.key ? 'border-foreground text-foreground' : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          {TAB_LABELS[tab.key]} <span className="ml-1 font-mono">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
