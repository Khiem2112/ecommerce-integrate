'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Badge, IconButton } from '@/components/atoms';
import { EmptyChat, MessageBubble, MessageInput } from '@/components/molecules';
import { AiResponsePreview } from '@/components/organisms/copilot/AiResponsePreview';
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
            <Badge
              variant="secondary"
              size="xs"
              label={conversation.status.name}
            />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {conversation.intent?.name ?? 'Unclassified inquiry'}
            {conversation.assignedAgentName ? ` · ${conversation.assignedAgentName}` : ''}
          </p>
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
        {draft && (
          <div className="mx-auto mt-4 max-w-3xl" key={conversation.id}>
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
            className="mx-auto mt-4 max-w-3xl rounded-2xl border border-semantic-error/30 bg-semantic-error/10 p-3 text-xs text-semantic-error"
          >
            Unable to generate an AI response. {generateError.message}
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="shrink-0 border-t border-hairline bg-surface-lifted p-3 md:px-6">
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
