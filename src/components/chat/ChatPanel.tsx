'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/atoms';
import { EmptyChat } from '@/components/chat/EmptyChat';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { AiResponsePreview } from '@/components/copilot/AiResponsePreview';
import { useRagGenerate } from '@/hooks/useRagGenerate';
import type { ConversationDetail, MultiDraftRagDraft } from '@/types';

type ChatPanelProps = {
  readonly conversation: ConversationDetail | null;
  readonly isLoading: boolean;
  readonly onBack: () => void;
  readonly isContextOpen?: boolean;
  readonly onToggleContext?: () => void;
};

export function ChatPanel({
  conversation,
  isLoading,
  onBack,
  isContextOpen = true,
  onToggleContext,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const { mutate: generateResponse, isPending: isGenerating, error: generateError } =
    useRagGenerate();
  const [draft, setDraft] = useState<MultiDraftRagDraft | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length, draft]);

  function refreshConversation() {
    if (!conversation) return;
    void queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  function handleGenerate() {
    if (!conversation) return;
    generateResponse(conversation.id, {
      onSuccess: (generatedDraft) => setDraft(generatedDraft),
    });
  }

  if (isLoading) return <ChatLoading />;
  if (!conversation) return <EmptyChat />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-4 md:px-6">
        <button
          type="button"
          onClick={onBack}
          className="grid size-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 xl:hidden"
          aria-label="Back to conversations"
        >
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
        </button>
        <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet-500/60 to-indigo-500/60 text-xs font-bold text-white shadow-sm">
          {conversation.customerIdentifier.slice(-2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-white">
              {conversation.customerIdentifier}
            </h2>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {conversation.status.name}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {conversation.intent?.name ?? 'Unclassified inquiry'}
            {conversation.assignedAgentName ? ` · ${conversation.assignedAgentName}` : ''}
          </p>
        </div>

        {conversation.humanApprovalRequired && (
          <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 sm:block">
            Review required
          </span>
        )}

        {onToggleContext && (
          <IconButton
            size="sm"
            variant="subtle"
            isActive={isContextOpen}
            ariaLabel={isContextOpen ? 'Close customer context' : 'Open customer context'}
            tooltip={isContextOpen ? 'Close customer context' : 'Open customer context'}
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

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {conversation.messages.length === 0 ? (
          <div className="grid h-full min-h-48 place-items-center text-center">
            <div>
              <p className="text-sm font-medium text-slate-300">Start the conversation</p>
              <p className="mt-1 text-xs text-slate-500">
                Write a reply or request a grounded AI draft.
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
          <div className="mx-auto mt-5 max-w-3xl" key={conversation.id}>
            <AiResponsePreview
              key={conversation.id}
              draft={draft}
              conversationId={conversation.id}
              onDismiss={() => setDraft(null)}
              onSaved={() => {
                setDraft(null);
                refreshConversation();
              }}
            />
          </div>
        )}
        {generateError && !draft && (
          <div
            role="alert"
            className="mx-auto mt-4 max-w-3xl rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"
          >
            Unable to generate an AI response. {generateError.message}
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950/80 p-4 backdrop-blur md:px-6">
        <div className="mx-auto max-w-3xl">
          <MessageInput
            conversationId={conversation.id}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            onSent={refreshConversation}
          />
        </div>
      </div>
    </div>
  );
}

function ChatLoading() {
  return (
    <div className="flex h-full min-h-96 flex-col animate-pulse">
      <div className="h-16 border-b border-slate-800" />
      <div className="flex-1 space-y-5 p-6">
        <div className="h-16 max-w-sm rounded-xl bg-slate-900" />
        <div className="ml-auto h-20 max-w-md rounded-xl bg-slate-800" />
        <div className="h-12 max-w-xs rounded-xl bg-slate-900" />
      </div>
    </div>
  );
}
