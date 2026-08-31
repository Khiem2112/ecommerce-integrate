'use client';

import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { selectedConversationIdAtom, sidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { Badge } from '@/components/atoms';
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
  }

  function handleGenerate() {
    if (!selectedConversationId) return;
    generateResponse(selectedConversationId, {
      onSuccess: (generatedDraft) => {
        setDraft(generatedDraft);
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
    <main className="h-dvh max-h-dvh overflow-hidden bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-white px-4 shadow-xs md:px-5">
          <div className="flex items-center gap-3">
            <div className="relative grid size-8 place-items-center rounded-full bg-foreground text-sm font-bold text-background shadow-xs">
              V
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-status-warning" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                VIP Agent Workspace
              </h1>
              <p className="hidden text-xs text-muted sm:block">
                Grounded customer-care co-pilot
              </p>
            </div>
          </div>
          <Badge
            variant="success"
            size="sm"
            useDot
            label="System ready"
          />
        </header>

        <div
          className={cn(
            'grid min-h-0 flex-1 overflow-hidden',
            sidebarCollapsed
              ? 'xl:grid-cols-[20rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[20rem_minmax(0,1fr)_22.5rem]',
          )}
        >
          <aside
            className={cn(
              'h-full min-h-0 overflow-hidden border-r border-hairline bg-surface-lifted xl:block',
              mobileView === 'inbox' ? 'block' : 'hidden',
            )}
          >
            <ConversationInbox
              selectedConversationId={selectedConversationId}
              onSelectConversation={selectConversation}
            />
          </aside>

          <section
            className={cn(
              'h-full min-h-0 overflow-hidden bg-background xl:block',
              mobileView === 'chat' ? 'block' : 'hidden',
            )}
          >
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

          {!sidebarCollapsed && (
            <aside className="hidden h-full min-h-0 overflow-hidden border-l border-hairline bg-surface-lifted xl:block">
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
      </div>
    </main>
  );
}
