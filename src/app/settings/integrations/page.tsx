'use client';

/**
 * Integration Center Page — /settings/integrations
 */

import { useState, useEffect } from 'react';
import { useBreadcrumb, useIntegrationSummary } from '@/hooks';
import {
  IntegrationCard,
  SyncResultSummary,
  SyncHistoryTable,
} from '@/components/organisms';
import { Badge } from '@/components/atoms';
import type { SyncResult } from '@/types';

export default function IntegrationsPage() {
  const { setBreadcrumb } = useBreadcrumb();
  const [recentSyncResult, setRecentSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    setBreadcrumb([
      { label: 'Cài đặt' },
      { label: 'Kênh tích hợp' },
    ]);
  }, [setBreadcrumb]);

  const { data: lazadaSummary, isLoading: isLoadingLazada } = useIntegrationSummary('lazada');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Trung tâm Tích hợp Kênh Sàn (Integration Center)
            </h1>
            <Badge variant="teal" size="xs">
              Ports & Adapters
            </Badge>
          </div>
          <p className="text-xs text-muted max-w-3xl">
            Quản lý kết nối API sàn thương mại điện tử, kiểm tra tính hợp lệ chữ ký số HMAC-SHA256 và đồng bộ dữ liệu đơn hàng authoritative từ Lazada Open Platform.
          </p>
        </div>
      </div>

      {/* Sync Result Alert Banner */}
      {recentSyncResult && (
        <SyncResultSummary
          result={recentSyncResult}
          onDismiss={() => setRecentSyncResult(null)}
        />
      )}

      {/* Platform Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          Danh sách kết nối kênh bán hàng
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Lazada Card (Live) */}
          {isLoadingLazada || !lazadaSummary ? (
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-surface-lifted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 rounded bg-surface-lifted" />
                  <div className="h-3 w-40 rounded bg-surface-lifted" />
                </div>
              </div>
              <div className="h-16 rounded-xl bg-surface-lifted" />
            </div>
          ) : (
            <IntegrationCard
              summary={lazadaSummary}
              onSyncComplete={(result) => setRecentSyncResult(result)}
            />
          )}

          {/* Shopify Card (Placeholder / Secondary) */}
          <div className="rounded-2xl border border-hairline bg-surface-card/60 p-5 sm:p-6 shadow-card flex flex-col justify-between gap-5 opacity-80 hover:opacity-100 transition">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-channel-shopify-soft border border-channel-shopify-border text-channel-shopify font-bold text-sm shadow-xs">
                  <span>SHO</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                      Shopify Store
                    </h3>
                    <Badge variant="secondary" size="xs">
                      CUSTOM APP
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    omnicart-test-shop.myshopify.com
                  </p>
                </div>
              </div>

              <Badge variant="secondary" size="sm" useDot dotClassName="bg-muted">
                <span>Sẵn sàng kết nối</span>
              </Badge>
            </div>

            <div className="rounded-xl bg-surface-lifted border border-hairline p-3 text-xs text-muted">
              Được thiết kế theo chuẩn Ports & Adapters. Có thể cắm thêm `ShopifyConnector` mà không ảnh hưởng luồng nghiệp vụ.
            </div>

            <div className="pt-2 border-t border-hairline flex justify-end">
              <Badge variant="outline" size="xs">Port Adapter Sẵn Sàng</Badge>
            </div>
          </div>

          {/* TikTok Shop Card (Placeholder / Secondary) */}
          <div className="rounded-2xl border border-hairline bg-surface-card/60 p-5 sm:p-6 shadow-card flex flex-col justify-between gap-5 opacity-80 hover:opacity-100 transition">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground/10 border border-hairline text-foreground font-bold text-sm shadow-xs">
                  <span>TTS</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                      TikTok Shop
                    </h3>
                    <Badge variant="secondary" size="xs">
                      PARTNER API
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    OmniCart TikTok Shop Mall
                  </p>
                </div>
              </div>

              <Badge variant="secondary" size="sm" useDot dotClassName="bg-muted">
                <span>Chờ kích hoạt</span>
              </Badge>
            </div>

            <div className="rounded-xl bg-surface-lifted border border-hairline p-3 text-xs text-muted">
              Hỗ trợ kiến trúc đa kênh, đồng bộ đơn hàng và tin nhắn chăm sóc khách hàng VIP trên TikTok Shop.
            </div>

            <div className="pt-2 border-t border-hairline flex justify-end">
              <Badge variant="outline" size="xs">Port Adapter Sẵn Sàng</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronization Run History Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Nhật ký lịch sử đồng bộ đơn hàng
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Theo dõi chi tiết các đợt đồng bộ, số lượng tạo mới, cập nhật, và chi tiết lỗi nếu có.
            </p>
          </div>
        </div>

        <SyncHistoryTable />
      </div>
    </div>
  );
}
