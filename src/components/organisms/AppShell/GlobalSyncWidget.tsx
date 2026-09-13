'use client';

import { GlobalSyncIndicator } from '@/components/molecules';

/**
 * Fixed bottom-right floating widget wrapping GlobalSyncIndicator.
 * Only renders when a sync job is active (GlobalSyncIndicator returns null otherwise).
 */
export function GlobalSyncWidget() {
  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
      <GlobalSyncIndicator />
    </div>
  );
}
