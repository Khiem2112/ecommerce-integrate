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

const PRIORITY_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  urgent: { label: 'Urgent', variant: 'rose' },
  high: { label: 'High', variant: 'amber' },
  normal: { label: 'Normal', variant: 'info' },
  low: { label: 'Low', variant: 'slate' },
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

export function ConversationRow({ conversation, isActive, onSelect }: ConversationRowProps) {
  const preview = conversation.latestMessage?.text ?? 'No messages yet';
  const initial = conversation.customerIdentifier.slice(-2).toUpperCase();

  const statusCode = conversation.status.code;
  const statusInfo = STATUS_CONFIG[statusCode] ?? {
    label: conversation.status.name,
    variant: 'slate' as BadgeVariant,
  };

  const priorityCode = conversation.priority;
  const priorityInfo = PRIORITY_CONFIG[priorityCode] ?? {
    label: priorityCode,
    variant: 'slate' as BadgeVariant,
  };

  const vipTierCode = conversation.vipTierCode?.toLowerCase() ?? 'standard';
  const vipTierVariant = VIP_TIER_CONFIG[vipTierCode]?.variant ?? 'slate';

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'group relative mb-1.5 w-full rounded-xl p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 border',
        isActive
          ? 'border-violet-500/50 bg-violet-500/15 shadow-md shadow-violet-950/40'
          : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/60',
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold transition shadow-sm',
            isActive
              ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-900/50'
              : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700 group-hover:text-white',
          )}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-slate-100">
              {conversation.customerIdentifier}
            </span>
            <time
              className="shrink-0 text-[10px] font-medium text-slate-500"
              dateTime={conversation.updatedAt}
            >
              {formatRelativeTime(conversation.updatedAt)}
            </time>
          </div>

          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            {preview}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* Status Badge */}
            <Badge
              variant={statusInfo.variant}
              size="xs"
              useDot
              label={statusInfo.label}
            />

            {/* Priority Badge */}
            <Badge
              variant={priorityInfo.variant}
              size="xs"
              useDot
              label={priorityInfo.label}
            />

            {/* Intent Badge */}
            {conversation.intent && (
              <Badge
                variant="secondary"
                size="xs"
                label={INTENT_LABELS[conversation.intent.code] ?? conversation.intent.name}
              />
            )}

            {/* VIP Tier Badge */}
            <span className="ml-auto">
              <Badge
                variant={vipTierVariant}
                size="xs"
                label={conversation.vipTierName}
              />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
