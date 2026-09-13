'use client';

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms';
import { SyncFieldDiffTable } from '@/components/molecules';
import { useSyncOrderDiff } from '@/hooks';
import type { FieldDiff, SyncChangeType, SyncFieldDiff } from '@/types';

function toDiffRecord(fields: readonly SyncFieldDiff[]): Record<string, FieldDiff> {
  return Object.fromEntries(fields.map((field) => [field.fieldName, { before: field.before, after: field.after }]));
}

function itemVariant(changeType: SyncChangeType): 'success' | 'info' | 'warning' | 'secondary' {
  if (changeType === 'created') return 'success';
  if (changeType === 'updated') return 'info';
  if (changeType === 'inactivated') return 'warning';
  return 'secondary';
}

type SyncOrderDiffPanelProps = {
  readonly batchId: number;
  readonly selectedOrderId: string | null;
  readonly onClose: () => void;
};

export function SyncOrderDiffPanel({ batchId, selectedOrderId, onClose }: SyncOrderDiffPanelProps) {
  const t = useTranslations('integrations.batchDetail');
  const tDiff = useTranslations('integrations.diff');
  const locale = useLocale() === 'vi' ? 'vi-VN' : 'en-US';
  const result = useSyncOrderDiff(batchId, selectedOrderId);
  return (
    <Dialog open={Boolean(selectedOrderId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        aria-describedby="sync-order-diff-description"
        className="inset-y-0 left-auto right-0 top-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-y-0 border-r-0 p-0 sm:max-w-105"
      >
        <div className="sticky top-0 z-10 border-b border-hairline bg-surface-card p-5 pr-12">
          <DialogTitle className="break-all font-mono">{selectedOrderId}</DialogTitle>
          <DialogDescription id="sync-order-diff-description" className="mt-1">{t('diffDescription')}</DialogDescription>
          {result.data && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={result.data.changeType === 'created' ? 'success' : result.data.changeType === 'failed' ? 'error' : result.data.changeType === 'unchanged' ? 'secondary' : 'info'} size="xs">
                {result.data.changeType === 'created' ? t('created') : result.data.changeType === 'failed' ? t('failed') : result.data.changeType === 'unchanged' ? t('unchanged') : t('updated')}
              </Badge>
              {result.data.internalOrderId && <span className="text-[11px] text-muted">{t('internalOrder', { id: result.data.internalOrderId })}</span>}
              <span className="text-[11px] text-muted">{new Date(result.data.syncedAt).toLocaleString(locale)}</span>
            </div>
          )}
        </div>
        <div className="space-y-5 p-5">
          {result.isLoading ? (
            <div className="space-y-3 motion-safe:animate-pulse" aria-busy="true">
              <div className="h-28 rounded-xl bg-surface-strong" /><div className="h-48 rounded-xl bg-surface-strong" />
            </div>
          ) : result.error ? (
            <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4" role="alert">
              <p className="text-sm font-semibold text-foreground">{t('loadDiffError')}</p>
              <p className="mt-1 text-xs text-muted">{result.error.message}</p>
              <Button className="mt-3" size="sm" onClick={() => result.refetch()}>{t('retryLoadBtn')}</Button>
            </div>
          ) : result.data ? (
            <>
              {result.data.errorMessage && (
                <section className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-semantic-error">{t('orderProcessingError')}</h2>
                    <Badge variant={result.data.retryEligible ? 'warning' : 'error'} size="xs">{result.data.retryEligible ? t('eligibleForRetry') : t('manualHandling')}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">{result.data.errorMessage}</p>
                  <p className="mt-2 text-[11px] text-muted">{t(`errorGuidance.${result.data.errorCategory ?? 'unknown'}`)}</p>
                </section>
              )}
              <section className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wide text-foreground">{tDiff('headerDiffTitle')}</h2>
                {result.data.orderFields.length > 0
                  ? <SyncFieldDiffTable diffs={toDiffRecord(result.data.orderFields)} size="sm" />
                  : <p className="rounded-xl border border-hairline bg-surface-lifted p-4 text-xs text-muted">{t('noHeaderChanges')}</p>}
              </section>
              <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-foreground">{t('itemGroupsTitle', { count: result.data.itemGroups.length })}</h2>
                {result.data.itemGroups.length === 0 ? (
                  <p className="rounded-xl border border-hairline bg-surface-lifted p-4 text-xs text-muted">{t('noItemChanges')}</p>
                ) : result.data.itemGroups.map((item) => (
                  <article key={item.entityId} className="space-y-2 rounded-xl border border-hairline bg-surface-lifted p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="break-all font-mono text-[11px] font-semibold text-foreground">{item.entityId}</span>
                      <Badge variant={itemVariant(item.changeType)} size="xs">{item.changeType === 'created' ? tDiff('addItem') : item.changeType === 'updated' ? tDiff('updateItem') : item.changeType === 'inactivated' ? tDiff('inactivateItem') : tDiff('orderUnchanged')}</Badge>
                    </div>
                    <SyncFieldDiffTable diffs={toDiffRecord(item.fields)} size="sm" />
                  </article>
                ))}
              </section>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
