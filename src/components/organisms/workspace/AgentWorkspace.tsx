'use client';

import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { selectedConversationIdAtom, sidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { IconButton } from '@/components/atoms';
import { ChatPanel } from '@/components/organisms/chat/ChatPanel';
import { ContextSidebar } from '@/components/organisms/context/ContextSidebar';
import { ConversationInbox } from '@/components/organisms/inbox/ConversationInbox';
import { useConversationDetail } from '@/hooks/useConversationDetail';
import { useRagGenerate } from '@/hooks/useRagGenerate';
import { useBreadcrumb } from '@/hooks';
import { cn } from '@/lib/cn';
import type { MultiDraftRagDraft } from '@/types';

export function AgentWorkspace() {
  const t = useTranslations('workspace');
  const tBreadcrumb = useTranslations('breadcrumb');
  const { setBreadcrumb } = useBreadcrumb();
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

  useEffect(() => {
    setBreadcrumb([{ label: tBreadcrumb('workspace') }]);
  }, [setBreadcrumb, tBreadcrumb]);

  useEffect(() => {
    const compactWorkspace = window.matchMedia('(max-width: 1535px)');

    function handleWorkspaceWidth(event: MediaQueryListEvent | MediaQueryList) {
      if (event.matches) {
        setSidebarCollapsed(true);
      }
    }

    handleWorkspaceWidth(compactWorkspace);
    compactWorkspace.addEventListener('change', handleWorkspaceWidth);

    return () => compactWorkspace.removeEventListener('change', handleWorkspaceWidth);
  }, [setSidebarCollapsed]);

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
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Inbox panel */}
      <aside
        className={cn(
          'relative h-full min-h-0 min-w-0 w-full shrink-0 overflow-hidden border-r border-hairline bg-surface-lifted xl:w-76',
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
          ariaLabel={t('collapseInbox')}
          tooltip={t('collapseInbox')}
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
            ariaLabel={t('expandInbox')}
            tooltip={t('expandInbox')}
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
        <>
          <button
            type="button"
            aria-label={t('closeCustomerContext')}
            onClick={() => setSidebarCollapsed(true)}
            className="absolute inset-0 z-20 hidden cursor-default bg-canvas-deep/20 sm:block 2xl:hidden"
          />
          <aside className="absolute inset-y-0 right-0 z-30 h-full min-h-0 w-full shrink-0 overflow-hidden border-l border-hairline bg-surface-lifted shadow-elevated sm:w-96 2xl:relative 2xl:z-auto 2xl:w-80 2xl:shadow-none">
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
        </>
      )}
    </div>
  );
}
