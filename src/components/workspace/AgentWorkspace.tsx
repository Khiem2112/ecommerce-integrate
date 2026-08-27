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
    <main className="h-dvh max-h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur md:px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-950/40">
              V
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white">
                VIP Agent Workspace
              </h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                Grounded customer-care co-pilot
              </p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
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
              'h-full min-h-0 overflow-hidden border-r border-slate-800 bg-slate-900/40 xl:block',
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
              'h-full min-h-0 overflow-hidden bg-slate-950 xl:block',
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
            <aside className="hidden h-full min-h-0 overflow-hidden border-l border-slate-800 bg-slate-900/30 xl:block">
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
