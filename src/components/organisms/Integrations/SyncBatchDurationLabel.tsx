'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { SyncBatchStatus } from '@/types';

function formatDuration(durationMs: number, locale: string, minutesLabel: (count: number) => string): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  if (totalMinutes < 60) return minutesLabel(totalMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return locale === 'vi' ? `${hours}g ${mins}p` : `${hours}h ${mins}m`;
}

type SyncBatchDurationLabelProps = {
  readonly status: SyncBatchStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
};

export function SyncBatchDurationLabel({
  status,
  startedAt,
  completedAt,
  durationMs,
}: SyncBatchDurationLabelProps) {
  const t = useTranslations('integrations.duration');
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const isActive = status === 'running' || status === 'queued';

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const start = new Date(startedAt);
  const computedDuration = isActive
    ? now - start.getTime()
    : durationMs ?? (completedAt ? new Date(completedAt).getTime() - start.getTime() : 0);

  const loc = locale === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <span className="text-[11px] text-muted">
      {start.toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' })}
      {completedAt && !isActive
        ? ` → ${new Date(completedAt).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' })}`
        : t('runningSuffix')}
      {` · ${formatDuration(computedDuration, locale, (count) => t('minutes', { count }))}`}
    </span>
  );
}
