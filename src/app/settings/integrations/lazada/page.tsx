'use client';

/**
 * Detailed Lazada Integration Screen — /settings/integrations/lazada
 * 4 Tabs: Tổng quan, Đồng bộ, Thông tin xác thực, Nhật ký
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBreadcrumb, useIntegrationSummary, useCheckConnectionHealth, useSyncLazadaOrders, useMockSeeds } from '@/hooks';
import {
  Badge,
  Button,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/atoms';
import { ConnectionStatus, SyncResultSummary, SyncHistoryTable } from '@/components/organisms';
import { cn } from '@/lib/cn';
import type { SyncResult, FetchOrdersParams } from '@/types';

type LazadaTabKey = 'overview' | 'sync' | 'credentials' | 'logs';

export default function LazadaIntegrationDetailPage() {
  const { setBreadcrumb } = useBreadcrumb();
  const [activeTab, setActiveTab] = useState<LazadaTabKey>('overview');

  // Sync Form State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(50);
  const [seed, setSeed] = useState<string>('default');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumb([
      { label: 'Cài đặt' },
      { label: 'Kênh tích hợp', href: '/settings/integrations' },
      { label: 'Lazada Open Platform' },
    ]);
  }, [setBreadcrumb]);

  const { data: summary, isLoading: isLoadingSummary } = useIntegrationSummary('lazada');
  const { mutateAsync: checkHealth, isPending: isCheckingHealth } = useCheckConnectionHealth('lazada');
  const { mutateAsync: syncOrders, isPending: isSyncing } = useSyncLazadaOrders();
  const { data: seeds } = useMockSeeds();

  const handleRunSync = async () => {
    setSyncError(null);
    try {
      const params: FetchOrdersParams = {
        pageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(seed ? { seed } : {}),
      };
      const res = await syncOrders(params);
      setSyncResult(res);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Đồng bộ thất bại');
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
                Thiết lập bộ lọc và kéo dữ liệu mới nhất từ Lazada vào cơ sở dữ liệu hệ thống.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Seed Dataset selector */}
              {seeds && seeds.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="seed-tab-select" className="font-semibold text-foreground flex items-center justify-between">
                    <span>Bộ dữ liệu Mock Server (Seed Dataset)</span>
                    <Badge variant="teal" size="xs">Mock Mode</Badge>
                  </label>
                  <Select
                    id="seed-tab-select"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  >
                    {seeds.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.name} ({s.orderCount} đơn) — {s.description}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label htmlFor="status-tab-select" className="font-semibold text-foreground">
                  Trạng thái đơn hàng cần đồng bộ
                </label>
                <Select
                  id="status-tab-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="unpaid">Chờ thanh toán (Unpaid)</option>
                  <option value="ready_to_ship">Sẵn sàng giao (Ready to Ship)</option>
                  <option value="shipped">Đang giao hàng (Shipped)</option>
                  <option value="delivered">Đã giao thành công (Delivered)</option>
                  <option value="canceled">Đã hủy (Canceled)</option>
                  <option value="returned">Đổi trả / Hoàn tiền (Returned)</option>
                </Select>
              </div>

              {/* Page size limit */}
              <div className="space-y-1.5">
                <label htmlFor="limit-tab-select" className="font-semibold text-foreground">
                  Giới hạn số lượng đơn hàng mỗi đợt
                </label>
                <Select
                  id="limit-tab-select"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={20}>20 đơn hàng</option>
                  <option value={50}>50 đơn hàng (Khuyến nghị)</option>
                  <option value={100}>100 đơn hàng</option>
                </Select>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline flex items-center justify-between">
              <span className="text-[11px] text-muted">
                Tiến trình chạy tự động qua Server Action & Prisma Transaction
              </span>

              <Button
                variant="primary"
                size="md"
                isLoading={isSyncing}
                onClick={handleRunSync}
                icon={
                  <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                }
              >
                {isSyncing ? 'Đang thực hiện đồng bộ...' : 'Bắt đầu đồng bộ ngay'}
              </Button>
            </div>
          </div>
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
    </div>
  );
}
