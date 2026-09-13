'use client';

import { useState, type ReactNode } from 'react';
import { IconButton } from '@/components/atoms';
import { Breadcrumb } from '@/components/molecules';
import { LeftSidebar } from './LeftSidebar';
import { FeaturesDrawer } from './FeaturesDrawer';
import { GlobalSyncWidget } from './GlobalSyncWidget';

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Collapsible left sidebar */}
      <LeftSidebar />

      {/* Main layout container */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Slim top bar — 44px */}
        <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-3 border-b border-hairline bg-surface-card px-4">
          {/* Hamburger / Features drawer trigger */}
          <IconButton
            id="features-menu-trigger"
            ariaLabel="Open feature menu"
            tooltip="Feature menu"
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(true)}
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

          <div className="h-4 w-px bg-hairline" />

          {/* Breadcrumb */}
          <Breadcrumb className="min-w-0 flex-1" />
        </header>

        {/* Page content */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {/* Features slide-in drawer */}
      <FeaturesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Fixed bottom-right sync indicator */}
      <GlobalSyncWidget />
    </div>
  );
}
