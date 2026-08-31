'use client';

import { useEffect, useRef } from 'react';
import { Badge, type BadgeVariant, IconButton } from '@/components/atoms';
import { EmptyChat, MessageBubble, MessageInput } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import type { ConversationDetail, MultiDraftRagDraft } from '@/types';

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

type ChatPanelProps = {
  readonly conversation: ConversationDetail | null;
  readonly isLoading: boolean;
  readonly onBack: () => void;
  readonly isContextOpen?: boolean;
  readonly onToggleContext?: () => void;
  readonly draft: MultiDraftRagDraft | null;
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
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length]);

  if (isLoading) return <ChatLoading />;
  if (!conversation) return <EmptyChat />;

  const statusCode = conversation.status.code;
  const statusInfo = STATUS_CONFIG[statusCode] ?? {
    label: conversation.status.name,
    variant: 'slate' as BadgeVariant,
  };

  const priorityInfo = PRIORITY_CONFIG[conversation.priority] ?? {
    label: conversation.priority,
    variant: 'slate' as BadgeVariant,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-hairline bg-white px-4 shadow-xs md:px-6">
        <IconButton
          size="sm"
          variant="ghost"
          ariaLabel="Back to conversations"
          tooltip="Back to conversations"
          onClick={onBack}
          className="xl:hidden"
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
        <div className="grid size-8.5 place-items-center rounded-full bg-foreground text-xs font-bold text-background shadow-xs">
          {conversation.customerIdentifier.slice(-2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {conversation.customerIdentifier}
            </h2>
          </div>
          {/* Full conversation metadata in header */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge
              variant={statusInfo.variant}
              size="xs"
              useDot
              label={statusInfo.label}
            />
            <Badge
              variant={priorityInfo.variant}
              size="xs"
              label={priorityInfo.label}
            />
            {conversation.intent && (
              <Badge
                variant="secondary"
                size="xs"
                label={conversation.intent.name}
              />
            )}
          </div>
        </div>

        {conversation.humanApprovalRequired && (
          <Badge
            variant="warning"
            size="xs"
            label="Review required"
            className="hidden sm:inline-flex"
          />
        )}

        {onToggleContext && (
          <IconButton
            size="sm"
            variant="subtle"
            isActive={isContextOpen}
            ariaLabel={isContextOpen ? 'Close sidebar' : 'Open sidebar'}
            tooltip={isContextOpen ? 'Close sidebar' : 'Open sidebar'}
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
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {conversation.messages.length === 0 ? (
          <div className="grid h-full min-h-48 place-items-center text-center">
            <div>
              <p className="text-sm font-semibold text-foreground">Start the conversation</p>
              <p className="mt-1 text-xs text-muted">
                Write a reply or request a grounded AI draft.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* Compact draft-ready banner — links to sidebar tab */}
        {draft && (
          <div className="mx-auto mt-4 max-w-3xl">
            <button
              type="button"
              onClick={onViewDraft}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-status-warning/25 bg-status-warning/8 px-4 py-2.5 text-left text-xs transition duration-150 hover:bg-status-warning/15"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                ✦
              </span>
              <span className="flex-1 font-medium text-foreground">
                AI draft ready — View in sidebar
              </span>
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

        {/* Generate error with retry */}
        {generateError && !draft && (
          <div className="mx-auto mt-4 max-w-3xl">
            <ErrorBanner
              message={`Unable to generate an AI response. ${generateError.message}`}
              onRetry={onGenerate}
            />
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="shrink-0 border-t border-hairline bg-surface-lifted p-3 md:px-6">
        <div className="mx-auto max-w-3xl">
          <MessageInput
            conversationId={conversation.id}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
            onSent={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}

function ChatLoading() {
  return (
    <div className="flex h-full min-h-96 flex-col animate-pulse bg-background">
      <div className="h-14 border-b border-hairline bg-white" />
      <div className="flex-1 space-y-4 p-6">
        <div className="h-14 max-w-sm rounded-2xl border border-hairline bg-white" />
        <div className="ml-auto h-16 max-w-md rounded-2xl bg-foreground/10" />
        <div className="h-12 max-w-xs rounded-2xl border border-hairline bg-white" />
      </div>
    </div>
  );
}
