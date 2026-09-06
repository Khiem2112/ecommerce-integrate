'use client';

/**
 * Detailed Nested View for SyncBatch Changes (Phase 1.5).
 * Renders an authoritative diff tree: Order Header -> Child Order Items (before → after).
 * Modularized with SyncBatchToolbar (using Combobox), useDebounce, and SyncOrderChangeCard.
 */

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/atoms';
import { SyncBatchToolbar, SyncOrderChangeCard } from '@/components/molecules';
import { useDebounce } from '@/hooks';
import type { SyncChangeSummary } from '@/types';

export type SyncBatchDetailViewProps = {
  readonly summary: SyncChangeSummary;
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
};

export function SyncBatchDetailView({
  summary,
  onRefresh,
  isRefreshing = false,
}: SyncBatchDetailViewProps) {
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Debounce search query by 300ms for smooth in-memory filtering
  const debouncedSearch = useDebounce(searchInput, 300);

  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    summary.orderGroups.slice(0, 5).forEach((g) => initial.add(g.externalOrderId));
    return initial;
  });

  const toggleOrder = (externalOrderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(externalOrderId)) {
        next.delete(externalOrderId);
      } else {
        next.add(externalOrderId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedOrders(new Set(summary.orderGroups.map((g) => g.externalOrderId)));
  };

  const collapseAll = () => {
    setExpandedOrders(new Set());
  };

  // Filter order groups based on debounced search and selected change type
  const filteredGroups = useMemo(() => {
    return summary.orderGroups.filter((group) => {
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesOrderId = group.externalOrderId.toLowerCase().includes(q);
        const matchesItems = group.itemChanges.some(
          (ic) =>
            ic.entityId.toLowerCase().includes(q) ||
            (ic.changes?.productName?.after as string | undefined)?.toLowerCase().includes(q) ||
            (ic.changes?.sku?.after as string | undefined)?.toLowerCase().includes(q),
        );
        if (!matchesOrderId && !matchesItems) return false;
      }

      if (filterType === 'created') {
        return (
          group.orderChange?.changeType === 'created' ||
          group.itemChanges.some((ic) => ic.changeType === 'created')
        );
      }
      if (filterType === 'updated') {
        return (
          group.orderChange?.changeType === 'updated' ||
          group.itemChanges.some((ic) => ic.changeType === 'updated')
        );
      }
      if (filterType === 'itemsOnly') {
        return group.itemChanges.length > 0;
      }

      return true;
    });
  }, [summary.orderGroups, debouncedSearch, filterType]);

  const isCompleted = summary.status === 'completed';
  const isPartial = summary.status === 'partial';

  return (
    <div className="space-y-6">
      {/* Top Batch Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted block mb-2">Trạng thái đợt</span>
          <div>
            <Badge
              variant={isCompleted ? 'success' : isPartial ? 'warning' : 'error'}
              size="md"
              useDot
            >
              {isCompleted ? 'Hoàn tất' : isPartial ? 'Một phần' : 'Thất bại'}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted block mb-2">Tổng số thay đổi</span>
          <div>
            <Badge variant="primary" size="md" className="font-mono font-bold">
              {summary.totalChanges} thay đổi
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted block mb-2">Tạo mới</span>
          <div>
            <Badge variant="success" size="md" className="font-mono font-bold" useDot>
              +{summary.created}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted block mb-2">Cập nhật</span>
          <div>
            <Badge variant="info" size="md" className="font-mono font-bold" useDot>
              ~{summary.updated}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted block mb-2">Vô hiệu hóa</span>
          <div>
            <Badge variant="warning" size="md" className="font-mono font-bold" useDot>
              !{summary.inactivated}
            </Badge>
          </div>
        </div>
      </div>

      {/* Reusable Toolbar with Search, Combobox Filter & Actions */}
      <SyncBatchToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        filterType={filterType}
        onFilterChange={setFilterType}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Nested View List */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface-card p-10 text-center shadow-card space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {debouncedSearch.trim()
              ? 'Không tìm thấy đơn hàng nào khớp với tìm kiếm'
              : 'Đợt này không ghi nhận thay đổi nào'}
          </p>
          <p className="text-xs text-muted">
            {debouncedSearch.trim()
              ? 'Vui lòng thử lại với từ khóa hoặc điều kiện lọc khác.'
              : 'Tất cả đơn hàng từ Lazada đã được đối soát và giữ nguyên dữ liệu.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <SyncOrderChangeCard
              key={group.externalOrderId}
              group={group}
              isExpanded={expandedOrders.has(group.externalOrderId)}
              onToggle={() => toggleOrder(group.externalOrderId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
