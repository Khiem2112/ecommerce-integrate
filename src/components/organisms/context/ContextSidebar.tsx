'use client';

import { useState, useEffect } from 'react';
import { IconButton } from '@/components/atoms';
import { AiResponsePreview } from '@/components/organisms/copilot/AiResponsePreview';
import { CustomerContextPanel } from '@/components/organisms/context/CustomerContextPanel';
import { cn } from '@/lib/cn';
import type { MultiDraftRagDraft } from '@/types';

type SidebarTab = 'customer' | 'ai-draft';

type ContextSidebarProps = {
  readonly conversationId: number | null;
  readonly onCollapse: () => void;
  readonly draft: MultiDraftRagDraft | null;
  readonly conversationIdForDraft: number | null;
  readonly onDismissDraft: () => void;
  readonly onSavedDraft: () => void;
};

export function ContextSidebar({
  conversationId,
  onCollapse,
  draft,
  conversationIdForDraft,
  onDismissDraft,
  onSavedDraft,
}: ContextSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('customer');

  /* Auto-switch to AI Draft tab when a new draft arrives */
  useEffect(() => {
    if (draft) {
      setActiveTab('ai-draft');
    }
  }, [draft]);

  /* Reset to customer tab when draft is dismissed/saved */
  useEffect(() => {
    if (!draft && activeTab === 'ai-draft') {
      setActiveTab('customer');
    }
  }, [draft, activeTab]);

  const hasDraft = draft !== null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-lifted">
      {/* Sidebar Header with Tabs */}
      <header className="shrink-0 border-b border-hairline bg-surface-lifted px-3 pt-3 pb-0">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {activeTab === 'customer' ? 'Customer context' : 'AI Draft'}
          </h2>
          <IconButton
            size="sm"
            variant="ghost"
            ariaLabel="Collapse sidebar"
            tooltip="Collapse sidebar"
            onClick={onCollapse}
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
                <path d="m11 9-3 3 3 3" />
              </svg>
            }
          />
        </div>

        {/* Tab pills */}
        <div
          role="tablist"
          aria-label="Sidebar tabs"
          className="flex gap-1 rounded-full border border-hairline bg-background p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'customer'}
            onClick={() => setActiveTab('customer')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition duration-150 cursor-pointer',
              activeTab === 'customer'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted hover:text-foreground',
            )}
          >
            Customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ai-draft'}
            aria-disabled={!hasDraft}
            onClick={() => hasDraft && setActiveTab('ai-draft')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition duration-150 relative',
              activeTab === 'ai-draft'
                ? 'bg-foreground text-background shadow-xs'
                : hasDraft
                  ? 'text-muted hover:text-foreground cursor-pointer'
                  : 'text-muted/40 cursor-not-allowed',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              ✦ AI Draft
              {/* Notification dot when draft available but viewing customer tab */}
              {hasDraft && activeTab !== 'ai-draft' && (
                <span className="size-1.5 rounded-full bg-status-warning animate-pulse" />
              )}
            </span>
          </button>
        </div>
      </header>

      {/* Tab panels */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'customer' ? (
          <div role="tabpanel" aria-label="Customer context" className="h-full">
            <CustomerContextPanel
              conversationId={conversationId}
              onCollapse={onCollapse}
              headerHidden
            />
          </div>
        ) : (
          <div
            role="tabpanel"
            aria-label="AI Draft review"
            className="custom-scrollbar h-full overflow-y-auto p-3"
          >
            {draft && conversationIdForDraft !== null ? (
              <AiResponsePreview
                draft={draft}
                conversationId={conversationIdForDraft}
                onDismiss={onDismissDraft}
                onSaved={onSavedDraft}
              />
            ) : (
              <div className="grid h-full min-h-48 place-items-center text-center">
                <div>
                  <p className="text-sm text-muted">No AI draft available</p>
                  <p className="mt-1 text-xs text-muted">
                    Generate a draft from the chat composer.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
