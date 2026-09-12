'use client';

/**
 * Detailed Lazada Integration Screen — /settings/integrations/lazada
 * 4 Tabs: Tổng quan, Đồng bộ, Thông tin xác thực, Nhật ký
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSetAtom } from 'jotai';
import { openSyncDrawerAtom } from '@/atoms';
import {
  useBreadcrumb,
  useIntegrationSummary,
  useCheckConnectionHealth,
  useSyncLazadaOrders,
  useStartQueuedSync,
  useActiveSyncBatch,
  usePreflightLazadaSync,
  useOrderPreview,
  useClearOrderPreviewCache,
  useDebounce,
} from '@/hooks';

import {
  Badge,
  Button,
  DateRangePicker,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/atoms';
import {
  ConnectionStatus,
  SyncResultSummary,
  SyncHistoryTable,
  SyncPreviewTable,
  SyncProgressDrawer,
} from '@/components/organisms';

import { OrderStatusFilter } from '@/components/molecules';
import { cn } from '@/lib/cn';
import type { SyncResult, FetchOrdersParams } from '@/types';

type LazadaTabKey = 'overview' | 'sync' | 'credentials' | 'logs';

const formatDateToInput = (d: Date): string => d.toISOString().split('T')[0];

const getPresetDates = (days: number) => {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return {
    from: formatDateToInput(start),
    to: formatDateToInput(end),
  };
};

export default function LazadaIntegrationDetailPage() {
  const { setBreadcrumb } = useBreadcrumb();
  const [activeTab, setActiveTab] = useState<LazadaTabKey>('overview');

  // Sync Form State (Date Range & Filters)
  const initialPreset = getPresetDates(30);
  const [fromDate, setFromDate] = useState<string>(initialPreset.from);
  const [toDate, setToDate] = useState<string>(initialPreset.to);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Debounced params for Preflight
  const syncParams = useMemo<FetchOrdersParams>(() => ({
    createdAfter: fromDate ? new Date(`${fromDate}T00:00:00Z`) : undefined,
    createdBefore: toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined,
    ...(statusFilter ? { status: statusFilter } : {}),
  }), [fromDate, toDate, statusFilter]);

  const debouncedParams = useDebounce(syncParams, 400);

  useEffect(() => {
    setBreadcrumb([
      { label: 'Cài đặt' },
      { label: 'Kênh tích hợp', href: '/settings/integrations' },
      { label: 'Lazada Open Platform' },
    ]);
  }, [setBreadcrumb]);

  const { data: summary } = useIntegrationSummary('lazada');
  const { mutateAsync: checkHealth, isPending: isCheckingHealth } = useCheckConnectionHealth('lazada');
  const { mutateAsync: syncOrders, isPending: isSyncing } = useSyncLazadaOrders();
  const { mutateAsync: startQueuedSync, isPending: isStartingSync } = useStartQueuedSync();
  const { data: activeBatch } = useActiveSyncBatch('lazada');
  const { data: preflightData, isLoading: isPreflightLoading } = usePreflightLazadaSync(debouncedParams, activeTab === 'sync');

  // Drawer Live Progress State (Jotai Global)
  const openSyncDrawer = useSetAtom(openSyncDrawerAtom);

  // Preview State & Hook
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewPageSize, setPreviewPageSize] = useState<number>(10);
  const [isPreviewTriggered, setIsPreviewTriggered] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewParams = useMemo<FetchOrdersParams>(() => ({
    createdAfter: fromDate ? new Date(`${fromDate}T00:00:00Z`) : undefined,
    createdBefore: toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined,
    ...(statusFilter ? { status: statusFilter } : {}),
    page: previewPage,
    pageSize: previewPageSize,
  }), [fromDate, toDate, statusFilter, previewPage, previewPageSize]);

  const {
    data: previewData,
    isLoading: isPreviewLoading,
    isFetching: isPreviewFetching,
    refetch: refetchPreview,
    error: previewQueryError,
  } = useOrderPreview('lazada', previewParams, {
    enabled: isPreviewTriggered && activeTab === 'sync',
  });

  const clearPreviewMutation = useClearOrderPreviewCache();

  // Sync preview error state from React Query
  useEffect(() => {
    if (previewQueryError) {
      const message = previewQueryError instanceof Error
        ? previewQueryError.message
        : 'Tải bản xem trước thất bại.';
      setPreviewError(message);
      setSyncError(message);
    } else {
      setPreviewError(null);
    }
  }, [previewQueryError]);

  // Clear preview error when user changes filters (new preview will be triggered)
  useEffect(() => {
    if (isPreviewTriggered) {
      setPreviewError(null);
      setSyncError(null);
    }
  }, [fromDate, toDate, statusFilter, isPreviewTriggered]);

  const handleTriggerPreview = () => {
    setSyncError(null);
    setPreviewError(null);
    if (!fromDate || !toDate) {
      setSyncError('Vui lòng chọn khoảng thời gian hợp lệ để xem trước.');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setSyncError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }
    setPreviewPage(1);
    setIsPreviewTriggered(true);
  };

  const handleForceRefreshPreview = async () => {
    setSyncError(null);
    setPreviewError(null);
    try {
      await clearPreviewMutation.mutateAsync();
      await refetchPreview();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Làm mới xem trước thất bại.';
      setSyncError(msg);
      setPreviewError(msg);
    }
  };

  const handleRunSync = async () => {
    setSyncError(null);
    if (!fromDate || !toDate) {
      setSyncError('Vui lòng chọn khoảng thời gian hợp lệ.');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setSyncError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    try {
      const params: FetchOrdersParams = {
        createdAfter: new Date(`${fromDate}T00:00:00Z`),
        createdBefore: new Date(`${toDate}T23:59:59.999Z`),
        ...(statusFilter ? { status: statusFilter } : {}),
      };
      const res = await startQueuedSync({ platform: 'lazada', params });
      openSyncDrawer({ batchCode: res.batchCode, platformName: 'Lazada Open Platform' });
      await clearPreviewMutation.mutateAsync();
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Khởi động đồng bộ nền thất bại.');
    }
  };


  const isMock = summary?.environment === 'mock';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-channel-lazada-soft border border-channel-lazada-border text-channel-lazada font-bold text-base shadow-xs">
            <span>LAZ</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Lazada Open Platform
              </h1>
              <Badge variant={isMock ? 'teal' : 'primary'} size="sm">
                {summary?.environment.toUpperCase() || 'MOCK'}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {summary?.shopName || 'Lazada Mall Official Store'} · Quản lý kết nối & đồng bộ đơn hàng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {summary && (
            <ConnectionStatus
              status={summary.status}
              latencyMs={summary.latencyMs}
            />
          )}

          <Link href="/settings/integrations">
            <Button variant="outline" size="sm">
              Quay lại danh sách
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-hairline gap-1 overflow-x-auto custom-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-4 py-2 text-xs font-semibold border-b-2 transition',
            activeTab === 'overview'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          1. Tổng quan & Kết nối
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className={cn(
            'px-4 py-2 text-xs font-semibold border-b-2 transition',
            activeTab === 'sync'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          2. Đồng bộ đơn hàng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={cn(
            'px-4 py-2 text-xs font-semibold border-b-2 transition',
            activeTab === 'credentials'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          3. Thông tin xác thực
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={cn(
            'px-4 py-2 text-xs font-semibold border-b-2 transition',
            activeTab === 'logs'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          4. Nhật ký đồng bộ
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-3">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Trạng thái kết nối</span>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-foreground capitalize">
                  {summary?.status === 'connected' ? 'Đang hoạt động tốt' : summary?.status}
                </div>
                {summary && (
                  <ConnectionStatus status={summary.status} latencyMs={summary.latencyMs} />
                )}
              </div>
              <Button
                variant="outline"
                size="xs"
                isLoading={isCheckingHealth}
                onClick={() => checkHealth()}
                className="w-full mt-2"
              >
                Kiểm tra kết nối ngay
              </Button>
            </div>

            <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-3">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Độ trễ phản hồi (Latency)</span>
              <div className="text-2xl font-bold font-mono text-foreground">
                {summary?.latencyMs ?? 0} <span className="text-xs text-muted font-normal">ms</span>
              </div>
              <p className="text-[11px] text-muted">
                Kiểm tra lần cuối: {summary?.lastCheckedAt ? new Date(summary.lastCheckedAt).toLocaleTimeString('vi-VN') : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-3">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Tổng đơn hàng đã nạp</span>
              <div className="text-2xl font-bold font-mono text-foreground">
                {summary?.totalOrders ?? 0} <span className="text-xs text-muted font-normal">đơn</span>
              </div>
              <p className="text-[11px] text-muted">
                Đồng bộ gần nhất: {summary?.lastSyncedAt ? new Date(summary.lastSyncedAt).toLocaleString('vi-VN') : 'Chưa có'}
              </p>
            </div>
          </div>

          {/* Endpoints & Architecture details */}
          <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-foreground">Các Endpoint API đang kết nối</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phương thức</TableHead>
                  <TableHead>Đường dẫn Endpoint</TableHead>
                  <TableHead>Chức năng</TableHead>
                  <TableHead>Yêu cầu chữ ký</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono text-[11px]">
                <TableRow>
                  <TableCell className="text-status-success font-bold">GET</TableCell>
                  <TableCell className="text-foreground">/rest/orders/get</TableCell>
                  <TableCell className="font-sans text-muted">Lấy danh sách đơn hàng theo trạng thái & thời gian</TableCell>
                  <TableCell><Badge variant="teal" size="xs">HMAC-SHA256</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-status-success font-bold">GET</TableCell>
                  <TableCell className="text-foreground">/rest/order/get</TableCell>
                  <TableCell className="font-sans text-muted">Lấy chi tiết đơn hàng authoritative từ Lazada</TableCell>
                  <TableCell><Badge variant="teal" size="xs">HMAC-SHA256</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-status-success font-bold">GET</TableCell>
                  <TableCell className="text-foreground">/rest/order/items/get</TableCell>
                  <TableCell className="font-sans text-muted">Lấy danh sách sản phẩm dòng (items) của đơn hàng</TableCell>
                  <TableCell><Badge variant="teal" size="xs">HMAC-SHA256</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-status-success font-bold">GET</TableCell>
                  <TableCell className="text-foreground">/health</TableCell>
                  <TableCell className="font-sans text-muted">Kiểm tra trạng thái uptime của Mock Server</TableCell>
                  <TableCell><Badge variant="secondary" size="xs">Không bắt buộc</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 2: Synchronization */}
      {activeTab === 'sync' && (
        <div className="space-y-6 max-w-2xl">
          {/* Active Background Sync Banner */}
          {activeBatch && (activeBatch.status === 'running' || activeBatch.status === 'queued') && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 shadow-card flex items-center justify-between gap-4 animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-teal-500" />
                  </span>
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-200">
                    Đang có một đợt đồng bộ ngầm đang diễn ra
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  Tiến trình: <span className="font-semibold text-foreground">{activeBatch.processedOrders} / {activeBatch.totalOrders} đơn ({activeBatch.progressPercentage}%)</span> · Mã đợt: <span className="font-mono">#{activeBatch.batchCode.slice(-12)}</span>
                </p>
              </div>

              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  openSyncDrawer({
                    batchCode: activeBatch.batchCode,
                    platformName: 'Lazada Open Platform',
                  });
                }}
                className="text-xs shrink-0"
              >
                Mở Drawer xem trực tiếp
              </Button>
            </div>
          )}

          {syncResult && (
            <SyncResultSummary
              result={syncResult}
              onDismiss={() => setSyncResult(null)}
              onRetryFailed={handleRunSync}
            />
          )}

          {syncError && (
            <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4 text-xs text-semantic-error">
              {syncError}
            </div>
          )}

          <div className="rounded-xl border border-hairline bg-surface-card p-6 shadow-card space-y-5">
            <div>
              <h3 className="text-base font-bold text-foreground">Kích hoạt đồng bộ đơn hàng</h3>
              <p className="text-xs text-muted mt-0.5">
                Thiết lập khoảng thời gian và kéo dữ liệu đơn hàng authoritative từ Lazada vào hệ thống.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Date Range Picker */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Khoảng thời gian đồng bộ
                </label>
                <DateRangePicker
                  from={fromDate}
                  to={toDate}
                  onChange={({ from, to }) => {
                    setFromDate(from);
                    setToDate(to);
                  }}
                  placeholder="Chọn khoảng thời gian…"
                />
              </div>

              {/* Status Filter */}
              <OrderStatusFilter
                id="status-tab-select"
                value={statusFilter}
                onChange={setStatusFilter}
                label="Trạng thái đơn hàng cần đồng bộ"
              />

              {/* Preflight Discovery Banner */}
              <div className="rounded-xl border border-hairline bg-surface-lifted/60 p-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted block">Ước tính số đơn trên sàn Lazada:</span>
                  {isPreflightLoading ? (
                    <span className="text-xs text-muted animate-pulse font-medium">Đang thăm dò dữ liệu sàn...</span>
                  ) : (
                    <span className="text-sm font-bold font-mono text-foreground">
                      ~{preflightData?.totalCount ?? 0} đơn hàng
                    </span>
                  )}
                </div>
                <Badge variant="teal" size="sm">
                  Khám phá tự động
                </Badge>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-muted">
                Đối soát an toàn: xem trước không ghi DB, nạp dữ liệu có audit log SyncChange
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  isLoading={isPreviewLoading || isPreviewFetching}
                  onClick={handleTriggerPreview}
                  icon={
                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  }
                >
                  {isPreviewLoading ? 'Đang tải xem trước...' : 'Xem trước đơn hàng'}
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  isLoading={isStartingSync}
                  onClick={handleRunSync}
                  icon={
                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  }
                >
                  {isStartingSync ? 'Đang khởi chạy...' : 'Bắt đầu đồng bộ ngay'}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Preview Table Section */}
          {isPreviewTriggered && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Bản xem trước đơn hàng Lazada (Quick Preview)</h3>
                <p className="text-xs text-muted mt-0.5">
                  Kiểm tra đối soát trước khi đồng bộ. Dữ liệu được lưu trong bộ nhớ đệm IndexedDB để bảo vệ hạn mức 10.000 req/ngày của Lazada.
                </p>
              </div>

              {previewError && !isPreviewLoading && (
                <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4 text-xs text-semantic-error space-y-2">
                  <div className="flex items-start gap-2">
                    <svg aria-hidden="true" className="size-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <div>
                      <span className="font-semibold">Không thể tải bản xem trước:</span>
                      <p className="mt-1">{previewError}</p>
                    </div>
                  </div>
                  <p className="text-[11px] opacity-70 ml-6">
                    Kiểm tra: 1) Access Token Lazada còn hạn không, 2) Khoảng thời gian có đơn hàng không, 3) Click "Làm mới" để thử lại.
                  </p>
                </div>
              )}

              <SyncPreviewTable
                platform="lazada"
                platformName="Lazada"
                data={previewError ? undefined : previewData}
                isLoading={isPreviewLoading}
                isFetching={isPreviewFetching}
                page={previewPage}
                pageSize={previewPageSize}
                onPageChange={setPreviewPage}
                onPageSizeChange={(sz) => {
                  setPreviewPageSize(sz);
                  setPreviewPage(1);
                }}
                onForceRefresh={handleForceRefreshPreview}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Credentials */}
      {activeTab === 'credentials' && (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-xl border border-hairline bg-surface-card p-6 shadow-card space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Thông tin xác thực ứng dụng</h3>
              <p className="text-xs text-muted mt-0.5">
                Các khoá kết nối được lưu trữ an toàn phía máy chủ qua file cấu hình biến môi trường (`.env`).
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="rounded-lg bg-surface-lifted border border-hairline p-3.5 space-y-1">
                <span className="text-muted block text-[11px]">Môi trường kết nối (Environment)</span>
                <span className="font-mono text-foreground font-semibold">{summary?.environment.toUpperCase()}</span>
              </div>

              <div className="rounded-lg bg-surface-lifted border border-hairline p-3.5 space-y-1">
                <span className="text-muted block text-[11px]">Base API URL</span>
                <span className="font-mono text-foreground">{process.env.NEXT_PUBLIC_LAZADA_BASE || 'http://localhost:4000/rest'}</span>
              </div>

              <div className="rounded-lg bg-surface-lifted border border-hairline p-3.5 space-y-1">
                <span className="text-muted block text-[11px]">App Key (Mã định danh ứng dụng)</span>
                <span className="font-mono text-foreground">mock_app_••••1234</span>
              </div>

              <div className="rounded-lg bg-surface-lifted border border-hairline p-3.5 space-y-1">
                <span className="text-muted block text-[11px]">App Secret (Khoá bí mật ký HMAC)</span>
                <span className="font-mono text-muted">••••••••••••••••••••••••••••••••</span>
              </div>

              <div className="rounded-lg bg-surface-lifted border border-hairline p-3.5 space-y-1">
                <span className="text-muted block text-[11px]">Thuật toán ký chữ ký số</span>
                <span className="font-mono text-foreground">HMAC-SHA256 (Canonical Parameter Ordering A-Z)</span>
              </div>
            </div>

            <div className="rounded-lg bg-surface-lifted/60 border border-hairline p-3 text-[11px] text-muted flex items-start gap-2">
              <svg aria-hidden="true" className="size-4 shrink-0 text-status-info mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span>
                Khoá bí mật App Secret và Access Token không bao giờ được trả về trình duyệt hoặc in ra log để đảm bảo an toàn tuyệt đối theo tiêu chuẩn bảo mật.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Lịch sử đồng bộ đơn hàng Lazada</h3>
            <p className="text-xs text-muted mt-0.5">
              Chi tiết các đợt nạp dữ liệu, số lượng thay đổi và nhật ký lỗi.
            </p>
          </div>

          <SyncHistoryTable />
        </div>
      )}

      {/* Slide-over Right Progress Drawer (Controlled via Jotai Global State) */}
      <SyncProgressDrawer />
    </div>
  );
}
