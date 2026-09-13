'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const LANGUAGE_OPTIONS = [
  { value: 'vi', flag: '🇻🇳', labelKey: 'vietnamese' },
  { value: 'en', flag: '🇬🇧', labelKey: 'english' },
] as const;

export default function SettingsPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('settings');

  const handleLocaleChange = (newLocale: 'vi' | 'en'): void => {
    router.replace('/settings', { locale: newLocale });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
      </div>

      <section className="space-y-4 rounded-lg border border-hairline bg-surface-card p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('language')}</h2>
          <p className="mt-0.5 text-xs text-muted">{t('languageDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = locale === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleLocaleChange(option.value)}
                aria-pressed={isSelected}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
                  isSelected
                    ? 'border-primary bg-primary/5 font-medium text-primary'
                    : 'border-hairline bg-surface-lifted text-foreground hover:border-foreground/30',
                )}
              >
                <span aria-hidden="true">{option.flag}</span>
                <span>{t(option.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
