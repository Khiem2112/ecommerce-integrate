'use client';

import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { markConversationReadAction } from '@/actions/agentSessionActions';
import { selectedConversationIdAtom, sidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { IconButton } from '@/components/atoms';
import { ChatPanel, AgentSessionList } from '@/components/organisms/chat';
import { ContextSidebar } from '@/components/organisms/context/ContextSidebar';
import { useConversationDetail } from '@/hooks/useConversationDetail';
import { useRagGenerate } from '@/hooks/useRagGenerate';
import { useBreadcrumb, useAgentSession } from '@/hooks';
import { cn } from '@/lib/cn';
import type { ConversationDetail, ConversationSummary, MultiDraftRagDraft } from '@/types';

export function AgentWorkspace(): ReactElement {
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
  const inFlightReadIdsRef = useRef<Set<number>>(new Set());
  const lastAttemptedUnreadRef = useRef<Map<number, number>>(new Map());

  useAgentSession({ activeConversationId: selectedConversationId });

  const syncConversationRead = useCallback(
    (conversationId: number, unreadCount: number): void => {
      if (unreadCount <= 0) {
        return;
      }
      if (inFlightReadIdsRef.current.has(conversationId)) {
        return;
      }
      if (lastAttemptedUnreadRef.current.get(conversationId) === unreadCount) {
        return;
      }

      inFlightReadIdsRef.current.add(conversationId);
      lastAttemptedUnreadRef.current.set(conversationId, unreadCount);

      void markConversationReadAction({ conversationId })
        .then((res) => {
          if (!res.success) {
            return;
          }

          lastAttemptedUnreadRef.current.delete(conversationId);
          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', conversationId],
            (prev) => (prev ? { ...prev, unreadCount: 0 } : prev),
          );
          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) =>
              Array.isArray(prevList)
                ? prevList.map((item) =>
                    item.id === conversationId ? { ...item, unreadCount: 0 } : item,
                  )
                : prevList,
          );
          void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        })
        .catch(() => {})
        .finally(() => {
          inFlightReadIdsRef.current.delete(conversationId);
        });
    },
    [queryClient],
  );

  useEffect(() => {
    setBreadcrumb([{ label: tBreadcrumb('workspace') }]);
  }, [setBreadcrumb, tBreadcrumb]);

  useEffect(() => {
    const compactWorkspace = window.matchMedia('(max-width: 1535px)');

    function handleWorkspaceWidth(event: MediaQueryListEvent | MediaQueryList): void {
      if (event.matches) {
        setSidebarCollapsed(true);
      }
    }

    handleWorkspaceWidth(compactWorkspace);
    compactWorkspace.addEventListener('change', handleWorkspaceWidth);

    return () => compactWorkspace.removeEventListener('change', handleWorkspaceWidth);
  }, [setSidebarCollapsed]);

  function selectConversation(conversationId: number): void {
    setSelectedConversationId(conversationId);
    setMobileView('chat');
    setDraft(null);

    const cachedLists = queryClient.getQueriesData<ConversationSummary[]>({
      queryKey: ['conversations'],
    });
    for (const [, list] of cachedLists) {
      const matched = Array.isArray(list)
        ? list.find((item) => item.id === conversationId)
        : undefined;
      if (matched && (matched.unreadCount ?? 0) > 0) {
        syncConversationRead(conversationId, matched.unreadCount ?? 0);
        break;
      }
    }
  }

  const refreshConversation = useCallback((): void => {
    if (!selectedConversationId) return;
    void queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['ai-draft', selectedConversationId] });
    void queryClient.invalidateQueries({ queryKey: ['ai-draft-history', selectedConversationId] });
  }, [queryClient, selectedConversationId]);

  function handleGenerate(): void {
    if (!selectedConversationId) return;
    const requestConversationId = selectedConversationId;
    generateResponse(requestConversationId, {
      onSuccess: (generatedDraft): void => {
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

  function handleViewDraft(): void {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
    /* ContextSidebar auto-switches to AI Draft tab via useEffect when draft is set */
  }

  function handleToggleContext(): void {
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
        <AgentSessionList
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
          onMarkRead={syncConversationRead}
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
