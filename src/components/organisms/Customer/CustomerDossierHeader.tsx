'use client';

import Link from 'next/link';
import { useClipboard } from '@/hooks';
import { Badge, Button, IconButton } from '@/components/atoms';
import { VipTierBadge } from '@/components/molecules';
import { formatDate } from '@/utils';
import type { CustomerFullDetail } from '@/types';
import { cn } from '@/lib/cn';

export type CustomerDossierHeaderProps = {
  readonly customer: CustomerFullDetail;
  readonly onEdit: () => void;
};

export function CustomerDossierHeader({
  customer,
  onEdit,
}: CustomerDossierHeaderProps) {
  const { copy, hasCopied } = useClipboard({ timeout: 1500 });
  const vipScorePct = Math.min(100, Math.max(0, customer.vipScore));

  let scoreGradient = 'from-primary to-primary-active';
  if (vipScorePct >= 90) scoreGradient = 'from-purple-500 to-indigo-600';
  else if (vipScorePct >= 70) scoreGradient = 'from-amber-400 to-amber-600';
  else if (vipScorePct >= 40) scoreGradient = 'from-cyan-400 to-cyan-600';

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left identity & badges */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-mono text-xl font-bold tracking-tight text-foreground">
              <span>{customer.platformBuyerId}</span>
              <IconButton
                type="button"
                variant="ghost"
                size="xs"
                ariaLabel={hasCopied ? 'Đã sao chép!' : 'Sao chép Buyer ID'}
                tooltip={hasCopied ? 'Đã sao chép!' : 'Sao chép Buyer ID'}
                onClick={() => copy(customer.platformBuyerId)}
                className="text-muted hover:text-foreground"
              >
                {hasCopied ? (
                  <span className="text-xs text-semantic-success font-sans">✓</span>
                ) : (
                  <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </IconButton>
            </div>

            <Badge variant="secondary" size="sm">
              {customer.platform.name}
            </Badge>

            <VipTierBadge
              code={customer.vipTier.code}
              name={customer.vipTier.name}
            />

            {customer.consentStatus === 'granted' ? (
              <Badge variant="success" size="sm">
                Quyền riêng tư: Đã cấp
              </Badge>
            ) : (
              <Badge variant="secondary" size="sm">
                Quyền riêng tư: Thu hồi
              </Badge>
            )}

            {customer.preferredLanguage && (
              <Badge variant="info" size="sm">
                Ngôn ngữ: {customer.preferredLanguage.toUpperCase()}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              Mã hệ thống: <strong className="font-mono text-foreground">#{customer.id}</strong>
            </span>
            <span>•</span>
            <span>
              Tham gia: <strong className="text-foreground">{formatDate(customer.createdAt)}</strong>
            </span>
            <span>•</span>
            <span>
              Cập nhật gần nhất: <strong className="text-foreground">{formatDate(customer.updatedAt)}</strong>
            </span>
          </div>
        </div>

        {/* Right actions and RFM score highlight */}
        <div className="flex flex-wrap items-center gap-4">
          {/* RFM Score Display */}
          <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-lifted px-3.5 py-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Điểm VIP RFM
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                  {customer.vipScore.toFixed(1)}
                </span>
                <span className="text-xs text-muted">/100</span>
              </div>
            </div>
            <div className="h-8 w-1.5 overflow-hidden rounded-full bg-surface-card border border-hairline">
              <div
                className={cn('w-full rounded-full bg-gradient-to-t', scoreGradient)}
                style={{ height: `${vipScorePct}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onEdit}
              icon={
                <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              }
            >
              Chỉnh sửa hồ sơ
            </Button>

            <Link href="/customers">
              <Button type="button" variant="outline" size="sm">
                Quay lại
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
