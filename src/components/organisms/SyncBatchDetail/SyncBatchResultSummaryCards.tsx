import { useTranslations } from 'next-intl';
import { Chip } from '@/components/atoms';
import type { SyncBatchDetail, SyncBatchDetailProgress } from '@/types';

type SyncBatchResultSummaryCardsProps = {
  readonly detail: SyncBatchDetail;
  readonly progress?: SyncBatchDetailProgress;
};

export function SyncBatchResultSummaryCards({ detail, progress }: SyncBatchResultSummaryCardsProps) {
  const t = useTranslations('integrations.batchDetail');
  const counters = progress ?? detail;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('summaryAria')}>
      <Chip label={t('created')} value={counters.createdCount} prefix="+" variant="success" size="md" />
      <Chip label={t('updated')} value={counters.updatedCount} prefix="~" variant="info" size="md" />
      <Chip label={t('unchanged')} value={counters.unchangedCount} prefix="=" variant="muted" size="md" />
      <Chip label={t('failed')} value={counters.failedCount} prefix="!" variant="error" size="md" />
    </section>
  );
}
