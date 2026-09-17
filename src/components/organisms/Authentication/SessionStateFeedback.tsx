'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuthentication } from '@/hooks/useAuthentication';
import { useToast } from '@/hooks/useToast';

export function SessionStateFeedback() {
  const t = useTranslations('authentication.session');
  const router = useRouter();
  const { computedState } = useAuthentication();
  const { toast } = useToast();
  const notifiedStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!computedState || (computedState !== 'expired' && computedState !== 'revoked')) {
      return;
    }

    if (notifiedStateRef.current === computedState) {
      return;
    }

    notifiedStateRef.current = computedState;
    const isExpired = computedState === 'expired';

    const options = {
      title: isExpired ? t('expiredTitle') : t('revokedTitle'),
      duration: 0,
      action: {
        label: t('loginAgain'),
        onClick: () => router.push('/login'),
      },
    };

    if (isExpired) {
      toast.warning(t('expiredDesc'), options);
    } else {
      toast.error(t('revokedDesc'), options);
    }
  }, [computedState, router, t, toast]);

  return null;
}
