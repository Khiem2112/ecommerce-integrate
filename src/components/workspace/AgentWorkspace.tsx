'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import { selectedConversationIdAtom, sidebarCollapsedAtom } from '@/atoms/workspaceAtoms';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { CustomerContextPanel } from '@/components/context/CustomerContextPanel';
import { ConversationInbox } from '@/components/inbox/ConversationInbox';
import { useConversationDetail } from '@/hooks/useConversationDetail';
import { cn } from '@/lib/cn';

export function AgentWorkspace() {
  const [selectedConversationId, setSelectedConversationId] = useAtom(selectedConversationIdAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [mobileView, setMobileView] = useState<'inbox' | 'chat'>('inbox');
  const { data: conversation, isLoading } = useConversationDetail(selectedConversationId);

  function selectConversation(conversationId: number) {
    setSelectedConversationId(conversationId);
    setMobileView('chat');
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/25 bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success-text">
            <span className="size-1.5 rounded-full bg-status-success" />
            System ready
          </span>
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
            />
          </section>

          {!sidebarCollapsed && (
            <aside className="hidden h-full min-h-0 overflow-hidden border-l border-hairline bg-surface-lifted xl:block">
              <CustomerContextPanel
                conversationId={selectedConversationId}
                onCollapse={() => setSidebarCollapsed(true)}
              />
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
