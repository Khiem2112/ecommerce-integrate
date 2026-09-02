'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useBreadcrumbValue, type BreadcrumbItem } from '@/hooks';
import { cn } from '@/lib/cn';

export type BreadcrumbProps = {
  readonly rootItem?: BreadcrumbItem;
  readonly items?: readonly BreadcrumbItem[];
  readonly separator?: ReactNode;
  readonly className?: string;
};

export function Breadcrumb({
  rootItem = { label: 'Đơn Hàng', href: '/orders' },
  items,
  separator,
  className,
}: BreadcrumbProps) {
  const dynamicItems = useBreadcrumbValue();
  const displayItems = items ?? dynamicItems;

  const defaultSeparator = (
    <span className="text-muted/60 select-none text-xs">/</span>
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}
    >
      {/* Root Item */}
      {rootItem && (
        <div className="flex items-center gap-1.5">
          {rootItem.href ? (
            <Link
              href={rootItem.href}
              className="font-semibold text-foreground hover:underline transition-colors"
            >
              {rootItem.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{rootItem.label}</span>
          )}
        </div>
      )}

      {/* Dynamic or Explicit Child Items */}
      {displayItems.map((item, index) => {
        const isLast = index === displayItems.length - 1;

        return (
          <div key={`breadcrumb-${item.label}-${index}`} className="flex items-center gap-1.5">
            {separator ?? defaultSeparator}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-muted hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'transition-colors',
                  isLast ? 'font-medium text-foreground' : 'text-muted',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
