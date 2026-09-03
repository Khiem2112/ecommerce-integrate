'use client';

import { useAtom } from 'jotai';
import Link from 'next/link';
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
    <main className="h-dvh max-h-dvh overflow-hidden bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-surface-card px-4 shadow-xs md:px-5">
          <div className="flex items-center gap-3">
            <div className="relative grid size-8 place-items-center rounded-full bg-foreground text-sm font-bold text-background shadow-xs">
              V
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-card bg-status-warning" />
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
          <div className="flex items-center gap-3">
            <Link
              href="/customers"
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-lifted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-card hover:border-hairline-strong transition shadow-xs"
            >
              <svg aria-hidden="true" className="size-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              <span>Khách hàng 360°</span>
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-lifted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-card hover:border-hairline-strong transition shadow-xs"
            >
              <svg aria-hidden="true" className="size-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
              </svg>
              <span>Đơn hàng</span>
            </Link>
            <Badge
              variant="success"
              size="sm"
              useDot
              label="System ready"
            />
          </div>
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
