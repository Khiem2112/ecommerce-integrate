import { useTranslations } from 'next-intl';
import { ProgressBar } from '@/components/atoms';
import type { SyncBatchDetailProgress } from '@/types';

type SyncBatchProgressBarProps = {
  readonly progress: SyncBatchDetailProgress;
};

export function SyncBatchProgressBar({ progress }: SyncBatchProgressBarProps) {
  const t = useTranslations('integrations.batchDetail');
  const processed = progress.createdCount + progress.updatedCount + progress.unchangedCount + progress.failedCount;
  return (
    <section className="rounded-2xl border border-status-info/25 bg-status-info/10 p-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-foreground">{t('syncProgress')}</span>
        <span className="font-mono font-semibold text-status-info">{t('progressOrders', { percent: progress.progressPercent, processed, total: progress.totalOrders })}</span>
      </div>
      <ProgressBar value={progress.progressPercent} status={progress.status} aria-label={t('progressAria')} />
    </section>
  );
}
