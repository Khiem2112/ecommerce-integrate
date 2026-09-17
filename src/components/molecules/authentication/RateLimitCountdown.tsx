'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export type RateLimitCountdownProps = {
  readonly retryAfterSeconds: number;
  readonly onTimeout: () => void;
};

export function RateLimitCountdown({
  retryAfterSeconds,
  onTimeout,
}: RateLimitCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(retryAfterSeconds);
  const t = useTranslations('authentication.login');

  useEffect(() => {
    setSecondsRemaining(retryAfterSeconds);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onTimeout();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, onTimeout]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-status-warning"
    >
      <svg
        aria-hidden="true"
        className="size-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div>
        <p className="font-semibold">{t('rateLimitTitle')}</p>
        <p className="mt-0.5">{t('rateLimitCountdown', { time: timeFormatted })}</p>
      </div>
    </div>
  );
}
