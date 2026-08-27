'use client';

import { useAtom } from 'jotai';
import { useDeferredValue, useState } from 'react';
import { inboxFiltersAtom } from '@/atoms/workspaceAtoms';
import { ConversationRow } from '@/components/inbox/ConversationRow';
import { InboxFilters } from '@/components/inbox/InboxFilters';
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
  const { data: conversations = [], isLoading, error } = useConversations({
    ...filters,
    searchQuery: deferredSearchText,
  });

  function handleSearchChange(value: string) {
    setSearchText(value);
    setFilters((current) => ({ ...current, searchQuery: value }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Conversations</h2>
            <p className="mt-0.5 text-xs text-slate-400">Live customer inbox</p>
          </div>
          <span className="grid min-w-6 place-items-center rounded-full bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-300">
            {conversations.length}
          </span>
        </div>
        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            value={searchText}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search ID, intent, message"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-9 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
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
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2 outline-none"
      >
        {isLoading && <InboxSkeleton />}
        {error && (
          <div className="m-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            Unable to load the inbox. {error.message}
          </div>
        )}
        {!isLoading && !error && conversations.length === 0 && (
          <div className="grid min-h-48 place-items-center px-5 text-center">
            <div>
              <p className="text-sm font-medium text-slate-300">No conversations found</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
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
    <div className="space-y-2 p-2" aria-label="Loading conversations">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={`inbox-skeleton-${index}`}
          className="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-3"
        >
          <div className="h-3 w-2/5 rounded bg-slate-700" />
          <div className="mt-3 h-3 w-4/5 rounded bg-slate-800" />
          <div className="mt-2 h-2.5 w-3/5 rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
