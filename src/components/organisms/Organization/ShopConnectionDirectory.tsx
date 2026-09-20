'use client';

import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { SHOP_CONNECTION_HEALTH_STATUS_CODES } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  Combobox,
  type ComboboxItem,
  MultiSelectCombobox,
  type MultiSelectItem,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/atoms';
import { cn } from '@/lib/cn';
import {
  ErrorBanner,
  Pagination,
  ShopConnectionAlertBanner,
  ShopConnectionSummaryStats,
  ShopConnectionStatusBadge,
} from '@/components/molecules';
import { useManageableOrganizations, useShopConnectionStats, useShopConnections } from '@/hooks';
import { ShopConnectionAuthorizationDialog } from './ShopConnectionAuthorizationDialog';
import { ShopConnectionLabelDialog } from './ShopConnectionLabelDialog';
import { ShopConnectionDisconnectDialog } from './ShopConnectionDisconnectDialog';
import { ShopConnectionReassignDialog } from './ShopConnectionReassignDialog';
import type {
  ShopConnectionHealthStatusCode,
  ShopConnectionFilters,
  ShopConnectionSummary,
  SupportedShopPlatformCode,
} from '@/types';

type ShopConnectionRowActionsProps = {
  readonly connection: ShopConnectionSummary;
  readonly onOpenLabel: () => void;
  readonly onOpenReassign: () => void;
  readonly onOpenDisconnect: () => void;
  readonly onOpenReconnect: () => void;
};

function ShopConnectionRowActions({
  connection,
  onOpenLabel,
  onOpenReassign,
  onOpenDisconnect,
  onOpenReconnect,
}: ShopConnectionRowActionsProps): JSX.Element {
  const t = useTranslations('shops.directory.actions');
  const shouldOfferReconnect = connection.status === 'reconnect_required' || connection.isExpiringSoon;
  const reconnectClassName = connection.status === 'reconnect_required'
    ? 'border-semantic-error/40 text-semantic-error hover:bg-semantic-error/10'
    : 'border-status-warning/40 text-status-warning hover:bg-status-warning/10';

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link href={`/shops/${connection.id}`}>
        <Button variant="ghost" size="xs">
          {t('view')}
        </Button>
      </Link>

      {shouldOfferReconnect && (
        <Button
          variant="outline"
          size="xs"
          className={`${reconnectClassName} font-medium`}
          onClick={onOpenReconnect}
        >
          {t('reconnect')}
        </Button>
      )}

      {/* Overflow Menu with DropdownMenu atom and IconButton trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            variant="outline"
            size="xs"
            ariaLabel={t('moreActions')}
            tooltip={t('moreActions')}
            className="size-7"
            icon={
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM16 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
              </svg>
            }
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-[150px]">
          <DropdownMenuItem onSelect={onOpenLabel}>
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenReassign}>
            {t('reassign')}
          </DropdownMenuItem>
          {connection.status !== 'disconnected' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onOpenDisconnect}>
                {t('disconnect')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ShopConnectionDirectory(): JSX.Element {
  const t = useTranslations('shops.directory');
  const tStatuses = useTranslations('shops.statuses');
  const router = useRouter();
  const searchParams = useSearchParams();
  const directoryRef = useRef<HTMLDivElement>(null);

  const filters = useMemo<ShopConnectionFilters>(() => {
    const statuses = (searchParams.get('status') ?? '')
      .split(',')
      .filter((status): status is ShopConnectionHealthStatusCode =>
        SHOP_CONNECTION_HEALTH_STATUS_CODES.includes(status as ShopConnectionHealthStatusCode),
      );
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('pageSize') ?? '25');
    const organizationId = Number(searchParams.get('organizationId') ?? '');

    return {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 25,
      status: statuses.length > 0 ? statuses : undefined,
      organizationId: Number.isInteger(organizationId) && organizationId > 0
        ? organizationId
        : undefined,
    };
  }, [searchParams]);

  const { data, isLoading, error } = useShopConnections(filters);
  const {
    data: stats,
    isLoading: isStatsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useShopConnectionStats(filters.organizationId);
  const { data: manageableOrgs } = useManageableOrganizations();

  // Active dialogs state
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [activeConnection, setActiveConnection] = useState<ShopConnectionSummary | null>(null);
  const [dialogMode, setDialogMode] = useState<'label' | 'disconnect' | 'reassign' | 'reconnect' | null>(null);

  const statusItems: readonly MultiSelectItem[] = useMemo(
    () => [
      {
        value: 'connected',
        label: tStatuses('connected'),
        dotColor: 'bg-status-success',
      },
      {
        value: 'expiring_soon',
        label: tStatuses('expiring_soon'),
        dotColor: 'bg-status-warning',
      },
      {
        value: 'reconnect_required',
        label: tStatuses('reconnect_required'),
        dotColor: 'bg-status-warning',
      },
      {
        value: 'disconnecting',
        label: tStatuses('disconnecting'),
        dotColor: 'bg-muted',
      },
      {
        value: 'reassigning',
        label: tStatuses('reassigning'),
        dotColor: 'bg-status-warning',
      },
      {
        value: 'disconnected',
        label: tStatuses('disconnected'),
        dotColor: 'bg-semantic-error',
      },
    ],
    [tStatuses],
  );

  const selectedStatuses = useMemo<string[]>(() => {
    if (!filters.status) return [];
    return Array.isArray(filters.status) ? filters.status : [filters.status];
  }, [filters.status]);

  const updateFilters = useCallback((nextFilters: ShopConnectionFilters) => {
    const params = new URLSearchParams();
    if (nextFilters.status && nextFilters.status.length > 0) {
      params.set('status', nextFilters.status.join(','));
    }
    if (nextFilters.organizationId) {
      params.set('organizationId', String(nextFilters.organizationId));
    }
    params.set('page', String(nextFilters.page ?? 1));
    if (nextFilters.pageSize && nextFilters.pageSize !== 25) {
      params.set('pageSize', String(nextFilters.pageSize));
    }
    router.push(`/shops?${params.toString()}`);
  }, [router]);

  const handleStatusChange = (newStatuses: string[]) => {
    updateFilters({
      ...filters,
      status: newStatuses.length > 0 ? (newStatuses as ShopConnectionHealthStatusCode[]) : undefined,
      page: 1,
    });
  };

  const handleRemoveStatus = (statusToRemove: string) => {
    handleStatusChange(selectedStatuses.filter((s) => s !== statusToRemove));
  };

  const handleOrgChange = (orgIdStr: string) => {
    const orgId = orgIdStr && orgIdStr !== 'ALL' ? Number(orgIdStr) : undefined;
    updateFilters({ ...filters, organizationId: orgId, page: 1 });
  };

  const orgItems: readonly ComboboxItem[] = useMemo(
    () => [
      { value: 'ALL', label: t('allOrganizations') },
      ...(manageableOrgs?.map((org) => ({
        value: String(org.id),
        label: org.displayName,
      })) ?? []),
    ],
    [manageableOrgs, t],
  );

  const handleResetFilters = () => {
    updateFilters({ page: 1, pageSize: filters.pageSize ?? 25 });
  };

  const activeQuickFilter = selectedStatuses.length === 1
    ? selectedStatuses[0] as ShopConnectionHealthStatusCode
    : undefined;

  const handleQuickFilterToggle = useCallback((status: ShopConnectionHealthStatusCode) => {
    updateFilters({
      ...filters,
      status: activeQuickFilter === status ? undefined : [status],
      page: 1,
    });
  }, [activeQuickFilter, filters, updateFilters]);

  const handleReconnectRequired = useCallback(() => {
    handleQuickFilterToggle('reconnect_required');
    directoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [handleQuickFilterToggle]);

  const hasActiveFilters = Boolean(
    (Array.isArray(filters.status) && filters.status.length > 0) ||
    filters.organizationId,
  );

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
        <Button size="md" onClick={() => setIsConnectOpen(true)}>
          {t('connectShop')}
        </Button>
      </div>

      {isStatsLoading && (
        <div aria-hidden="true" className="h-16 animate-pulse rounded-2xl border border-hairline bg-surface-card" />
      )}

      {statsError && (
        <ErrorBanner message={t('statsLoadFailed')} onRetry={() => void refetchStats()} />
      )}

      {stats && (
        <ShopConnectionSummaryStats
          stats={stats}
          activeStatus={activeQuickFilter}
          onStatusToggle={handleQuickFilterToggle}
        />
      )}

      {stats && (
        <ShopConnectionAlertBanner
          reconnectRequiredCount={stats.reconnectRequired}
          onViewReconnectRequired={handleReconnectRequired}
        />
      )}

      {/* Filter Toolbar */}
      <div ref={directoryRef} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-muted mr-0.5">
            {t('filterStatus')}:
          </span>

          <div className="w-48">
            <MultiSelectCombobox
              items={statusItems}
              values={selectedStatuses}
              onChange={handleStatusChange}
              placeholder={t('selectStatus')}
              ariaLabel={t('filterStatus')}
              size="sm"
              countLabel={(count) => t('selectedStatusesCount', { count })}
            />
          </div>

          {/* Selected badges displayed beside the filter button with "x" button at top corner */}
          {selectedStatuses.map((s) => {
            const statusKey = s as ShopConnectionHealthStatusCode;
            return (
              <ShopConnectionStatusBadge
                key={s}
                status={s}
                size="xs"
                useDot={true}
                onRemove={() => handleRemoveStatus(s)}
                removePlacement="top-right"
                removeAriaLabel={t('removeStatusFilter', { status: tStatuses(statusKey) })}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Organization filter (rendered if actor has manageable organizations) */}
          {manageableOrgs && manageableOrgs.length > 1 && (
            <div className="w-48">
              <Combobox
                items={orgItems}
                value={filters.organizationId ? String(filters.organizationId) : 'ALL'}
                onChange={handleOrgChange}
                placeholder={t('allOrganizations')}
                size="sm"
                searchable={manageableOrgs.length > 5}
                ariaLabel={t('allOrganizations')}
              />
            </div>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="xs" onClick={handleResetFilters}>
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={t('loadFailed')} />}

      {/* Desktop & Tablet Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.shop')}</TableHead>
              <TableHead>{t('columns.platform')}</TableHead>
              <TableHead>{t('columns.organization')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.lastVerified')}</TableHead>
              <TableHead className="text-right">{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <div className="h-10 w-full animate-pulse rounded-lg bg-surface-lifted/50" />
                  </TableCell>
                </TableRow>
              ))
            ) : data && data.items.length > 0 ? (
              data.items.map((conn) => (
                <TableRow key={conn.id} className="hover:bg-surface-lifted/40">
                  <TableCell className="font-medium">
                    <Link
                      href={`/shops/${conn.id}`}
                      className="text-foreground hover:text-primary hover:underline font-semibold"
                    >
                      {conn.displayLabel ?? conn.shopName ?? conn.platformName}
                    </Link>
                    {conn.shopName && conn.displayLabel && (
                      <p className="font-mono text-xs text-muted truncate max-w-xs">
                        {conn.shopName}
                      </p>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" size="xs">
                      {conn.platformName}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted">
                    {conn.organizationName}
                  </TableCell>

                  <TableCell>
                    <ShopConnectionStatusBadge
                      status={conn.isExpiringSoon ? 'expiring_soon' : conn.status}
                      expiresAt={conn.tokenExpiresAt ?? conn.refreshTokenExpiresAt}
                      size="xs"
                    />
                  </TableCell>

                  <TableCell className="text-xs font-mono text-muted">
                    {conn.lastVerifiedAt
                      ? new Date(conn.lastVerifiedAt).toLocaleDateString()
                      : conn.lastSyncedAt
                        ? new Date(conn.lastSyncedAt).toLocaleDateString()
                        : t('never')}
                  </TableCell>

                  <TableCell className="text-right">
                    <ShopConnectionRowActions
                      connection={conn}
                      onOpenLabel={() => {
                        setActiveConnection(conn);
                        setDialogMode('label');
                      }}
                      onOpenReassign={() => {
                        setActiveConnection(conn);
                        setDialogMode('reassign');
                      }}
                      onOpenDisconnect={() => {
                        setActiveConnection(conn);
                        setDialogMode('disconnect');
                      }}
                      onOpenReconnect={() => {
                        setActiveConnection(conn);
                        setDialogMode('reconnect');
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center p-6">
                    <p className="text-sm font-semibold text-foreground">
                      {hasActiveFilters ? t('noFilterResults') : t('emptyTitle')}
                    </p>
                    <p className="mt-1 text-xs text-muted max-w-sm">
                      {hasActiveFilters
                        ? t('noFilterResultsDescription')
                        : t('emptyDescription')}
                    </p>
                    {hasActiveFilters ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleResetFilters}
                      >
                        {t('clearFilters')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => setIsConnectOpen(true)}
                      >
                        {t('connectShop')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card Layout */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-hairline bg-surface-card"
            />
          ))
        ) : data && data.items.length > 0 ? (
          data.items.map((conn) => (
            <div
              key={conn.id}
              className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/shops/${conn.id}`}
                    className="text-sm font-bold text-foreground hover:text-primary"
                  >
                    {conn.displayLabel ?? conn.shopName ?? conn.platformName}
                  </Link>
                  <p className="text-xs text-muted">{conn.organizationName}</p>
                </div>
                <ShopConnectionStatusBadge
                  status={conn.isExpiringSoon ? 'expiring_soon' : conn.status}
                  expiresAt={conn.tokenExpiresAt ?? conn.refreshTokenExpiresAt}
                  size="xs"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-hairline">
                <Badge variant="outline" size="xs">
                  {conn.platformName}
                </Badge>
                <span className="font-mono">
                  {conn.lastVerifiedAt
                    ? new Date(conn.lastVerifiedAt).toLocaleDateString()
                    : t('never')}
                </span>
              </div>

              <div className="border-t border-hairline pt-2">
                <ShopConnectionRowActions
                  connection={conn}
                  onOpenLabel={() => {
                    setActiveConnection(conn);
                    setDialogMode('label');
                  }}
                  onOpenReassign={() => {
                    setActiveConnection(conn);
                    setDialogMode('reassign');
                  }}
                  onOpenDisconnect={() => {
                    setActiveConnection(conn);
                    setDialogMode('disconnect');
                  }}
                  onOpenReconnect={() => {
                    setActiveConnection(conn);
                    setDialogMode('reconnect');
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-hairline bg-surface-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              {hasActiveFilters ? t('noFilterResults') : t('emptyTitle')}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Pagination
          page={filters.page ?? 1}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={filters.pageSize ?? 25}
          onPageChange={(page: number) =>
            updateFilters({ ...filters, page })
          }
          onPageSizeChange={(pageSize: number) =>
            updateFilters({ ...filters, pageSize, page: 1 })
          }
        />
      )}

      {/* Connect Dialog */}
      <ShopConnectionAuthorizationDialog
        isOpen={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        onClose={() => setIsConnectOpen(false)}
      />

      {/* Reconnect Dialog */}
      {activeConnection && (
        <ShopConnectionAuthorizationDialog
          isOpen={dialogMode === 'reconnect'}
          onOpenChange={(open) => !open && setDialogMode(null)}
          onClose={() => setDialogMode(null)}
          defaultPlatform={activeConnection.platformCode as SupportedShopPlatformCode}
          fixedOrganizationId={activeConnection.organizationId}
          fixedOrganizationName={activeConnection.organizationName}
          reconnectConnectionId={activeConnection.id}
        />
      )}

      {/* Label Edit Dialog */}
      {activeConnection && (
        <ShopConnectionLabelDialog
          isOpen={dialogMode === 'label'}
          onOpenChange={(open) => !open && setDialogMode(null)}
          onClose={() => setDialogMode(null)}
          connection={activeConnection}
        />
      )}

      {/* Disconnect Dialog */}
      {activeConnection && (
        <ShopConnectionDisconnectDialog
          isOpen={dialogMode === 'disconnect'}
          onOpenChange={(open) => !open && setDialogMode(null)}
          onClose={() => setDialogMode(null)}
          connection={activeConnection}
        />
      )}

      {/* Reassign Dialog */}
      {activeConnection && (
        <ShopConnectionReassignDialog
          isOpen={dialogMode === 'reassign'}
          onOpenChange={(open) => !open && setDialogMode(null)}
          onClose={() => setDialogMode(null)}
          connection={activeConnection}
        />
      )}
    </section>
  );
}
