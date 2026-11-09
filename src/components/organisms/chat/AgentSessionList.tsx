'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Input } from '@/components/atoms';
import { ConversationRow } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import { useConversations } from '@/hooks/useConversations';
import { cn } from '@/lib/cn';
import type { ConversationSummary } from '@/types';

type SessionTabKey = 'escalated' | 'human' | 'bot';

export type AgentSessionListProps = {
  readonly selectedConversationId: number | null;
  readonly onSelectConversation: (conversationId: number) => void;
};

export function AgentSessionList({
  selectedConversationId,
  onSelectConversation,
}: AgentSessionListProps) {
  const t = useTranslations('workspace.agentSession');
  const tWorkspace = useTranslations('workspace');
  const [activeTab, setActiveTab] = useState<SessionTabKey>('escalated');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearch = useDeferredValue(searchQuery);

  const { data: conversations = [], isLoading, error, refetch } = useConversations({});

  const counts = useMemo(() => {
    let escalated = 0;
    let human = 0;
    let bot = 0;

    for (const c of conversations) {
      if (
        c.status.code === 'escalated' ||
        c.priority === 'urgent' ||
        c.humanApprovalRequired
      ) {
        escalated++;
      } else if (c.status.code === 'in_progress') {
        human++;
      } else {
        bot++;
      }
    }

    return { escalated, human, bot };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return conversations.filter((c: ConversationSummary) => {
      const matchesSearch =
        !query ||
        c.customerIdentifier.toLowerCase().includes(query) ||
        (c.intent?.name && c.intent.name.toLowerCase().includes(query)) ||
        (c.latestMessage?.text && c.latestMessage.text.toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (activeTab === 'escalated') {
        return (
          c.status.code === 'escalated' ||
          c.priority === 'urgent' ||
          c.humanApprovalRequired
        );
      }
      if (activeTab === 'human') {
        return c.status.code === 'in_progress';
      }
      return c.status.code === 'open' || c.status.code === 'awaiting_reply';
    });
  }, [conversations, activeTab, deferredSearch]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-hairline px-4 pt-4 pb-3">
        <div className="mb-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {tWorkspace('inbox.title')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {tWorkspace('inbox.subtitle')}
          </p>
        </div>

        <div className="relative mb-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted z-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tWorkspace('inbox.searchPlaceholder')}
            aria-label={tWorkspace('inbox.searchAria')}
            size="sm"
            className="pl-8.5"
          />
        </div>

        <div
          role="tablist"
          aria-label={tWorkspace('inbox.title')}
          className="flex rounded-lg border border-hairline bg-surface-lifted p-1 gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'escalated'}
            onClick={() => setActiveTab('escalated')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-all duration-150',
              activeTab === 'escalated'
                ? 'bg-status-danger/15 text-status-danger-foreground shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-card',
            )}
          >
            <span>{t('tabs.escalated')}</span>
            {counts.escalated > 0 && (
              <Badge
                variant="rose"
                size="xs"
                label={counts.escalated}
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'human'}
            onClick={() => setActiveTab('human')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-all duration-150',
              activeTab === 'human'
                ? 'bg-status-warning/15 text-status-warning-foreground shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-card',
            )}
          >
            <span>{t('tabs.humanHandling')}</span>
            {counts.human > 0 && (
              <Badge
                variant="warning"
                size="xs"
                label={counts.human}
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bot'}
            onClick={() => setActiveTab('bot')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-all duration-150',
              activeTab === 'bot'
                ? 'bg-surface-card text-foreground shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-card',
            )}
          >
            <span>{t('tabs.botListening')}</span>
            {counts.bot > 0 && (
              <Badge
                variant="secondary"
                size="xs"
                label={counts.bot}
              />
            )}
          </button>
        </div>
      </div>

      <div
        tabIndex={0}
        aria-label={tWorkspace('inbox.listAria')}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto outline-none"
      >
        {isLoading && <SessionListSkeleton />}
        {error && (
          <div className="m-2">
            <ErrorBanner
              message={`${tWorkspace('inbox.loadFailed')}${error.message ? ` ${error.message}` : ''}`}
              onRetry={() => void refetch()}
            />
          </div>
        )}
        {!isLoading && !error && filteredConversations.length === 0 && (
          <div className="grid min-h-48 place-items-center px-5 text-center">
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {tWorkspace('inbox.emptyTitle')}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {tWorkspace('inbox.emptyDescription')}
              </p>
            </div>
          </div>
        )}
        {filteredConversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            isActive={conversation.id === selectedConversationId}
            onSelect={onSelectConversation}
          />
        ))}
      </div>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <div className="divide-y divide-hairline">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex animate-pulse items-start gap-3 p-4">
          <div className="size-8 rounded-full bg-surface-card" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-surface-card" />
            <div className="h-3 w-3/4 rounded bg-surface-card" />
          </div>
        </div>
      ))}
    </div>
  );
}
