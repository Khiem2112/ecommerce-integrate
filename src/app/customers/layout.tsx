'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/atoms';
import { Breadcrumb } from '@/components/molecules';

export default function CustomersLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-surface-card px-4 shadow-xs md:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-xs text-muted transition hover:text-foreground"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-surface-lifted border border-hairline group-hover:border-hairline-strong transition">
              <svg aria-hidden="true" className="size-4 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </div>
            <span className="font-medium hidden sm:inline">Trở về Workspace</span>
          </Link>

          <div className="h-4 w-px bg-hairline" />

          {/* Dynamic Breadcrumbs Molecule */}
          <Breadcrumb />
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" size="sm">
            Hồ sơ Khách hàng 360°
          </Badge>
          <Link
            href="/orders"
            className="rounded-md bg-surface-lifted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-card border border-hairline transition"
          >
            Đơn hàng
          </Link>
          <Link
            href="/"
            className="rounded-md bg-surface-lifted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-card border border-hairline transition"
          >
            Copilot Chat
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="custom-scrollbar flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
