'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { Badge, type BadgeVariant } from '@/components/atoms';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { getSafeDisplayUrl } from '@/utils';
import type { ConversationSummary } from '@/types';

type ConversationRowProps = {
  readonly conversation: ConversationSummary;
  readonly isActive: boolean;
  readonly onSelect: (conversationId: number) => void;
};

const PREVIEW_TYPE_KEYS: Record<string, string> = {
  IMAGE: 'row.imagePreview',
  VIDEO: 'row.videoPreview',
  EMOJI: 'row.emojiPreview',
  ITEM: 'row.itemPreview',
  ORDER: 'row.orderPreview',
  VOUCHER: 'row.voucherPreview',
};

const INTENT_LABEL_KEYS: Record<string, string> = {
  delivery_status: 'row.delivery',
  refund_request: 'row.refund',
  product_info: 'row.product',
  cancellation: 'row.cancellation',
  complaint: 'row.complaint',
  voucher: 'row.voucher',
  repurchase: 'row.repurchase',
  general: 'row.general',
};

const STATUS_CONFIG: Record<string, { labelKey: string; variant: BadgeVariant }> = {
  open: { labelKey: 'filters.open', variant: 'emerald' },
  awaiting_reply: { labelKey: 'filters.awaitingReply', variant: 'amber' },
  in_progress: { labelKey: 'filters.inProgress', variant: 'purple' },
  escalated: { labelKey: 'filters.escalated', variant: 'rose' },
  resolved: { labelKey: 'filters.resolved', variant: 'teal' },
  closed: { labelKey: 'filters.closed', variant: 'slate' },
};

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: 'bg-semantic-error',
  high: 'bg-status-warning',
  normal: 'bg-status-info',
  low: 'bg-muted-soft',
};

const VIP_TIER_CONFIG: Record<string, { variant: BadgeVariant }> = {
  platinum: { variant: 'purple' },
  gold: { variant: 'amber' },
  silver: { variant: 'zinc' },
  standard: { variant: 'slate' },
};

export function ConversationRow({
  conversation,
  isActive,
  onSelect,
}: ConversationRowProps): ReactElement {
  const t = useTranslations('workspace');
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (timestamp: string): string => {
    const elapsedMs = nowMs - new Date(timestamp).getTime();
    const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
    if (minutes < 1) return t('row.now');
    if (minutes < 60) return t('row.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('row.hours', { count: hours });
    return t('row.days', { count: Math.floor(hours / 24) });
  };

  const displayName = conversation.customerDisplayName?.trim() || conversation.customerIdentifier;
  const initial = conversation.customerDisplayName?.trim()
    ? conversation.customerDisplayName.trim().slice(0, 2).toUpperCase()
    : conversation.customerIdentifier.slice(-2).toUpperCase();

  const latestMessage = conversation.latestMessage;
  const preview =
    latestMessage?.status === 'RECALLED'
      ? t('row.recalledPreview')
      : latestMessage?.text?.trim()
        ? latestMessage.text
        : latestMessage?.messageType && PREVIEW_TYPE_KEYS[latestMessage.messageType]
          ? t(PREVIEW_TYPE_KEYS[latestMessage.messageType])
          : t('row.noMessages');

  const unreadCount = conversation.unreadCount ?? 0;
  const safeAvatarUrl = getSafeDisplayUrl(conversation.customerAvatarUrl);
  const showAvatarImage = safeAvatarUrl !== null && failedAvatarUrl !== safeAvatarUrl;

  const statusCode = conversation.status.code;
  const statusInfo = STATUS_CONFIG[statusCode] ?? {
    labelKey: undefined,
    variant: 'slate' as BadgeVariant,
  };

  const priorityCode = conversation.priority;
  const priorityDotColor = PRIORITY_DOT_COLORS[priorityCode] ?? 'bg-muted-soft';

  const vipTierCode = conversation.vipTierCode?.toLowerCase() ?? 'standard';
  const vipTierVariant = VIP_TIER_CONFIG[vipTierCode]?.variant ?? 'slate';
  const showVipBadge = vipTierCode !== 'standard';

  /* Intent prefix for preview line */
  const intentLabel = conversation.intent
    ? INTENT_LABEL_KEYS[conversation.intent.code]
      ? t(INTENT_LABEL_KEYS[conversation.intent.code])
      : conversation.intent.name
    : null;
  const relativeTime = formatRelativeTime(conversation.updatedAt);
  const tooltip = conversation.intent
    ? t('row.tooltip', {
        priority: conversation.priority,
        status: conversation.status.name,
        intent: conversation.intent.name,
        tier: conversation.vipTierName,
        time: relativeTime,
      })
    : t('row.tooltipWithoutIntent', {
        priority: conversation.priority,
        status: conversation.status.name,
        tier: conversation.vipTierName,
        time: relativeTime,
      });

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      title={tooltip}
      className={cn(
        'group relative w-full min-w-0 cursor-pointer overflow-hidden border-b border-hairline p-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20',
        isActive
          ? 'bg-surface-card/80 before:absolute before:inset-y-3 before:left-0 before:w-px before:rounded-full before:bg-status-warning'
          : 'bg-transparent hover:bg-surface-card/55',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar with priority indicator dot */}
        <div className="relative shrink-0">
          {showAvatarImage && safeAvatarUrl ? (
            // Marketplace CDN avatar domains vary dynamically per shop and buyer
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeAvatarUrl}
              alt={displayName}
              onError={() => setFailedAvatarUrl(safeAvatarUrl)}
              className="size-8 rounded-full border border-hairline object-cover"
            />
          ) : (
            <div
              className={cn(
                'grid size-8 place-items-center rounded-full text-sm font-bold transition duration-150',
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground border border-hairline group-hover:bg-hairline',
              )}
            >
              {initial}
            </div>
          )}
          {/* Priority dot */}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-card',
              priorityDotColor,
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {displayName}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {unreadCount > 0 && (
                <span
                  aria-label={t('row.unreadAria', { count: unreadCount })}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-semantic-error px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-on-primary"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <time
                className="text-xs font-medium tabular-nums text-muted"
                dateTime={conversation.updatedAt}
              >
                {relativeTime}
              </time>
            </div>
          </div>

          {/* Preview line with intent prefix */}
          <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted">
            {intentLabel && (
              <span className="font-medium text-foreground/70">{intentLabel} · </span>
            )}
            {preview}
          </p>

          {/* Badges: Status + AI Draft + VIP */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge
              variant={statusInfo.variant}
              size="xs"
              useDot
              label={statusInfo.labelKey ? t(statusInfo.labelKey) : conversation.status.name}
            />

            {conversation.latestDraft?.status === 'pending' && !conversation.latestDraft?.isOutdated && (
              <Badge
                variant="warning"
                size="xs"
                className="px-1.5 py-0 text-[11px] font-semibold"
                label={t('row.aiDraft')}
              />
            )}

            {conversation.latestDraft?.status === 'pending' && conversation.latestDraft?.isOutdated && (
              <Badge
                variant="rose"
                size="xs"
                className="px-1.5 py-0 text-[11px] font-semibold"
                label={t('row.outdated')}
              />
            )}

            {conversation.latestDraft?.status === 'applied' && (
              <Badge
                variant="success"
                size="xs"
                className="px-1.5 py-0 text-[11px] font-semibold"
                label={t('row.aiSaved')}
              />
            )}

            {showVipBadge && (
              <span className="ml-auto">
                <Badge
                  variant={vipTierVariant}
                  size="xs"
                  label={conversation.vipTierName}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
