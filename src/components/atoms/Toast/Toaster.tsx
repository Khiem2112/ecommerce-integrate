'use client';

import { useTranslations } from 'next-intl';
import { useAtomValue } from 'jotai';
import { toastsAtom } from '@/atoms/toastAtoms';
import { Toast } from './Toast';

export function Toaster() {
  const t = useTranslations('common');
  const toasts = useAtomValue(toastsAtom);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={t('notifications')}
      tabIndex={-1}
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm w-full flex-col gap-2.5 p-4 sm:p-0"
    >
      {toasts.map((item) => (
        <Toast key={item.id} toast={item} />
      ))}
    </div>
  );
}
