'use client';

import { useEffect, useState } from 'react';
import type { SyncBatchStatus } from '@/types';

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} phút`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}g ${totalMinutes % 60}p`;
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

  return (
    <span className="text-[11px] text-muted">
      {start.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
      {completedAt && !isActive
        ? ` → ${new Date(completedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}`
        : ' · Đang chạy'}
      {` · ${formatDuration(computedDuration)}`}
    </span>
  );
}
