'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { getNavGroups, type NavItem } from './navConfig';

function hasHref(item: NavItem): item is NavItem & { readonly href: string } {
  return item.href !== undefined;
}

export function MobileNavigation() {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const mobileNavItems = getNavGroups(t).flatMap((group) => group.items).filter(hasHref);
  const activeItem = [...mobileNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find(
      (item) =>
        pathname === item.href ||
        (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
    );

  return (
    <nav
      aria-label={t('primaryNavigation')}
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 w-screen grid-cols-5 border-t border-hairline-strong bg-surface-lifted px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobileNavItems.map((item) => {
        const isActive = item.id === activeItem?.id;

        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
              isActive ? 'font-semibold text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'grid h-6 w-10 place-items-center rounded-full transition-colors',
                isActive && 'bg-status-warning/10 text-status-warning',
              )}
            >
              <svg
                aria-hidden="true"
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.iconPath} />
              </svg>
            </span>
            <span className="w-full truncate text-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
