'use client';

import { useState, useEffect } from 'react';
import { IconButton } from '@/components/atoms';
import { AiResponsePreview } from '@/components/organisms/copilot/AiResponsePreview';
import { CustomerContextPanel } from '@/components/organisms/context/CustomerContextPanel';
import {
  useLatestAiDraft,
  useAiDraftHistory,
  useAiDraftDetail,
} from '@/hooks/useAiDraft';
import { cn } from '@/lib/cn';
import type { AiDraftDetailDto, MultiDraftRagDraft } from '@/types';

type SidebarTab = 'customer' | 'ai-draft';

type ContextSidebarProps = {
  readonly conversationId: number | null;
  readonly onCollapse: () => void;
  readonly draft: MultiDraftRagDraft | AiDraftDetailDto | null;
  readonly conversationIdForDraft: number | null;
  readonly onDismissDraft: () => void;
  readonly onSavedDraft: () => void;
};

export function ContextSidebar({
  conversationId,
  onCollapse,
  draft: inMemoryDraft,
  conversationIdForDraft,
  onDismissDraft,
  onSavedDraft,
}: ContextSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('customer');
  const [dismissedDraftId, setDismissedDraftId] = useState<number | null>(null);
  const [selectedHistoryDraftId, setSelectedHistoryDraftId] = useState<number | null>(null);

  // Reset local dismissal and history selection when conversation changes
  useEffect(() => {
    setDismissedDraftId(null);
    setSelectedHistoryDraftId(null);
  }, [conversationId]);

  // Load persistent draft from MySQL database
  const { data: dbDraft, isLoading: isDraftLoading } = useLatestAiDraft(conversationId);
  const { data: draftHistory = [] } = useAiDraftHistory(conversationId);

  // Load historical draft detail if a specific older draft is selected
  const isViewingHistorical =
    selectedHistoryDraftId !== null &&
    dbDraft?.id !== selectedHistoryDraftId;

  const { data: historicalDraft, isLoading: isHistoricalLoading } = useAiDraftDetail(
    isViewingHistorical ? selectedHistoryDraftId : null,
    conversationId,
  );

  // If dismissed, ignore dbDraft until conversation or draft changes
  const effectiveDbDraft =
    dbDraft && dbDraft.id === dismissedDraftId ? null : dbDraft ?? null;

  // Determine active draft to display
  const activeDraft = isViewingHistorical
    ? historicalDraft ?? null
    : inMemoryDraft ?? effectiveDbDraft ?? null;

  const targetConversationId = conversationIdForDraft ?? conversationId;
  const hasDraft = activeDraft !== null;

  /* Auto-switch to AI Draft tab when a new in-memory draft is available */
  useEffect(() => {
    if (inMemoryDraft) {
      setDismissedDraftId(null);
      setSelectedHistoryDraftId(null);
      setActiveTab('ai-draft');
    }
  }, [inMemoryDraft]);

  function handleDismiss() {
    const currentId =
      activeDraft && 'id' in activeDraft
        ? activeDraft.id
        : activeDraft?.draftId ?? null;
    if (currentId) {
      setDismissedDraftId(currentId);
    }
    onDismissDraft();
  }

  function handleSelectHistoryDraft(draftId: number) {
    setDismissedDraftId(null);
    setSelectedHistoryDraftId(draftId);
    setActiveTab('ai-draft');
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-lifted">
      {/* Sidebar Header with Tabs */}
      <header className="shrink-0 border-b border-hairline bg-surface-lifted px-3 pt-3 pb-0">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {activeTab === 'customer' ? 'Customer context' : 'AI Draft Co-Pilot'}
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
            {(isDraftLoading || isHistoricalLoading) && !activeDraft ? (
              <div className="grid h-full min-h-48 place-items-center text-center">
                <div className="text-xs text-muted">Đang tải AI draft...</div>
              </div>
            ) : activeDraft && targetConversationId !== null ? (
              <div className="space-y-3">
                {/* Draft History Selector if multiple drafts exist */}
                {draftHistory.length > 1 && (
                  <div className="rounded-xl border border-hairline bg-background/60 p-2 text-xs space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
                      <span>Lịch sử ({draftHistory.length} phiên gợi ý)</span>
                      {isViewingHistorical && (
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryDraftId(null)}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          ← Về bản mới nhất
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                      {draftHistory.map((h) => {
                        const isSelected =
                          (isViewingHistorical && selectedHistoryDraftId === h.id) ||
                          (!isViewingHistorical && dbDraft?.id === h.id);
                        const time = new Date(h.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => handleSelectHistoryDraft(h.id)}
                            className={cn(
                              'flex items-center justify-between rounded-lg px-2 py-1 text-left text-[11px] transition duration-150 cursor-pointer',
                              isSelected
                                ? 'bg-foreground text-background font-semibold'
                                : 'bg-surface-lifted text-muted hover:text-foreground hover:bg-hairline',
                            )}
                          >
                            <span className="truncate">
                              #{h.id} ({time}){' '}
                              {h.triggerMessagePreview
                                ? `· "${h.triggerMessagePreview.slice(0, 18)}…"`
                                : ''}
                            </span>
                            <span className="shrink-0 text-[9px] uppercase tracking-wider ml-1">
                              {h.status === 'applied'
                                ? '✓ Đã duyệt'
                                : h.status === 'rejected'
                                  ? '✕ Từ chối'
                                  : h.isOutdated
                                    ? '⚠️ Hết hạn'
                                    : '🟡 Chờ duyệt'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <AiResponsePreview
                  draft={activeDraft}
                  conversationId={targetConversationId}
                  onDismiss={handleDismiss}
                  onSaved={onSavedDraft}
                />
              </div>
            ) : (
              <div className="grid h-full min-h-48 place-items-center text-center">
                <div>
                  <p className="text-sm text-muted">Chưa có AI draft</p>
                  <p className="mt-1 text-xs text-muted">
                    Bấm &quot;Generate AI Response&quot; trong khung chat để tạo câu trả lời gợi ý.
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
