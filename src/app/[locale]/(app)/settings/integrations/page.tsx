'use client';

/**
 * Integration Center Page — /settings/integrations
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useBreadcrumb, useIntegrationSummary } from '@/hooks';
import {
  IntegrationCard,
  SyncHistoryTable,
} from '@/components/organisms';
import { Badge } from '@/components/atoms';

export default function IntegrationsPage() {
  const t = useTranslations('integrations');
  const tBreadcrumb = useTranslations('breadcrumb');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: tBreadcrumb('settings') },
      { label: t('title') },
    ]);
  }, [setBreadcrumb, t, tBreadcrumb]);

  const { data: lazadaSummary, isLoading: isLoadingLazada } = useIntegrationSummary('lazada');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            <Badge variant="teal" size="xs">
              {t('portsAndAdapters')}
            </Badge>
          </div>
          <p className="text-xs text-muted max-w-3xl">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Platform Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          {t('connectionsList')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Lazada Card (Live) */}
          {isLoadingLazada || !lazadaSummary ? (
            <div className="animate-pulse space-y-4 rounded-xl border border-hairline-strong bg-surface-card/75 p-6">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-surface-lifted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 rounded bg-surface-lifted" />
                  <div className="h-3 w-40 rounded bg-surface-lifted" />
                </div>
              </div>
              <div className="h-16 rounded-xl bg-surface-lifted" />
            </div>
          ) : (
            <IntegrationCard
              summary={lazadaSummary}
            />
          )}

          {/* Shopify Card (Placeholder / Secondary) */}
          <div className="flex flex-col justify-between gap-5 rounded-xl border border-hairline-strong bg-surface-card/55 p-5 opacity-80 transition-colors hover:bg-surface-card/80 hover:opacity-100 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-channel-shopify-border bg-channel-shopify-soft text-sm font-bold text-channel-shopify">
                  <span>SHO</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                      {t('shopifyTitle')}
                    </h3>
                    <Badge variant="secondary" size="xs">
                      {t('customApp')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    omnicart-test-shop.myshopify.com
                  </p>
                </div>
              </div>

              <Badge variant="secondary" size="sm" useDot dotClassName="bg-muted">
                <span>{t('readyToConnect')}</span>
              </Badge>
            </div>

            <div className="border-y border-hairline py-3 text-xs text-muted">
              {t('shopifyDesc')}
            </div>

            <div className="pt-2 border-t border-hairline flex justify-end">
              <Badge variant="outline" size="xs">{t('portAdapterReady')}</Badge>
            </div>
          </div>

          {/* TikTok Shop Card (Placeholder / Secondary) */}
          <div className="flex flex-col justify-between gap-5 rounded-xl border border-hairline-strong bg-surface-card/55 p-5 opacity-80 transition-colors hover:bg-surface-card/80 hover:opacity-100 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-hairline-strong bg-foreground/8 text-sm font-bold text-foreground">
                  <span>TTS</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                      {t('tiktokTitle')}
                    </h3>
                    <Badge variant="secondary" size="xs">
                      {t('partnerApi')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    OmniCart TikTok Shop Mall
                  </p>
                </div>
              </div>

              <Badge variant="secondary" size="sm" useDot dotClassName="bg-muted">
                <span>{t('waitingActivation')}</span>
              </Badge>
            </div>

            <div className="border-y border-hairline py-3 text-xs text-muted">
              {t('tiktokDesc')}
            </div>

            <div className="pt-2 border-t border-hairline flex justify-end">
              <Badge variant="outline" size="xs">{t('portAdapterReady')}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronization Run History Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              {t('historyTitle')}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {t('historySubtitle')}
            </p>
          </div>
        </div>

        <SyncHistoryTable />
      </div>
    </div>
  );
}
