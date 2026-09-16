'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useBreadcrumbValue, type BreadcrumbItem } from '@/hooks';
import { cn } from '@/lib/cn';

export type { BreadcrumbItem };

export type BreadcrumbProps = {
  readonly items?: readonly BreadcrumbItem[];
  readonly className?: string;
};

export function Breadcrumb({ items: propItems, className }: BreadcrumbProps) {
  const atomItems = useBreadcrumbValue();
  const items = propItems ?? atomItems;
  const t = useTranslations('breadcrumb');

  if (items.length === 0) return null;

  const separator = (
    <svg
      aria-hidden="true"
      className="size-3 text-muted-soft"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );

  return (
    <nav
      aria-label={t('label')}
      className={cn('flex flex-wrap items-center gap-1.5 text-sm', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const itemKey = `breadcrumb-${item.label}-${item.href ?? index}`;

        return (
          <div key={itemKey} className="flex items-center gap-1.5">
            {index > 0 && separator}
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

