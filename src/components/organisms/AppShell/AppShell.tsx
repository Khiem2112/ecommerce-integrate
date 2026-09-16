'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { IconButton } from '@/components/atoms';
import { Breadcrumb } from '@/components/molecules';
import { cn } from '@/lib/cn';
import { LeftSidebar } from './LeftSidebar';
import { FeaturesDrawer } from './FeaturesDrawer';
import { GlobalSyncWidget } from './GlobalSyncWidget';
import { MobileNavigation } from './MobileNavigation';

type AppShellProps = {
  readonly children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const isFullBleed = pathname.startsWith('/conversations');

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[60] rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background focus:not-sr-only"
      >
        {t('skipToContent')}
      </a>

      {/* Collapsible left sidebar */}
      <LeftSidebar />

      {/* Main layout container */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-hairline-strong bg-surface-lifted px-3 sm:px-4">
          {/* Hamburger / Features drawer trigger */}
          <IconButton
            id="features-menu-trigger"
            ariaLabel={t('openFeatureMenu')}
            tooltip={t('featureMenu')}
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="hidden md:grid"
            icon={
              <svg
                aria-hidden="true"
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            }
          />

          {/* Breadcrumb */}
          <Breadcrumb className="min-w-0 flex-1" />
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            isFullBleed
              ? 'overflow-hidden pb-16 md:pb-0'
              : 'custom-scrollbar overflow-x-hidden overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6',
          )}
        >
          {children}
        </main>
      </div>

      {/* Features slide-in drawer */}
      <FeaturesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <MobileNavigation />

      {/* Fixed bottom-right sync indicator */}
      <GlobalSyncWidget />
    </div>
  );
}
