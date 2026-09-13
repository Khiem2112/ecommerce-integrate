'use client';

/**
 * Result Summary Display for Batch Order Synchronization.
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge, Button } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { SyncResult } from '@/types';

export type SyncResultSummaryProps = {
  readonly result: SyncResult;
  readonly onDismiss?: () => void;
  readonly onRetryFailed?: () => void;
};

export function SyncResultSummary({ result, onDismiss, onRetryFailed }: SyncResultSummaryProps) {
  const isSuccess = result.status === 'completed';
  const isPartial = result.status === 'partial';
  const t = useTranslations('syncResult');

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-lg border',
              isSuccess && 'bg-status-success/10 border-status-success/30 text-status-success',
              isPartial && 'bg-status-warning/10 border-status-warning/30 text-status-warning',
              !isSuccess && !isPartial && 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error',
            )}
          >
            {isSuccess ? (
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {isSuccess ? t('completed') : isPartial ? t('partial') : t('failed')}
            </h4>
            <p className="text-[11px] text-muted font-mono">
              {t('batchCode', { syncId: result.syncId })}
            </p>
          </div>
        </div>

        <Badge
          variant={isSuccess ? 'success' : isPartial ? 'warning' : 'error'}
          size="sm"
        >
          {result.status.toUpperCase()}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-lg bg-surface-lifted border border-hairline p-3 text-center">
          <span className="text-[11px] text-muted block mb-0.5">{t('created')}</span>
          <span className="text-lg font-bold text-status-success">+{result.created}</span>
        </div>
        <div className="rounded-lg bg-surface-lifted border border-hairline p-3 text-center">
          <span className="text-[11px] text-muted block mb-0.5">{t('updated')}</span>
          <span className="text-lg font-bold text-status-info">~{result.updated}</span>
        </div>
        <div className="rounded-lg bg-surface-lifted border border-hairline p-3 text-center">
          <span className="text-[11px] text-muted block mb-0.5">{t('unchanged')}</span>
          <span className="text-lg font-bold text-muted">={result.unchanged}</span>
        </div>
        <div className="rounded-lg bg-surface-lifted border border-hairline p-3 text-center">
          <span className="text-[11px] text-muted block mb-0.5">{t('errors')}</span>
          <span className={cn('text-lg font-bold', result.failed > 0 ? 'text-semantic-error' : 'text-muted')}>
            ×{result.failed}
          </span>
        </div>
      </div>

      {/* Error Details */}
      {result.errors && result.errors.length > 0 && (
        <div className="rounded-lg bg-semantic-error/10 border border-semantic-error/20 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-semantic-error">
              {t('errorDetails', { count: result.errors.length })}
            </span>
            {onRetryFailed && (
              <Button
                variant="outline"
                size="xs"
                onClick={onRetryFailed}
                className="text-[11px] h-6"
              >
                {t('retryFailed')}
              </Button>
            )}
          </div>
          <ul className="space-y-1 text-xs text-foreground/80 max-h-32 overflow-y-auto custom-scrollbar">
            {result.errors.map((err, idx) => (
              <li key={`${err.externalOrderId}-${idx}`} className="flex items-start gap-1.5 font-mono text-[11px]">
                <span className="text-semantic-error font-bold">[{err.externalOrderId}]:</span>
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-hairline/60">
        <Link href={`/settings/integrations/lazada/syncs/${result.syncId}`}>
          <Button
            variant="outline"
            size="xs"
            className="text-xs"
            icon={
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            }
          >
            {t('viewBatchChanges')}
          </Button>
        </Link>

        {onDismiss && (
          <Button variant="secondary" size="xs" onClick={onDismiss}>
            {t('dismiss')}
          </Button>
        )}
      </div>
    </div>
  );
}
