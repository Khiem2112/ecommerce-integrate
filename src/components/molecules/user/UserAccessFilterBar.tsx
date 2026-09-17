'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Combobox, Input, type ComboboxItem } from '@/components/atoms';
import { useDebounce } from '@/hooks';
import type {
  OrganizationRoleCode,
  UserAccessFilterValues,
  UserAccessStatusCode,
} from '@/types';

export type UserAccessFilterBarProps = {
  readonly filters: UserAccessFilterValues;
  readonly onFiltersChange: (newFilters: UserAccessFilterValues) => void;
  readonly canManageStatus?: boolean;
};

const ROLE_OPTIONS: readonly OrganizationRoleCode[] = [
  'owner',
  'admin',
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
];

export function UserAccessFilterBar({
  filters,
  onFiltersChange,
  canManageStatus = true,
}: UserAccessFilterBarProps) {
  const t = useTranslations('users');
  const tRoles = useTranslations('users.roles');
  const tStatuses = useTranslations('users.statuses');

  const [searchTerm, setSearchTerm] = useState(filters.q ?? '');
  const debouncedSearch = useDebounce(searchTerm, 250);

  // Sync debounced search to parent filter state
  useEffect(() => {
    if (debouncedSearch !== (filters.q ?? '')) {
      onFiltersChange({
        ...filters,
        q: debouncedSearch ? debouncedSearch : undefined,
        page: 1,
      });
    }
  }, [debouncedSearch, filters, onFiltersChange]);

  // Sync external filter changes back to search input
  useEffect(() => {
    setSearchTerm(filters.q ?? '');
  }, [filters.q]);

  const roleItems: readonly ComboboxItem[] = useMemo(
    () => [
      { value: 'ALL', label: t('filters.allRoles') },
      ...ROLE_OPTIONS.map((role) => ({
        value: role,
        label: tRoles(role),
      })),
    ],
    [t, tRoles],
  );

  const statusItems: readonly ComboboxItem[] = useMemo(
    () => [
      { value: 'active', label: tStatuses('active') },
      { value: 'removed', label: tStatuses('removed') },
    ],
    [tStatuses],
  );

  const handleRoleChange = (value: string) => {
    onFiltersChange({
      ...filters,
      role: value === 'ALL' ? undefined : (value as OrganizationRoleCode),
      page: 1,
    });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value as UserAccessStatusCode,
      page: 1,
    });
  };

  const hasActiveFilters = Boolean(
    filters.q || filters.role || (filters.status && filters.status !== 'active'),
  );

  const handleReset = () => {
    setSearchTerm('');
    onFiltersChange({
      q: undefined,
      role: undefined,
      status: 'active',
      page: 1,
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative w-full sm:max-w-xs">
          <Input
            id="user-search-input"
            type="search"
            placeholder={t('filters.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm"
          />
        </div>

        {/* Role filter */}
        <div className="w-full sm:w-48">
          <Combobox
            items={roleItems}
            value={filters.role ?? 'ALL'}
            onChange={handleRoleChange}
            placeholder={t('filters.allRoles')}
            searchable={false}
            size="md"
            ariaLabel={t('filters.role')}
          />
        </div>

        {/* Status filter (only managers can toggle removed members) */}
        {canManageStatus && (
          <div className="w-full sm:w-44">
            <Combobox
              items={statusItems}
              value={filters.status ?? 'active'}
              onChange={handleStatusChange}
              placeholder={t('filters.allStatuses')}
              searchable={false}
              size="md"
              ariaLabel={t('filters.status')}
            />
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted hover:text-foreground"
          >
            {t('filters.reset')}
          </Button>
        </div>
      )}
    </div>
  );
}
