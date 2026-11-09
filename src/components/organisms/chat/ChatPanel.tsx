'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, type BadgeVariant, Button, IconButton } from '@/components/atoms';
import { EmptyChat, MessageBubble, MessageInput } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import { EscalationAlertBanner } from './EscalationAlertBanner';
import {
  takeoverSessionAction,
  handbackToBotAction,
  resolveSessionAction,
} from '@/actions/agentSessionActions';
import type {
  ConversationDetail,
  MultiDraftRagDraft,
  AiDraftDetailDto,
} from '@/types';

const LAZADA_SESSION_EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000;

const STATUS_CONFIG: Record<string, { labelKey: string; variant: BadgeVariant }> = {
  open: { labelKey: 'filters.open', variant: 'emerald' },
  awaiting_reply: { labelKey: 'filters.awaitingReply', variant: 'amber' },
  in_progress: { labelKey: 'filters.inProgress', variant: 'purple' },
  escalated: { labelKey: 'filters.escalated', variant: 'rose' },
  resolved: { labelKey: 'filters.resolved', variant: 'teal' },
  closed: { labelKey: 'filters.closed', variant: 'slate' },
};

const PRIORITY_CONFIG: Record<string, { labelKey: string; variant: BadgeVariant }> = {
  urgent: { labelKey: 'filters.urgent', variant: 'rose' },
  high: { labelKey: 'filters.high', variant: 'amber' },
  normal: { labelKey: 'filters.normal', variant: 'info' },
  low: { labelKey: 'filters.low', variant: 'slate' },
};

export type ChatPanelProps = {
  readonly conversation: ConversationDetail | null;
  readonly isLoading: boolean;
  readonly onBack: () => void;
  readonly isContextOpen?: boolean;
  readonly onToggleContext?: () => void;
  readonly draft: MultiDraftRagDraft | AiDraftDetailDto | null;
  readonly isGenerating: boolean;
  readonly generateError: Error | null;
  readonly onGenerate: () => void;
  readonly onRefresh: () => void;
  readonly onViewDraft?: () => void;
};

export function ChatPanel({
  conversation,
  isLoading,
  onBack,
  isContextOpen = true,
  onToggleContext,
  draft,
  isGenerating,
  generateError,
  onGenerate,
  onRefresh,
  onViewDraft,
}: ChatPanelProps) {
  const t = useTranslations('workspace');
  const tSession = useTranslations('workspace.agentSession');
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [isPendingAction, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length]);

  if (isLoading) return <ChatLoading />;
  if (!conversation) return <EmptyChat />;

  const statusCode = conversation.status.code;
  const statusInfo = STATUS_CONFIG[statusCode] ?? {
    labelKey: 'filters.open',
    variant: 'slate' as BadgeVariant,
  };

  const priorityInfo = PRIORITY_CONFIG[conversation.priority] ?? {
    labelKey: 'filters.normal',
    variant: 'slate' as BadgeVariant,
  };

  const lastTime = conversation.updatedAt
    ? new Date(conversation.updatedAt).getTime()
    : Date.now();
  const elapsedMs = Date.now() - lastTime;
  const isExpired = elapsedMs > LAZADA_SESSION_EXPIRATION_MS;
  const remainingHours = Math.max(
    0,
    Math.floor((LAZADA_SESSION_EXPIRATION_MS - elapsedMs) / (1000 * 60 * 60)),
  );

  const handleTakeover = (): void => {
    setActionError(null);
    startTransition(async () => {
      const res = await takeoverSessionAction({
        conversationId: conversation.id,
      });
      if (!res.success) {
        setActionError(res.error || tSession('actions.takeoverFailed'));
      } else {
        onRefresh();
      }
    });
  };

  const handleHandback = (): void => {
    setActionError(null);
    startTransition(async () => {
      const res = await handbackToBotAction({
        conversationId: conversation.id,
      });
      if (!res.success) {
        setActionError(res.error || tSession('actions.handbackFailed'));
      } else {
        onRefresh();
      }
    });
  };

  const handleResolve = (): void => {
    setActionError(null);
    startTransition(async () => {
      const res = await resolveSessionAction({
        conversationId: conversation.id,
      });
      if (!res.success) {
        setActionError(res.error || tSession('actions.resolveFailed'));
      } else {
        onRefresh();
      }
    });
  };

  const factsUsed: readonly string[] =
    draft && 'groundedFactsUsed' in draft && Array.isArray(draft.groundedFactsUsed)
      ? draft.groundedFactsUsed
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-hairline-strong bg-surface-lifted px-4 md:px-6">
        <IconButton
          size="sm"
          variant="ghost"
          ariaLabel={tSession('header.backAria')}
          tooltip={tSession('header.backAria')}
          onClick={onBack}
          className="size-11 xl:hidden"
          icon={
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          }
        />
        <div className="grid size-8.5 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
          {conversation.customerIdentifier.slice(-2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {conversation.customerIdentifier}
            </h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge
              variant={statusInfo.variant}
              size="xs"
              useDot
              label={t(statusInfo.labelKey)}
            />
            <Badge
              variant={priorityInfo.variant}
              size="xs"
              label={t(priorityInfo.labelKey)}
            />
            {conversation.intent && (
              <Badge
                variant="secondary"
                size="xs"
                label={conversation.intent.name}
              />
            )}
            {!isExpired && (
              <span className="text-[11px] text-muted">
                {tSession('sessionExpiration.activeWindow', { hours: remainingHours })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusCode === 'in_progress' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleHandback}
                disabled={isPendingAction}
                className="text-xs"
              >
                {isPendingAction ? tSession('actions.handingBack') : tSession('actions.handback')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleResolve}
                disabled={isPendingAction}
                className="text-xs"
              >
                {isPendingAction ? tSession('actions.resolving') : tSession('actions.resolve')}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTakeover}
              disabled={isPendingAction}
              className="text-xs"
            >
              {isPendingAction ? tSession('actions.takingOver') : tSession('actions.takeover')}
            </Button>
          )}

          {conversation.humanApprovalRequired && (
            <Badge
              variant="warning"
              size="xs"
              label={tSession('header.reviewRequired')}
              className="hidden sm:inline-flex"
            />
          )}

          {onToggleContext && (
            <IconButton
              size="sm"
              variant="subtle"
              isActive={isContextOpen}
              ariaLabel={isContextOpen ? tSession('header.closeSidebar') : tSession('header.openSidebar')}
              tooltip={isContextOpen ? tSession('header.closeSidebar') : tSession('header.openSidebar')}
              onClick={onToggleContext}
              icon={
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M15 3v18" />
                  <path d={isContextOpen ? 'm11 9-3 3 3 3' : 'm8 9 3 3-3 3'} />
                </svg>
              }
            />
          )}
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <EscalationAlertBanner
          conversation={conversation}
          isTakingOver={isPendingAction}
          onTakeover={handleTakeover}
          onViewDraft={onViewDraft}
          hasDraft={Boolean(draft)}
        />

        {actionError && (
          <div className="mx-auto mb-4 max-w-3xl">
            <ErrorBanner
              message={actionError}
              onRetry={() => setActionError(null)}
            />
          </div>
        )}

        {conversation.messages.length === 0 ? (
          <div className="grid h-full min-h-48 place-items-center text-center">
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">
                {tSession('header.startConversation')}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {tSession('header.startDescription')}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {draft && (
          <div className="mx-auto mt-4 max-w-3xl">
            <button
              type="button"
              onClick={onViewDraft}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-status-warning/25 bg-status-warning/8 px-4 py-3 text-left text-sm transition duration-150 hover:bg-status-warning/15"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                AI
              </span>
              <div className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">
                  {tSession('header.aiDraftReady')}
                </span>
                {factsUsed.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {factsUsed.map((factCode) => (
                      <span
                        key={factCode}
                        className="rounded bg-surface-card px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted"
                      >
                        {factCode}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4 text-muted"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {generateError && !draft && (
          <div className="mx-auto mt-4 max-w-3xl">
            <ErrorBanner
              message={tSession('header.generateError', { error: generateError.message })}
              onRetry={onGenerate}
            />
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="shrink-0 border-t border-hairline bg-surface-lifted p-3 md:px-6">
        <div className="mx-auto max-w-3xl">
          {isExpired ? (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-center text-xs font-medium text-status-danger-foreground">
              {tSession('sessionExpiration.expired')}
            </div>
          ) : (
            <MessageInput
              conversationId={conversation.id}
              isGenerating={isGenerating}
              onGenerate={onGenerate}
              onSent={onRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChatLoading() {
  return (
    <div className="flex h-full min-h-96 flex-col animate-pulse bg-background">
      <div className="h-14 border-b border-hairline bg-surface-card" />
      <div className="flex-1 space-y-4 p-6">
        <div className="h-14 max-w-sm rounded-2xl border border-hairline bg-surface-card" />
        <div className="ml-auto h-16 max-w-md rounded-2xl bg-foreground/10" />
        <div className="h-12 max-w-xs rounded-2xl border border-hairline bg-surface-card" />
      </div>
    </div>
  );
}
