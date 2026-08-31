'use client';

import { useState } from 'react';
import { saveAiResponseAction } from '@/actions/conversationActions';
import { Badge, type BadgeVariant } from '@/components/atoms';
import { CopilotActions, GroundingAnnotation } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import { cn } from '@/lib/cn';
import type { MultiDraftRagDraft, SuggestedAction } from '@/types';

type AiResponsePreviewProps = {
  readonly draft: MultiDraftRagDraft;
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

export function AiResponsePreview({
  draft,
  conversationId,
  onDismiss,
  onSaved,
}: AiResponsePreviewProps) {
  const strategies = draft.response?.strategies ?? [];
  const defaultStrategyId = draft.response?.recommendedStrategyId ?? strategies[0]?.id ?? '';

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(defaultStrategyId);
  const [isEditing, setIsEditing] = useState(false);
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStrategy =
    strategies.find((s) => s.id === selectedStrategyId) ?? strategies[0];

  const currentText =
    customTexts[activeStrategy?.id ?? ''] ?? activeStrategy?.draftText ?? '';

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
    isCurrentValid &&
    activeStrategy?.suggestedAction !== 'escalate_to_human' &&
    currentText.trim().length > 0;

  function handleSelectStrategy(strategyId: string) {
    setSelectedStrategyId(strategyId);
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
    if (!activeStrategy || !canApprove || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await saveAiResponseAction({
        conversationId,
        text: currentText.trim(),
        groundedFactsUsed: activeStrategy.groundedFactsUsed,
        ungroundedClaims: activeStrategy.ungroundedClaims,
        confidence: activeStrategy.confidence,
        suggestedAction: activeStrategy.suggestedAction,
      });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the AI response.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeStrategy) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      {/* Compact Header */}
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
            {draft.response?.providerUsed && (
              <Badge
                variant="secondary"
                size="xs"
                label={draft.response.providerUsed}
              />
            )}
          </div>
        </div>

        {/* Global/Active suggested action pill */}
        <Badge
          variant={actionVariants[activeStrategy.suggestedAction]}
          size="xs"
          label={actionLabels[activeStrategy.suggestedAction]}
        />
      </header>

      <div className="space-y-2.5 px-0.5 pt-2">
        {/* Recommendation Rationale Callout */}
        {draft.response?.recommendationReason && (
          <div className="flex items-center gap-2 rounded-xl border border-status-warning/20 bg-status-warning/5 px-2.5 py-1.5 text-xs text-foreground">
            <span className="text-xs font-bold text-status-warning">💡</span>
            <div className="truncate">
              <span className="font-semibold text-status-warning">Recommendation: </span>
              <span className="text-foreground">{draft.response.recommendationReason}</span>
            </div>
          </div>
        )}

        {/* Horizontal Strategy Segmented Pill Tabs */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Strategy ({strategies.length} options)
            </span>
            <span className="text-[10px] text-muted">
              {activeStrategy.strategy?.tone ? `Tone: ${activeStrategy.strategy.tone}` : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Draft strategy options">
            {strategies.map((strategy) => {
              const isSelected = strategy.id === selectedStrategyId;
              const isBest =
                strategy.id === draft.response?.recommendedStrategyId || strategy.isBestMatch;
              const hasVoucher = strategy.proposedCompensation?.kind === 'voucher';

              return (
                <button
                  key={strategy.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectStrategy(strategy.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition duration-150 cursor-pointer border',
                    isSelected
                      ? 'border-foreground bg-foreground text-background shadow-xs'
                      : 'border-hairline bg-background text-foreground hover:border-foreground/30 hover:bg-hairline',
                  )}
                >
                  <span>{strategy.strategy?.name ?? `Rank #${strategy.rank}`}</span>
                  {isBest && (
                    <Badge
                      variant={isSelected ? 'warning' : 'warning'}
                      size="xs"
                      className={cn(
                        'px-1.5 py-0 text-[9px] font-bold border-0',
                        isSelected ? 'bg-status-warning text-white' : 'bg-status-warning/15 text-status-warning',
                      )}
                      label="★ Best"
                    />
                  )}
                  {hasVoucher && (
                    <Badge
                      variant="success"
                      size="xs"
                      className={cn(
                        'px-1.5 py-0 text-[9px] font-bold border-0',
                        isSelected ? 'bg-emerald-500 text-white' : 'bg-status-success/15 text-status-success-text',
                      )}
                      label="🎫 Voucher"
                    />
                  )}
                  <span className={cn('text-[10px]', isSelected ? 'text-dust-taupe' : 'text-muted')}>
                    {Math.round(strategy.confidence * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Draft Text Preview or Editor */}
        <div className="space-y-1">
          {isEditing ? (
            <textarea
              value={currentText}
              onChange={(event) => handleTextChange(event.target.value)}
              rows={3}
              className="block w-full resize-y rounded-xl border border-hairline bg-white p-2.5 text-xs leading-5 text-foreground outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10"
              aria-label="Edit AI response"
            />
          ) : (
            <div className="custom-scrollbar max-h-32 overflow-y-auto rounded-xl border border-hairline bg-surface-lifted p-2.5 text-xs leading-5 text-foreground">
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
        {!canApprove && (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/8 p-2 text-xs leading-5 text-status-warning-text">
            {activeStrategy.suggestedAction === 'escalate_to_human'
              ? '⚠️ This strategy requires human handling due to risk level.'
              : '⚠️ This draft cannot be sent until its grounding issues are resolved.'}
          </div>
        )}

        {/* Actions */}
        <CopilotActions
          isSaving={isSaving}
          isEditing={isEditing}
          canApprove={canApprove}
          onApprove={() => void handleApprove()}
          onStartEditing={toggleEditing}
          onReject={onDismiss}
        />
      </div>
    </div>
  );
}
