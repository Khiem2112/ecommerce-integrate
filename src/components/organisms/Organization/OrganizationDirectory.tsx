'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from '@/components/atoms';
import { OrganizationDialog } from './OrganizationDialog';
import {
  ErrorBanner,
  OrganizationConnectedShopCard,
  OrganizationFilterBar,
  OrganizationRoleBadge,
  OrganizationStatusBadge,
  Pagination,
} from '@/components/molecules';
import { useOrganizations } from '@/hooks';
import { cn } from '@/lib/cn';
import type { OrganizationFilters } from '@/types';

export function OrganizationDirectory() {
  const t = useTranslations('organizations');
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filters, setFilters] = useState<OrganizationFilters>({
    page: 1,
    pageSize: 25,
  });
  const [expandedOrgId, setExpandedOrgId] = useState<number | null>(null);

  const { data, isLoading, error } = useOrganizations(filters);

  const handleFilterChange = (newFilters: Partial<OrganizationFilters>) => {
    setFilters((current) => ({
      ...current,
      ...newFilters,
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters((current) => ({ ...current, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setFilters((current) => ({ ...current, pageSize, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({ page: 1, pageSize: filters.pageSize ?? 25 });
  };

  return (
    <section className="space-y-5">
      {/* Directory Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('description')}</p>
        </div>
        <Button size="md" onClick={() => setIsCreateOpen(true)}>
          {t('new')}
        </Button>
      </div>

      {/* Filter Bar with Search Debounce and Status Combobox */}
      <OrganizationFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {error && <ErrorBanner message={t('loadFailed')} />}

      {/* Desktop & Tablet Table Container */}
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('members')}</TableHead>
              <TableHead>{t('shops')}</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">{t('directory.expandShops')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-row-${index}`} className="animate-pulse">
                  <TableCell>
                    <div className="h-4 w-32 rounded bg-hairline" />
                    <div className="mt-1 h-3 w-20 rounded bg-hairline-soft" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-16 rounded-full bg-hairline" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-20 rounded-full bg-hairline" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-8 rounded bg-hairline" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-8 rounded bg-hairline" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="ml-auto h-7 w-7 rounded bg-hairline" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.items && data.items.length > 0 ? (
              data.items.map((organization) => {
                const isExpanded = expandedOrgId === organization.id;

                return (
                  <Fragment key={organization.id}>
                    <TableRow
                      onClick={() =>
                        setExpandedOrgId(isExpanded ? null : organization.id)
                      }
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-surface-lifted/50',
                        isExpanded && 'bg-surface-lifted/40',
                      )}
                      aria-expanded={isExpanded}
                    >
                      <TableCell>
                        <Link
                          href={`/organizations/${organization.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                        >
                          {organization.displayName}
                        </Link>
                        <div className="font-mono text-xs text-muted">
                          {organization.slug}
                        </div>
                      </TableCell>

                      <TableCell>
                        <OrganizationStatusBadge status={organization.status} />
                      </TableCell>

                      <TableCell>
                        <OrganizationRoleBadge role={organization.role} />
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted">
                        {organization.memberCount}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted">
                        {organization.shopCount}
                      </TableCell>

                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'inline-flex size-7 items-center justify-center rounded-lg text-muted transition-transform duration-200',
                            isExpanded && 'rotate-180 text-foreground',
                          )}
                          aria-hidden="true"
                        >
                          <svg
                            className="size-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="border-b border-hairline/80 bg-surface-lifted/20">
                        <TableCell colSpan={6} className="p-4">
                          <div className="space-y-3 rounded-xl border border-hairline/70 bg-surface-card/80 p-4 shadow-xs">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                                {t('directory.connectedShopsCount', {
                                  count: organization.connections.length,
                                })}
                              </h3>
                            </div>

                            {organization.connections.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {organization.connections.map((connection) => (
                                  <OrganizationConnectedShopCard
                                    key={connection.id}
                                    connection={connection}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="py-3 text-center text-xs text-muted">
                                {t('directory.noConnectedShops')}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg
                      aria-hidden="true"
                      className="size-8 text-muted/60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <p className="text-sm text-muted">{t('empty')}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Server-side Pagination Molecule */}
        {data && data.total > 0 && (
          <div className="border-t border-hairline p-3">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              itemLabel={t('title')}
            />
          </div>
        )}
      </div>

      <OrganizationDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={(created) => {
          router.push(`/organizations/${created.id}`);
        }}
      />
    </section>
  );
}
