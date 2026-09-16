'use client';

import { useTranslations } from 'next-intl';
import { useAtom } from 'jotai';
import { cn } from '@/lib/cn';
import { appSidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { IconButton } from '@/components/atoms';
import { OrganizationSwitcher } from '../Organization/OrganizationSwitcher';
import { getNavGroups } from './navConfig';
import { SidebarNavItem } from './SidebarNavItem';

export function LeftSidebar() {
  const [collapsed, setCollapsed] = useAtom(appSidebarCollapsedAtom);
  const t = useTranslations('navigation');
  const navGroups = getNavGroups(t);

  return (
    <aside
      className={cn(
        'hidden h-full shrink-0 flex-col border-r border-hairline-strong bg-surface-lifted transition-[width] duration-200 ease-in-out md:flex',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo & Collapsed button*/}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-hairline-strong px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {collapsed ? (
          <IconButton
            ariaLabel={t('expandSidebar')}
            tooltip={t('expandSidebar')}
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
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
            <OrganizationSwitcher />
            <IconButton
              ariaLabel={t('collapseSidebar')}
              tooltip={t('collapseSidebar')}
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
          </div>
        )}
      </div>

      {/* Nav groups — scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.id} className="mb-4">
            {/* Group label — hidden when collapsed */}
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {group.label}
              </p>
            )}
            {collapsed && <div className="mx-2 mb-2 h-px bg-hairline" />}
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
