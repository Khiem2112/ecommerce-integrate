'use client';

import Link from 'next/link';
import { useAtom } from 'jotai';
import { cn } from '@/lib/cn';
import { appSidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { IconButton } from '@/components/atoms';
import { NAV_GROUPS } from './navConfig';
import { SidebarNavItem } from './SidebarNavItem';

export function LeftSidebar() {
  const [collapsed, setCollapsed] = useAtom(appSidebarCollapsedAtom);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-hairline bg-surface-card transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo & Collapsed button*/}
      <div
        className={cn(
          'flex h-11 shrink-0 items-center border-b border-hairline px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {collapsed ? (
          <IconButton
            ariaLabel="Expand sidebar"
            tooltip="Expand sidebar"
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(false)}
            icon={
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
                <path d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
              </svg>
            }
          />
        ) : (
          <>
            <Link
              href="/conversations"
              className="flex min-w-0 items-center gap-2.5"
              title="OmniCart Recover"
            >
              {/* Logo mark — stylized "O" mark */}
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-black text-on-primary shadow-xs">
                O
              </div>
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                OmniCart
              </span>
            </Link>

            <IconButton
              ariaLabel="Collapse sidebar"
              tooltip="Collapse sidebar"
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(true)}
              icon={
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
                  <path d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Nav groups — scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-4">
            {/* Group label — hidden when collapsed */}
            {!collapsed && (
              <p className="mb-1 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </p>
            )}
            {collapsed && <div className="mb-2 h-px bg-hairline mx-2" />}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
