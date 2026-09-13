'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { NavItem } from './navConfig';

type SidebarNavItemProps = {
  readonly item: NavItem;
  readonly collapsed: boolean;
};

export function SidebarNavItem({ item, collapsed }: SidebarNavItemProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const hasSubItems = item.subItems && item.subItems.length > 0;

  // Active if current path starts with the item's href
  const isActive = item.href
    ? pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
    : false;

  // Any sub-item active
  const isSubActive =
    hasSubItems &&
    item.subItems!.some(
      (sub) => pathname === sub.href || pathname.startsWith(sub.href + '/'),
    );

  const rowBase =
    'group relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150';
  const rowActive =
    'bg-status-warning/8 text-foreground before:absolute before:left-0 before:h-5 before:w-px before:rounded-full before:bg-status-warning';
  const rowInactive = 'text-muted hover:bg-surface-strong/60 hover:text-foreground';

  const icon = (
    <svg
      aria-hidden="true"
      className={cn(
        'size-5 shrink-0 transition-colors',
        isActive || isSubActive
          ? 'text-status-warning'
          : 'text-muted group-hover:text-foreground',
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={item.iconPath} />
    </svg>
  );

  // Collapsed: icon only + tooltip via title
  if (collapsed) {
    return (
      <li>
        <Link
          href={item.href ?? '#'}
          title={item.label}
          className={cn(
            rowBase,
            'justify-center px-2',
            isActive || isSubActive ? rowActive : rowInactive,
          )}
        >
          {icon}
        </Link>
      </li>
    );
  }

  // No sub-items: simple link
  if (!hasSubItems) {
    return (
      <li>
        <Link
          href={item.href ?? '#'}
          className={cn(rowBase, isActive ? rowActive : rowInactive)}
        >
          {icon}
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    );
  }

  // Has sub-items: accordion
  const accordionOpen = open || isSubActive;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          rowBase,
          'w-full',
          isActive || isSubActive ? rowActive : rowInactive,
        )}
        aria-expanded={accordionOpen}
      >
        {icon}
        <span className="flex-1 truncate text-left">{item.label}</span>
        {/* Chevron */}
        <svg
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-muted transition-transform duration-200',
            accordionOpen && 'rotate-90',
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {accordionOpen && (
        <ul className="mt-0.5 ml-8 flex flex-col gap-0.5 border-l border-hairline pl-3">
          {item.subItems!.map((sub) => {
            const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
            return (
              <li key={sub.href}>
                <Link
                  href={sub.href}
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150',
                    subActive
                      ? 'text-primary'
                      : 'text-muted hover:text-foreground',
                  )}
                  aria-current={subActive ? 'page' : undefined}
                >
                  {sub.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
