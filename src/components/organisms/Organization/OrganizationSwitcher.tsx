'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Tooltip,
} from '@/components/atoms';
import { OrganizationRoleBadge } from '@/components/molecules';
import {
  useActiveOrganizationContext,
  useOrganizations,
  useSwitchActiveOrganization,
} from '@/hooks';
import { cn } from '@/lib/cn';

export type OrganizationSwitcherProps = {
  readonly className?: string;
};

export function OrganizationSwitcher({ className }: OrganizationSwitcherProps) {
  const t = useTranslations('organizations');
  const [isOpen, setIsOpen] = useState(false);
  const [isShopsHovered, setIsShopsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  const { data: active, isLoading: isActiveLoading } = useActiveOrganizationContext();
  const { data: organizations, isLoading: isOrgsLoading } = useOrganizations({
    page: 1,
    pageSize: 100,
  });
  const switchMutation = useSwitchActiveOrganization();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsShopsHovered(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsShopsHovered(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const orgItems = organizations?.items ?? [];
  const activeOrg = orgItems.find((org) => org.id === active?.organizationId);
  const activeDisplayName = activeOrg?.displayName ?? active?.displayName ?? t('title');
  const connectedShops = activeOrg?.connections ?? [];

  const filteredOrgs = searchQuery.trim()
    ? orgItems.filter(
        (org) =>
          org.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          org.slug.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : orgItems;

  if (isActiveLoading || isOrgsLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-8 w-36 animate-pulse rounded-xl bg-surface-card" />
      </div>
    );
  }

  return (
    <div ref={menuRef} className={cn('relative min-w-0 flex-1', className)}>
      {/* Switcher Button Trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIsShopsHovered(false);
        }}
        className={cn(
          'flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-hairline bg-surface-card px-2 text-xs transition-colors hover:bg-surface-lifted/70 focus:outline-none focus:ring-1 focus:ring-primary',
          isOpen && 'border-hairline-strong bg-surface-lifted/80',
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-lifted text-[11px] font-semibold text-foreground">
            {activeDisplayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <Tooltip content={activeDisplayName} side="bottom">
              <span className="block truncate text-left text-xs font-medium text-foreground">
                {activeDisplayName}
              </span>
            </Tooltip>
          </div>
        </div>

        <svg
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-muted transition-transform duration-200',
            isOpen && 'rotate-180 text-foreground',
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown Menu Options */}
      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-hairline bg-surface-card p-1 shadow-elevated"
        >
          {/* Option 1: Connected shops (Hover flyout) */}
          <div
            className="relative"
            onMouseEnter={() => setIsShopsHovered(true)}
            onMouseLeave={() => setIsShopsHovered(false)}
          >
            <button
              type="button"
              onClick={() => setIsShopsHovered((prev) => !prev)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-lifted',
                isShopsHovered && 'bg-surface-lifted',
              )}
            >
              <div className="flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  className="size-4 text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                  <path d="M2 7h20" />
                </svg>
                <span>{t('context.connectedShops')}</span>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] text-muted">
                  {connectedShops.length}
                </span>
                <svg
                  aria-hidden="true"
                  className="size-3 text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>

            {/* Flyout Submenu for Connected Shops */}
            {isShopsHovered && (
              <div className="absolute left-full top-0 ml-1.5 w-64 rounded-xl border border-hairline bg-surface-card p-2 shadow-elevated">
                <div className="mb-1.5 flex items-center justify-between border-b border-hairline px-2 pb-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    {t('shopsTab.title')}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {connectedShops.length}
                  </span>
                </div>

                {connectedShops.length > 0 ? (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {connectedShops.map((shop) => (
                      <div
                        key={shop.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-hairline/60 bg-surface-lifted/40 px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {shop.shopName ?? shop.platformName}
                          </p>
                          <p className="text-[10px] text-muted">
                            {shop.platformName}
                          </p>
                        </div>
                        {shop.lastSyncedAt && (
                          <span
                            className="size-2 shrink-0 rounded-full bg-status-success"
                            title={t('shopsTab.lastSync', {
                              time: new Date(shop.lastSyncedAt).toLocaleString(),
                            })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-muted">
                    {t('context.noShops')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Option 2: Configuration */}
          <Link
            href={
              active?.organizationId
                ? `/organizations/${active.organizationId}`
                : '/organizations'
            }
            onClick={() => {
              setIsOpen(false);
              setIsShopsHovered(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-lifted"
          >
            <svg
              aria-hidden="true"
              className="size-4 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{t('context.configure')}</span>
          </Link>

          {/* Option 3: Switch organization */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsShopsHovered(false);
              setIsModalOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-lifted"
          >
            <svg
              aria-hidden="true"
              className="size-4 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 3 4 4-4 4" />
              <path d="M20 7H4" />
              <path d="m8 21-4-4 4-4" />
              <path d="M4 17h16" />
            </svg>
            <span>{t('context.switchOrg')}</span>
          </button>
        </div>
      )}

      {/* Switch Organization Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-hairline p-5 pb-4">
            <DialogTitle>{t('context.switchModalTitle')}</DialogTitle>
            <DialogDescription className="mt-1">
              {t('context.switchModalDescription')}
            </DialogDescription>
            <div className="pt-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                size="sm"
              />
            </div>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto p-5">
            {filteredOrgs.length > 0 ? (
              filteredOrgs.map((org) => {
                const isActive = org.id === active?.organizationId;

                return (
                  <button
                    key={org.id}
                    type="button"
                    disabled={switchMutation.isPending}
                    onClick={() => {
                      if (!isActive) {
                        switchMutation.mutate(org.id, {
                          onSuccess: () => setIsModalOpen(false),
                        });
                      } else {
                        setIsModalOpen(false);
                      }
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all',
                      isActive
                        ? 'border-primary/70 bg-primary/5 shadow-xs ring-1 ring-primary/20'
                        : 'border-hairline bg-surface-card hover:border-hairline-strong hover:bg-surface-lifted/60',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-lifted text-sm font-semibold text-foreground">
                        {org.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {org.displayName}
                          </p>
                          {isActive && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {t('context.currentActive')}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted">
                          {org.slug}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <OrganizationRoleBadge role={org.role} />
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="py-8 text-center text-xs text-muted">
                {t('empty')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
