'use client';

import { useState, useEffect } from 'react';
import { saveAiResponseAction } from '@/actions/conversationActions';
import { rejectAiDraftAction } from '@/actions/aiDraftActions';
import { Badge, Button, type BadgeVariant } from '@/components/atoms';
import { GroundingAnnotation } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import { cn } from '@/lib/cn';
import type {
  AiDraftDetailDto,
  MultiDraftRagDraft,
  SuggestedAction,
} from '@/types';

type AiResponsePreviewProps = {
  readonly draft: AiDraftDetailDto | MultiDraftRagDraft;
  readonly conversationId: number;
  readonly onDismiss: () => void;
  readonly onSaved: () => void;
};

const actionLabels: Record<SuggestedAction, string> = {
  auto_reply: 'Auto-reply eligible',
  await_approval: 'Approval recommended',
  escalate_to_human: 'Escalate to human',
};

const actionVariants: Record<SuggestedAction, BadgeVariant> = {
  auto_reply: 'success',
  await_approval: 'warning',
  escalate_to_human: 'rose',
};

const REJECTION_OPTIONS: { readonly value: string; readonly label: string }[] = [
  { value: 'manual_reply', label: 'Trả lời thủ công' },
  { value: 'hallucination', label: 'AI bịa thông tin (Hallucination)' },
  { value: 'tone_inappropriate', label: 'Giọng điệu không phù hợp' },
  { value: 'policy_violation', label: 'Vi phạm chính sách sàn' },
  { value: 'customer_cancelled', label: 'Khách hàng đã hủy yêu cầu' },
];

function isDetailDto(
  draft: AiDraftDetailDto | MultiDraftRagDraft,
): draft is AiDraftDetailDto {
  return 'status' in draft && 'recommendedStrategyCode' in draft;
}

export function AiResponsePreview({
  draft,
  conversationId,
  onDismiss,
  onSaved,
}: AiResponsePreviewProps) {
  const isFullDraft = isDetailDto(draft);
  const draftId = isFullDraft ? draft.id : draft.draftId;
  const draftStatus = isFullDraft ? draft.status : 'pending';
  const isOutdated = isFullDraft ? draft.isOutdated : false;
  const isApprovable = isFullDraft ? draft.isApprovable : true;
  const recommendedStrategyCode = isFullDraft
    ? draft.recommendedStrategyCode
    : draft.response?.recommendedStrategyId ?? '';
  const selectedStrategyCode = isFullDraft ? draft.selectedStrategyCode : null;
  const triggerMessage = isFullDraft ? draft.triggerMessage : draft.triggerMessage;

  const strategies = draft.response?.strategies ?? [];
  const defaultStrategyId =
    selectedStrategyCode ?? recommendedStrategyCode ?? strategies[0]?.id ?? '';

  const [activeStrategyId, setActiveStrategyId] = useState<string>(defaultStrategyId);
  const [isEditing, setIsEditing] = useState(false);
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>('manual_reply');
  const [error, setError] = useState<string | null>(null);

  /* Reset draft-specific state whenever the active draft identity changes */
  useEffect(() => {
    setActiveStrategyId(defaultStrategyId);
    setIsEditing(false);
    setCustomTexts({});
    setError(null);
  }, [draftId, defaultStrategyId]);

  const activeStrategy =
    strategies.find((s) => s.id === activeStrategyId) ?? strategies[0];

  const currentText =
    customTexts[activeStrategy?.id ?? ''] ??
    (isFullDraft && draft.customDraftText && activeStrategy?.id === selectedStrategyCode
      ? draft.customDraftText
      : activeStrategy?.draftText ?? '');

  const activeGrounding =
    draft.grounding?.byStrategyId?.[activeStrategy?.id ?? ''] ?? {
      isValid: draft.grounding?.isValid ?? true,
      groundingPrecision: 1.0,
      totalClaims: activeStrategy?.groundedFactsUsed.length ?? 0,
      groundedClaims: activeStrategy?.groundedFactsUsed.length ?? 0,
      violations: [],
      sanitizedResponse: {
        responseText: currentText,
        groundedFactsUsed: activeStrategy?.groundedFactsUsed ?? [],
        ungroundedClaims: activeStrategy?.ungroundedClaims ?? [],
        confidence: activeStrategy?.confidence ?? 1.0,
        suggestedAction: activeStrategy?.suggestedAction ?? 'auto_reply',
      },
    };

  const isCurrentValid = activeGrounding.isValid;
  const canApprove =
    draftStatus === 'pending' &&
    !isOutdated &&
    isApprovable &&
    isCurrentValid &&
    activeStrategy?.suggestedAction !== 'escalate_to_human' &&
    currentText.trim().length > 0;

  function handleSelectStrategy(strategyId: string) {
    setActiveStrategyId(strategyId);
    setIsEditing(false);
  }

  function handleTextChange(newText: string) {
    if (!activeStrategy) return;
    setCustomTexts((prev) => ({
      ...prev,
      [activeStrategy.id]: newText,
    }));
  }

  function toggleEditing() {
    if (isEditing) {
      if (activeStrategy) {
        setCustomTexts((prev) => {
          const updated = { ...prev };
          delete updated[activeStrategy.id];
          return updated;
        });
      }
      setIsEditing(false);
      return;
    }
    setIsEditing(true);
  }

  async function handleApprove() {
    if (!activeStrategy || !canApprove || isSaving || !draftId) return;

    setIsSaving(true);
    setError(null);
    try {
      const res = await saveAiResponseAction({
        conversationId,
        draftId,
        selectedStrategyCode: activeStrategy.id,
        text: currentText.trim(),
        customDraftText: isEditing ? currentText.trim() : null,
      });

      if (!res.success) {
        throw new Error(res.error ?? 'Unable to save the AI response.');
      }
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the AI response.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRejectConfirm() {
    if (!draftId || isRejecting) return;

    setIsRejecting(true);
    setError(null);
    try {
      const res = await rejectAiDraftAction({
        draftId,
        conversationId,
        rejectionReason: selectedRejectReason,
      });

      if (!res.success) {
        throw new Error(res.error ?? 'Unable to reject the draft.');
      }
      setShowRejectModal(false);
      onSaved();
    } catch (rejectErr) {
      setError(rejectErr instanceof Error ? rejectErr.message : 'Unable to reject the draft.');
    } finally {
      setIsRejecting(false);
    }
  }

  if (!activeStrategy) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      {/* Header with Status Badge */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-surface-lifted px-1 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="grid size-5.5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background"
            aria-hidden="true"
          >
            ✦
          </span>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground">
              AI Multi-Draft Co-Pilot
            </h3>
            {isFullDraft && draft.createdAt && (
              <span className="text-[10px] text-muted">
                {new Date(draft.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {draft.response?.providerUsed && (
              <Badge
                variant="secondary"
                size="xs"
                label={draft.response.providerUsed}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Status Badge */}
          {draftStatus === 'applied' && (
            <Badge variant="success" size="xs" label="✓ Đã duyệt lưu" />
          )}
          {draftStatus === 'rejected' && (
            <Badge variant="rose" size="xs" label="✕ Đã từ chối" />
          )}
          {draftStatus === 'pending' && isOutdated && (
            <Badge variant="rose" size="xs" label="⚠️ Draft Outdated" />
          )}
          {draftStatus === 'pending' && !isOutdated && (
            <Badge variant="warning" size="xs" label="🟡 Chờ duyệt" />
          )}

          {/* Action safety pill */}
          <Badge
            variant={actionVariants[activeStrategy.suggestedAction]}
            size="xs"
            label={actionLabels[activeStrategy.suggestedAction]}
          />
        </div>
      </header>

      <div className="space-y-2.5 px-0.5 pt-1">
        {/* Trigger Customer Message Context */}
        {triggerMessage?.text && (
          <div className="rounded-xl border border-hairline bg-background p-2 text-xs">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span className="font-medium">Tin nhắn kích hoạt ({triggerMessage.senderName}):</span>
              <span>{new Date(triggerMessage.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs italic text-foreground/80">
              &ldquo;{triggerMessage.text}&rdquo;
            </p>
          </div>
        )}

        {/* Outdated Warning Banner */}
        {isOutdated && (
          <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-2.5 text-xs leading-5 text-semantic-error">
            <span className="font-semibold">⚠️ Draft đã lỗi thời:</span> Tin nhắn mới từ khách hàng đã xuất hiện sau khi draft này được tạo. Vui lòng bấm <strong>Generate AI Response</strong> để tạo phương án cập nhật.
          </div>
        )}

        {/* Recommendation Rationale Callout */}
        {draft.response?.recommendationReason && (
          <div className="flex items-center gap-2 rounded-xl border border-status-warning/20 bg-status-warning/5 px-2.5 py-1.5 text-xs text-foreground">
            <span className="text-xs font-bold text-status-warning">💡</span>
            <div className="truncate">
              <span className="font-semibold text-status-warning">Đề xuất: </span>
              <span className="text-foreground">{draft.response.recommendationReason}</span>
            </div>
          </div>
        )}

        {/* Horizontal Strategy Segmented Pill Tabs */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Chiến lược ({strategies.length} phương án)
            </span>
            <span className="text-[10px] text-muted">
              {activeStrategy.strategy?.tone ? `Tone: ${activeStrategy.strategy.tone}` : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Draft strategy options">
            {strategies.map((strategy) => {
              const isSelectedTab = strategy.id === activeStrategyId;
              const isRecommended = strategy.id === recommendedStrategyCode;
              const isAppliedStrategy =
                draftStatus === 'applied' && strategy.id === selectedStrategyCode;
              const isUnchosenApplied =
                draftStatus === 'applied' && strategy.id !== selectedStrategyCode;
              const hasVoucher = strategy.proposedCompensation?.kind === 'voucher';

              return (
                <button
                  key={strategy.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelectedTab}
                  onClick={() => handleSelectStrategy(strategy.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition duration-150 cursor-pointer border',
                    isSelectedTab
                      ? isAppliedStrategy
                        ? 'border-status-success bg-status-success text-on-primary shadow-xs'
                        : 'border-foreground bg-foreground text-background shadow-xs'
                      : isAppliedStrategy
                        ? 'border-status-success/40 bg-status-success/10 text-status-success-text'
                        : isUnchosenApplied
                          ? 'border-hairline bg-surface-lifted text-muted opacity-70'
                          : 'border-hairline bg-background text-foreground hover:border-foreground/30 hover:bg-hairline',
                  )}
                >
                  <span>{strategy.strategy?.name ?? `Rank #${strategy.rank}`}</span>

                  {/* Recommendation Badge */}
                  {draftStatus === 'pending' && isRecommended && (
                    <Badge
                      variant="warning"
                      size="xs"
                      className={cn(
                        'px-1.5 py-0 text-[9px] font-bold border-0',
                        isSelectedTab
                          ? 'bg-status-warning text-on-primary'
                          : 'bg-status-warning/15 text-status-warning',
                      )}
                      label="★ AI đề xuất"
                    />
                  )}

                  {/* Applied Badge */}
                  {isAppliedStrategy && (
                    <Badge
                      variant="success"
                      size="xs"
                      className="border-0 bg-status-success px-1.5 py-0 text-[9px] font-bold text-on-primary"
                      label="✓ Đã duyệt"
                    />
                  )}

                  {/* Unchosen Badge */}
                  {isUnchosenApplied && (
                    <Badge
                      variant="secondary"
                      size="xs"
                      className="border-0 px-1 py-0 text-[8px]"
                      label="Dự phòng"
                    />
                  )}

                  {/* Voucher Badge */}
                  {hasVoucher && (
                    <Badge
                      variant="success"
                      size="xs"
                      className={cn(
                        'px-1.5 py-0 text-[9px] font-bold border-0',
                        isSelectedTab
                          ? 'bg-status-success text-on-primary'
                          : 'bg-status-success/15 text-status-success-text',
                      )}
                      label="🎫 Voucher"
                    />
                  )}

                  <span className={cn('text-[10px]', isSelectedTab ? 'text-dust-taupe' : 'text-muted')}>
                    {Math.round(strategy.confidence * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Draft Text Preview or Editor */}
        <div className="space-y-1">
          {isEditing && draftStatus === 'pending' && !isOutdated ? (
            <textarea
              value={currentText}
              onChange={(event) => handleTextChange(event.target.value)}
              rows={3}
              className="block w-full resize-y rounded-xl border border-hairline bg-surface-card p-2.5 text-xs leading-5 text-foreground outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10"
              aria-label="Edit AI response"
            />
          ) : (
            <div
              className={cn(
                'custom-scrollbar max-h-32 overflow-y-auto rounded-xl border p-2.5 text-xs leading-5',
                draftStatus === 'applied' && activeStrategy.id === selectedStrategyCode
                  ? 'border-status-success/40 bg-status-success/5 text-foreground'
                  : 'border-hairline bg-surface-lifted text-foreground',
              )}
            >
              <p className="whitespace-pre-wrap">{currentText}</p>
            </div>
          )}
        </div>

        {/* Grounding & Evidence Annotations (expanded by default in sidebar) */}
        <GroundingAnnotation
          groundedFacts={activeStrategy.groundedFactsUsed}
          ungroundedClaims={activeStrategy.ungroundedClaims}
          isValid={activeGrounding.isValid}
          groundingPrecision={activeGrounding.groundingPrecision}
          violations={activeGrounding.violations}
          defaultOpen
        />

        {/* Error message */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => void handleApprove()}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Escalate or Invalid Notice */}
        {draftStatus === 'pending' && !isOutdated && !canApprove && (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/8 p-2 text-xs leading-5 text-status-warning-text">
            {activeStrategy.suggestedAction === 'escalate_to_human'
              ? '⚠️ Chiến lược này có rủi ro cao, yêu cầu nhân viên xử lý thủ công.'
              : '⚠️ Draft này không thể duyệt do chưa đáp ứng yêu cầu grounding/an toàn.'}
          </div>
        )}

        {/* Reject Dialog Inline */}
        {showRejectModal && (
          <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/8 p-3 text-xs space-y-2">
            <h4 className="font-semibold text-semantic-error">
              Từ chối AI Draft — Chọn lý do:
            </h4>
            <select
              value={selectedRejectReason}
              onChange={(e) => setSelectedRejectReason(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-background p-1.5 text-xs text-foreground"
            >
              {REJECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowRejectModal(false)}
                disabled={isRejecting}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => void handleRejectConfirm()}
                disabled={isRejecting}
                isLoading={isRejecting}
              >
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        )}

        {/* Actions bar for pending drafts */}
        {draftStatus === 'pending' && !isOutdated && !showRejectModal && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={onDismiss}
              disabled={isSaving}
              title="Đóng panel tạm thời"
            >
              Đóng
            </Button>
            {draftId && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowRejectModal(true)}
                disabled={isSaving}
                className="text-semantic-error hover:bg-semantic-error/10"
                title="Từ chối draft này và lưu lý do vào database"
              >
                Từ chối draft
              </Button>
            )}
            <Button
              variant="outline"
              size="xs"
              onClick={toggleEditing}
              disabled={isSaving}
              title={isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa trước khi duyệt'}
            >
              {isEditing ? 'Hủy sửa' : 'Sửa văn bản'}
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={() => void handleApprove()}
              disabled={isSaving || !canApprove}
              isLoading={isSaving}
              title="Duyệt và lưu tin nhắn nội bộ"
            >
              {isEditing ? 'Duyệt bản chỉnh sửa' : 'Duyệt & Lưu nội bộ'}
            </Button>
          </div>
        )}

        {/* Summary audit for applied/rejected drafts */}
        {draftStatus === 'applied' && (
          <div className="rounded-xl border border-status-success/20 bg-status-success/10 p-2 text-center text-xs text-status-success-text">
            ✓ Draft đã được duyệt và lưu vào hội thoại nội bộ.
          </div>
        )}
        {draftStatus === 'rejected' && isFullDraft && (
          <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/10 p-2 text-center text-xs text-semantic-error">
            ✕ Draft đã bị từ chối: <strong>{draft.rejectionReason ?? 'Manual review'}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
