'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
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
import {
  OrganizationOptionCard,
  UserIdentityBadge,
} from '@/components/molecules';
import {
  useActiveOrganizationContext,
  useOrganizations,
  useSwitchActiveOrganization,
} from '@/hooks';
import { useAuthentication } from '@/hooks/useAuthentication';
import { cn } from '@/lib/cn';
import { PasswordChangeModal } from '../Authentication/PasswordChangeModal';

export type OrganizationSwitcherProps = {
  readonly className?: string;
  readonly compact?: boolean;
};

export function OrganizationSwitcher({
  className,
  compact = false,
}: OrganizationSwitcherProps): JSX.Element {
  const t = useTranslations('organizations');
  const tSession = useTranslations('authentication.session');
  const tSettings = useTranslations('settings');
  const { user, logout, isLoggingOut } = useAuthentication();
  const [isOpen, setIsOpen] = useState(false);
  const [isShopsHovered, setIsShopsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
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
  const userDisplayName = user?.displayName ?? user?.email ?? activeDisplayName;
  const userInitial = userDisplayName.charAt(0).toUpperCase();

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
        aria-label={tSession('userMenu')}
        className={cn(
          'flex min-w-0 items-center justify-between gap-2 rounded-xl border border-hairline bg-surface-card px-2 text-xs transition-colors hover:bg-surface-lifted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          compact ? 'size-8 justify-center rounded-full p-0' : 'h-10 w-full',
          isOpen && 'border-hairline-strong bg-surface-lifted/80',
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {compact ? (
          <span className="text-xs font-semibold text-foreground">{userInitial}</span>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-lifted text-xs font-semibold text-foreground">
                {activeDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <Tooltip content={activeDisplayName} side="bottom">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {activeDisplayName}
                  </span>
                </Tooltip>
                <Tooltip content={userDisplayName} side="bottom">
                  <span className="block truncate text-[11px] text-muted">
                    {userDisplayName}
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
          </>
        )}
      </button>

      {/* Dropdown Menu Options */}
      {isOpen && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-1.5 w-64 rounded-xl border border-hairline bg-surface-card p-1.5 shadow-elevated animate-in fade-in zoom-in-95 duration-100',
            compact ? 'right-0' : 'left-0',
          )}
        >
          {user && (
            <div className="border-b border-hairline px-2.5 py-2">
              <UserIdentityBadge user={user} size="sm" showRole />
            </div>
          )}

          <div className="space-y-0.5 py-1">
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

          <div className="border-t border-hairline py-1">
            <Link
              href="/settings"
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
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>{tSettings('title')}</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsShopsHovered(false);
                setIsPasswordModalOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-lifted"
            >
              <svg aria-hidden="true" className="size-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{tSession('changePassword')}</span>
            </button>
          </div>

          <div className="border-t border-hairline pt-1">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void logout()}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-semantic-error transition-colors hover:bg-semantic-error/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>{isLoggingOut ? tSession('signingOut') : tSession('signOut')}</span>
            </button>
          </div>
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
                  <OrganizationOptionCard
                    key={org.id}
                    organization={org}
                    isSelected={isActive}
                    disabled={switchMutation.isPending}
                    onSelect={(id) => {
                      if (!isActive) {
                        switchMutation.mutate(id, {
                          onSuccess: () => setIsModalOpen(false),
                        });
                      } else {
                        setIsModalOpen(false);
                      }
                    }}
                  />
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

      <PasswordChangeModal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      />
    </div>
  );
}
