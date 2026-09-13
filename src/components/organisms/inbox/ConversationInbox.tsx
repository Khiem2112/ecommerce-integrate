'use client';

import { useAtom } from 'jotai';
import { useDeferredValue, useState } from 'react';
import { inboxFiltersAtom } from '@/atoms/workspaceAtoms';
import { Badge, Input } from '@/components/atoms';
import { ConversationRow, InboxFilters } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import { useConversations } from '@/hooks/useConversations';

type ConversationInboxProps = {
  readonly selectedConversationId: number | null;
  readonly onSelectConversation: (conversationId: number) => void;
};

export function ConversationInbox({
  selectedConversationId,
  onSelectConversation,
}: ConversationInboxProps) {
  const [filters, setFilters] = useAtom(inboxFiltersAtom);
  const [searchText, setSearchText] = useState(filters.searchQuery ?? '');
  const deferredSearchText = useDeferredValue(searchText);
  const { data: conversations = [], isLoading, error, refetch } = useConversations({
    ...filters,
    searchQuery: deferredSearchText,
  });

  function handleSearchChange(value: string) {
    setSearchText(value);
    setFilters((current) => ({ ...current, searchQuery: value }));
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-hairline px-4 py-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Conversations</h2>
            <p className="mt-1 text-sm text-muted">Live customer inbox</p>
          </div>
          <Badge
            variant="secondary"
            size="xs"
            label={conversations.length}
          />
        </div>
        <div className="relative">
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
            value={searchText}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search ID, intent, message"
            aria-label="Search conversations"
            size="sm"
            className="pl-8.5"
          />
        </div>
        <InboxFilters
          selectedStatus={filters.statusCode ?? 'all'}
          selectedPriority={filters.priority ?? 'all'}
          onStatusChange={(statusCode) => setFilters((current) => ({ ...current, statusCode }))}
          onPriorityChange={(priority) => setFilters((current) => ({ ...current, priority }))}
        />
      </div>

      <div
        tabIndex={0}
        aria-label="Conversation list"
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto outline-none"
      >
        {isLoading && <InboxSkeleton />}
        {error && (
          <div className="m-2">
            <ErrorBanner
              message={`Unable to load the inbox.${error.message ? ` ${error.message}` : ''}`}
              onRetry={() => void refetch()}
            />
          </div>
        )}
        {!isLoading && !error && conversations.length === 0 && (
          <div className="grid min-h-48 place-items-center px-5 text-center">
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">No conversations found</p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Try changing your filters or clearing the search query.
              </p>
            </div>
          </div>
        )}
        {conversations.map((conversation) => (
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

function InboxSkeleton() {
  return (
    <div className="divide-y divide-hairline" aria-label="Loading conversations">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={`inbox-skeleton-${index}`}
          className="animate-pulse p-4"
        >
          <div className="h-3 w-2/5 rounded bg-hairline" />
          <div className="mt-3 h-3 w-4/5 rounded bg-background" />
          <div className="mt-2 h-2.5 w-3/5 rounded bg-background" />
        </div>
      ))}
    </div>
  );
}
