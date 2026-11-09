'use client';

import { useTranslations } from 'next-intl';
import { Badge, Button } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { ConversationDetail } from '@/types';

export type EscalationAlertBannerProps = {
  readonly conversation: ConversationDetail;
  readonly isTakingOver?: boolean;
  readonly onTakeover: () => void;
  readonly onViewDraft?: () => void;
  readonly hasDraft?: boolean;
};

export function EscalationAlertBanner({
  conversation,
  isTakingOver = false,
  onTakeover,
  onViewDraft,
  hasDraft = false,
}: EscalationAlertBannerProps) {
  const t = useTranslations('workspace.agentSession');
  const isUrgent = conversation.priority === 'urgent';
  const isEscalated =
    conversation.status.code === 'escalated' || conversation.humanApprovalRequired;

  if (!isEscalated && !isUrgent) {
    return null;
  }

  return (
    <aside
      aria-label={t('banner.escalatedTitle')}
      className={cn(
        'relative mx-auto mb-4 flex w-full max-w-3xl flex-col gap-3 rounded-xl border p-4 shadow-sm transition-all duration-200',
        isUrgent
          ? 'border-status-danger/30 bg-status-danger/10 text-status-danger-foreground'
          : 'border-status-warning/30 bg-status-warning/10 text-status-warning-foreground',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={isUrgent ? 'rose' : 'warning'}
            size="xs"
            label={isUrgent ? t('banner.badgeUrgent') : t('banner.badgeAttention')}
          />
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            {t('banner.escalatedTitle')}
          </h3>
        </div>
        <div className="text-xs text-muted">
          {conversation.customerIdentifier} ({conversation.vipTierName})
        </div>
      </div>

      <p className="text-xs leading-5 text-foreground/90">
        {isUrgent ? t('banner.vipAlert') : t('banner.groundingAlert')}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="primary"
          onClick={onTakeover}
          disabled={isTakingOver}
          className="text-xs font-semibold"
        >
          {isTakingOver ? t('actions.takingOver') : t('actions.takeover')}
        </Button>

        {hasDraft && onViewDraft && (
          <Button
            size="sm"
            variant="outline"
            onClick={onViewDraft}
            className="text-xs font-medium"
          >
            {t('actions.sendDraft')}
          </Button>
        )}
      </div>
    </aside>
  );
}
