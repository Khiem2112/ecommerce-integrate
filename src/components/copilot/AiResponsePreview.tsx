'use client';

import { useState } from 'react';
import { saveAiResponseAction } from '@/actions/conversationActions';
import { CopilotActions } from '@/components/copilot/CopilotActions';
import { GroundingAnnotation } from '@/components/copilot/GroundingAnnotation';
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

const actionClasses: Record<SuggestedAction, string> = {
  auto_reply: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  await_approval: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  escalate_to_human: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
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
    <article className="overflow-hidden rounded-xl border border-violet-500/30 bg-slate-900 shadow-2xl shadow-violet-950/40">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-gradient-to-r from-violet-950/60 via-slate-900 to-indigo-950/40 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-md shadow-violet-500/20"
            aria-hidden="true"
          >
            ✦
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-200">
                AI Multi-Draft Co-Pilot
              </h3>
              {draft.response?.providerUsed && (
                <span className="rounded bg-violet-900/50 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                  {draft.response.providerUsed}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Compare 2–3 grounded strategy drafts and select the optimal response.
            </p>
          </div>
        </div>

        {/* Global/Active suggested action pill */}
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide',
            actionClasses[activeStrategy.suggestedAction],
          )}
        >
          {actionLabels[activeStrategy.suggestedAction]}
        </span>
      </header>

      <div className="space-y-4 p-4 md:p-5">
        {/* Recommendation Rationale Callout */}
        {draft.response?.recommendationReason && (
          <div className="flex items-start gap-2.5 rounded-lg border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-100">
            <span className="text-sm font-bold text-violet-400">💡</span>
            <div>
              <span className="font-semibold text-violet-300">
                AI Recommendation Rationale:{' '}
              </span>
              <span>{draft.response.recommendationReason}</span>
            </div>
          </div>
        )}

        {/* Strategy Selector Tabs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Select Response Strategy ({strategies.length} options)
            </label>
            <span className="text-[10px] text-slate-500">
              Click to compare approach & tone
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {strategies.map((strategy) => {
              const isSelected = strategy.id === selectedStrategyId;
              const isBest =
                strategy.id === draft.response?.recommendedStrategyId || strategy.isBestMatch;
              const hasVoucher = strategy.proposedCompensation?.kind === 'voucher';

              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => handleSelectStrategy(strategy.id)}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all',
                    isSelected
                      ? 'border-violet-500 bg-violet-500/15 shadow-md shadow-violet-950/40 ring-2 ring-violet-500/30'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/50',
                  )}
                >
                  <div className="mb-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Rank #{strategy.rank}
                      </span>
                      {isBest && (
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          ★ Recommended
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-semibold text-slate-100 group-hover:text-white">
                      {strategy.strategy?.name ?? strategy.id}
                    </div>
                    {strategy.strategy?.tone && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Tone: {strategy.strategy.tone}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-800/80">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-medium',
                        actionClasses[strategy.suggestedAction],
                      )}
                    >
                      {strategy.suggestedAction === 'auto_reply'
                        ? 'Auto-Reply'
                        : strategy.suggestedAction === 'await_approval'
                          ? 'Approval'
                          : 'Escalate'}
                    </span>
                    {hasVoucher && (
                      <span className="rounded bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                        🎫 {strategy.proposedCompensation.amountVnd?.toLocaleString()}đ
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Draft Text Preview or Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Draft Message: {activeStrategy.strategy?.name ?? activeStrategy.id}
            </span>
            <span className="text-[11px] text-slate-400">
              Confidence: {Math.round(activeStrategy.confidence * 100)}%
            </span>
          </div>

          {isEditing ? (
            <textarea
              value={currentText}
              onChange={(event) => handleTextChange(event.target.value)}
              rows={5}
              className="block w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm leading-6 text-slate-100 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              aria-label="Edit AI response"
            />
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3.5 text-sm leading-6 text-slate-100">
              <p className="whitespace-pre-wrap">{currentText}</p>
            </div>
          )}
        </div>

        {/* Grounding & Evidence Annotations */}
        <GroundingAnnotation
          groundedFacts={activeStrategy.groundedFactsUsed}
          ungroundedClaims={activeStrategy.ungroundedClaims}
          isValid={activeGrounding.isValid}
          groundingPrecision={activeGrounding.groundingPrecision}
          violations={activeGrounding.violations}
        />

        {/* Error message */}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-rose-400/25 bg-rose-400/10 p-2.5 text-xs text-rose-200"
          >
            {error}
          </p>
        )}

        {/* Escalate or Invalid Notice */}
        {!canApprove && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs leading-5 text-amber-200">
            {activeStrategy.suggestedAction === 'escalate_to_human'
              ? '⚠️ This strategy requires human handling due to risk level or customer complaint.'
              : '⚠️ This draft cannot be sent until its grounding issues or empty content are resolved.'}
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
    </article>
  );
}
