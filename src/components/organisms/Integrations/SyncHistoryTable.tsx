'use client';

/**
 * Synchronization Run History Table for Integration Center.
 */

import React, { useState } from 'react';
import {
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/atoms';
import { useSyncLogsHistory } from '@/hooks';
import type { SyncRunLog } from '@/types';

export function SyncHistoryTable() {
  const { data: rawLogs, isLoading } = useSyncLogsHistory();
  const [expandedSyncId, setExpandedSyncId] = useState<string | null>(null);

  const logs = (rawLogs ?? []) as readonly SyncRunLog[];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-6 space-y-3 animate-pulse">
        <div className="h-5 w-48 rounded bg-surface-lifted" />
        <div className="h-24 rounded-lg bg-surface-lifted" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-8 text-center shadow-card">
        <p className="text-xs text-muted">Chưa có lịch sử đồng bộ đơn hàng nào được ghi nhận.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Mã đợt (Sync ID)</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Thời lượng</TableHead>
            <TableHead className="text-center">Kết quả</TableHead>
            <TableHead className="text-right">Chi tiết</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const isExpanded = expandedSyncId === log.syncId;
            const hasErrors = log.errors && log.errors.length > 0;

            return (
              <React.Fragment key={log.syncId}>
                <TableRow>
                  <TableCell className="whitespace-nowrap font-medium text-foreground">
                    {new Date(log.startedAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted">
                    {log.syncId}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.status === 'completed' ? 'success' : log.status === 'partial' ? 'warning' : 'error'}
                      size="xs"
                    >
                      {log.status === 'completed' ? 'Thành công' : log.status === 'partial' ? 'Một phần' : 'Thất bại'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted">
                    {log.durationMs ? `${log.durationMs}ms` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-status-success font-semibold">+{log.created}</span>
                      <span className="text-status-info font-semibold">~{log.updated}</span>
                      <span className="text-muted">={log.unchanged}</span>
                      {log.failed > 0 && <span className="text-semantic-error font-bold">!{log.failed}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {hasErrors ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setExpandedSyncId(isExpanded ? null : log.syncId)}
                        className="text-[11px]"
                      >
                        {isExpanded ? 'Ẩn lỗi' : `Xem (${log.errors?.length})`}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded && hasErrors && (
                  <TableRow className="bg-semantic-error/10 hover:bg-semantic-error/10">
                    <TableCell colSpan={6} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-semantic-error">
                          <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                          </svg>
                          <span>Danh sách đơn hàng lỗi ({log.errors?.length}):</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {log.errors?.map((err, idx) => (
                            <div
                              key={`${err.externalOrderId}-${idx}`}
                              className="flex items-start justify-between gap-3 text-[11px] bg-surface-card p-2 rounded-lg border border-hairline"
                            >
                              <span className="font-mono font-semibold text-foreground">
                                [{err.externalOrderId}]
                              </span>
                              <span className="text-semantic-error text-right flex-1">
                                {err.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
