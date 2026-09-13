'use client';

import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { selectedConversationIdAtom, sidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { IconButton } from '@/components/atoms';
import { ChatPanel } from '@/components/organisms/chat/ChatPanel';
import { ContextSidebar } from '@/components/organisms/context/ContextSidebar';
import { ConversationInbox } from '@/components/organisms/inbox/ConversationInbox';
import { useConversationDetail } from '@/hooks/useConversationDetail';
import { useRagGenerate } from '@/hooks/useRagGenerate';
import { cn } from '@/lib/cn';
import type { MultiDraftRagDraft } from '@/types';

export function AgentWorkspace() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useAtom(selectedConversationIdAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [mobileView, setMobileView] = useState<'inbox' | 'chat'>('inbox');
  const [inboxCollapsed, setInboxCollapsed] = useState(false);
  const { data: conversation, isLoading } = useConversationDetail(selectedConversationId);

  /* Draft state lifted from ChatPanel */
  const { mutate: generateResponse, isPending: isGenerating, error: generateError } =
    useRagGenerate();
  const [draft, setDraft] = useState<MultiDraftRagDraft | null>(null);

  function selectConversation(conversationId: number) {
    setSelectedConversationId(conversationId);
    setMobileView('chat');
    setDraft(null);
  }

  function refreshConversation() {
    if (!selectedConversationId) return;
    void queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['ai-draft', selectedConversationId] });
    void queryClient.invalidateQueries({ queryKey: ['ai-draft-history', selectedConversationId] });
  }

  function handleGenerate() {
    if (!selectedConversationId) return;
    const requestConversationId = selectedConversationId;
    generateResponse(requestConversationId, {
      onSuccess: (generatedDraft) => {
        if (selectedConversationId !== requestConversationId) return;
        setDraft(generatedDraft);
        void queryClient.invalidateQueries({ queryKey: ['ai-draft', requestConversationId] });
        void queryClient.invalidateQueries({ queryKey: ['ai-draft-history', requestConversationId] });
        /* Auto-open sidebar when draft arrives */
        if (sidebarCollapsed) {
          setSidebarCollapsed(false);
        }
      },
    });
  }

  function handleViewDraft() {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
    /* ContextSidebar auto-switches to AI Draft tab via useEffect when draft is set */
  }

  function handleToggleContext() {
    setSidebarCollapsed((current) => !current);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Inbox panel */}
      <aside
        className={cn(
          'relative h-full min-h-0 w-full shrink-0 overflow-hidden border-r border-hairline bg-surface-lifted xl:w-80',
          mobileView === 'inbox' ? 'block' : 'hidden',
          inboxCollapsed ? 'xl:hidden' : 'xl:block',
        )}
      >
        <ConversationInbox
          selectedConversationId={selectedConversationId}
          onSelectConversation={selectConversation}
        />

        {/* Collapse inbox toggle */}
        <IconButton
          ariaLabel="Collapse inbox"
          tooltip="Collapse inbox"
          variant="ghost"
          size="xs"
          onClick={() => setInboxCollapsed(true)}
          className="absolute right-1.5 top-2.5 hidden xl:grid text-muted hover:text-foreground"
          icon={
            <svg
              aria-hidden="true"
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          }
        />
      </aside>

      {/* Chat panel */}
      <section
        className={cn(
          'relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background',
          mobileView === 'chat' ? 'block' : 'hidden xl:block',
        )}
      >
        {/* Expand inbox toggle — shown only when inbox is collapsed on desktop */}
        {inboxCollapsed && (
          <IconButton
            ariaLabel="Expand inbox"
            tooltip="Expand inbox"
            variant="subtle"
            size="xs"
            onClick={() => setInboxCollapsed(false)}
            className="absolute left-2 top-2.5 z-10 hidden xl:grid text-muted hover:text-foreground"
            icon={
              <svg
                aria-hidden="true"
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            }
          />
        )}

        <ChatPanel
          conversation={conversation ?? null}
          isLoading={isLoading}
          onBack={() => setMobileView('inbox')}
          isContextOpen={!sidebarCollapsed}
          onToggleContext={handleToggleContext}
          draft={draft}
          isGenerating={isGenerating}
          generateError={generateError}
          onGenerate={handleGenerate}
          onRefresh={refreshConversation}
          onViewDraft={handleViewDraft}
        />
      </section>

      {/* Context sidebar */}
      {!sidebarCollapsed && (
        <aside className="hidden h-full min-h-0 w-90 shrink-0 overflow-hidden border-l border-hairline bg-surface-lifted xl:block">
          <ContextSidebar
            conversationId={selectedConversationId}
            onCollapse={() => setSidebarCollapsed(true)}
            draft={draft}
            conversationIdForDraft={selectedConversationId}
            onDismissDraft={() => setDraft(null)}
            onSavedDraft={() => {
              setDraft(null);
              refreshConversation();
            }}
          />
        </aside>
      )}
    </div>
  );
}
