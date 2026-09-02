'use client';

import { Badge, type BadgeVariant } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { ConversationSummary } from '@/types';

type ConversationRowProps = {
  readonly conversation: ConversationSummary;
  readonly isActive: boolean;
  readonly onSelect: (conversationId: number) => void;
};

const INTENT_LABELS: Record<string, string> = {
  delivery_status: 'Delivery',
  refund_request: 'Refund',
  product_info: 'Product',
  cancellation: 'Cancel',
  complaint: 'Complaint',
  voucher: 'Voucher',
  repurchase: 'Repurchase',
  general: 'General',
};

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  open: { label: 'Open', variant: 'emerald' },
  awaiting_reply: { label: 'Awaiting Reply', variant: 'amber' },
  in_progress: { label: 'In Progress', variant: 'purple' },
  escalated: { label: 'Escalated', variant: 'rose' },
  resolved: { label: 'Resolved', variant: 'teal' },
  closed: { label: 'Closed', variant: 'slate' },
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

function formatRelativeTime(timestamp: string): string {
  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function buildTooltipText(conversation: ConversationSummary): string {
  const lines = [
    `Priority: ${conversation.priority}`,
    `Status: ${conversation.status.name}`,
  ];
  if (conversation.intent) {
    lines.push(`Intent: ${conversation.intent.name}`);
  }
  lines.push(`VIP: ${conversation.vipTierName}`);
  lines.push(`Updated: ${formatRelativeTime(conversation.updatedAt)} ago`);
  return lines.join('\n');
}

export function ConversationRow({ conversation, isActive, onSelect }: ConversationRowProps) {
  const preview = conversation.latestMessage?.text ?? 'No messages yet';
  const initial = conversation.customerIdentifier.slice(-2).toUpperCase();

  const statusCode = conversation.status.code;
  const statusInfo = STATUS_CONFIG[statusCode] ?? {
    label: conversation.status.name,
    variant: 'slate' as BadgeVariant,
  };

  const priorityCode = conversation.priority;
  const priorityDotColor = PRIORITY_DOT_COLORS[priorityCode] ?? 'bg-muted-soft';

  const vipTierCode = conversation.vipTierCode?.toLowerCase() ?? 'standard';
  const vipTierVariant = VIP_TIER_CONFIG[vipTierCode]?.variant ?? 'slate';
  const showVipBadge = vipTierCode !== 'standard';

  /* Intent prefix for preview line */
  const intentLabel = conversation.intent
    ? INTENT_LABELS[conversation.intent.code] ?? conversation.intent.name
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      title={buildTooltipText(conversation)}
      className={cn(
        'group relative mb-1.5 w-full rounded-2xl p-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 border cursor-pointer',
        isActive
          ? 'border-foreground bg-surface-card shadow-sm ring-1 ring-foreground/10'
          : 'border-hairline bg-surface-card hover:border-foreground/25 hover:bg-surface-lifted shadow-xs',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar with priority indicator dot */}
        <div className="relative shrink-0">
          <div
            className={cn(
              'grid size-8 place-items-center rounded-full text-sm font-bold transition duration-150 shadow-xs',
              isActive
                ? 'bg-foreground text-background'
                : 'bg-background text-foreground border border-hairline group-hover:bg-hairline',
            )}
          >
            {initial}
          </div>
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
            <span className="truncate text-xs font-semibold text-foreground">
              {conversation.customerIdentifier}
            </span>
            <time
              className="shrink-0 text-[10px] font-medium text-muted"
              dateTime={conversation.updatedAt}
            >
              {formatRelativeTime(conversation.updatedAt)}
            </time>
          </div>

          {/* Preview line with intent prefix */}
          <p className="mt-1 line-clamp-1 text-xs text-muted">
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
              label={statusInfo.label}
            />

            {conversation.latestDraft?.status === 'pending' && !conversation.latestDraft?.isOutdated && (
              <Badge
                variant="warning"
                size="xs"
                className="px-1.5 py-0 text-[9px] font-bold"
                label="✦ AI Draft"
              />
            )}

            {conversation.latestDraft?.status === 'pending' && conversation.latestDraft?.isOutdated && (
              <Badge
                variant="rose"
                size="xs"
                className="px-1.5 py-0 text-[9px] font-bold"
                label="⚠️ Outdated"
              />
            )}

            {conversation.latestDraft?.status === 'applied' && (
              <Badge
                variant="success"
                size="xs"
                className="px-1.5 py-0 text-[9px] font-bold"
                label="✓ AI Saved"
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
