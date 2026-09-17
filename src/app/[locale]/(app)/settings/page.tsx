'use client';

import type { JSX } from 'react';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  LanguagePreferencesSection,
  OrganizationContextSection,
  PersonalProfileSection,
} from '@/components/organisms/Settings';
import { useBreadcrumb } from '@/hooks';

export default function SettingsPage(): JSX.Element {
  const t = useTranslations('settings');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([{ label: t('title') }]);
  }, [setBreadcrumb, t]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
      </div>

      {/* Section 1: Thông tin chung */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <PersonalProfileSection />
        <OrganizationContextSection />
      </div>

      <LanguagePreferencesSection />
    </div>
  );
}
