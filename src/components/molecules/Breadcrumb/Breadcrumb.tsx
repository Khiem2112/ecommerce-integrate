'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

export type BreadcrumbItem = {
  readonly label: string;
  readonly href?: string;
};

export type BreadcrumbProps = {
  readonly className?: string;
};

/**
 * Route-to-label mapping for the first path segment.
 * Max 2 breadcrumb segments are shown.
 */
const SECTION_LABEL_KEYS: Record<string, string> = {
  conversations: 'workspace',
  orders: 'orders',
  customers: 'customers',
  settings: 'settings',
  integrations: 'integrations',
  lazada: 'lazada',
  new: 'new',
};

function deriveItems(
  pathname: string,
  translate: (key: string) => string,
): readonly BreadcrumbItem[] {
  // Split and filter empty segments
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return [];

  // Flatten: always use section label for first segment
  const sectionKey = segments[0];
  const sectionLabelKey = SECTION_LABEL_KEYS[sectionKey];
  const sectionLabel = sectionLabelKey ? translate(sectionLabelKey) : sectionKey;

  if (segments.length === 1) {
    return [{ label: sectionLabel }];
  }

  // Second segment: prefer label mapping, fallback to ID display
  const childKey = segments[segments.length - 1];
  const childLabelKey = SECTION_LABEL_KEYS[childKey];
  const childLabel = childLabelKey
    ? translate(childLabelKey)
    : childKey.length > 12
      ? `#${childKey.slice(0, 8)}…`
      : `#${childKey}`;

  return [
    { label: sectionLabel, href: `/${sectionKey}` },
    { label: childLabel },
  ];
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  const pathname = usePathname();
  const t = useTranslations('breadcrumb');
  const items = deriveItems(pathname, t);

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
        return (
          <div key={`bc-${index}`} className="flex items-center gap-1.5">
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
