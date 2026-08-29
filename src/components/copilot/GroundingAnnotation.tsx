'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

type GroundingAnnotationProps = {
  readonly groundedFacts: readonly string[];
  readonly ungroundedClaims: readonly string[];
  readonly isValid: boolean;
  readonly groundingPrecision: number;
  readonly violations: readonly {
    readonly type: string;
    readonly description: string;
    readonly severity: 'low' | 'medium' | 'high';
  }[];
};

const severityClasses: Record<'low' | 'medium' | 'high', string> = {
  low: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
  medium: 'border-status-warning/30 bg-status-warning/12 text-status-warning-text',
  high: 'border-status-warning/35 bg-status-warning/15 text-status-warning-text',
};

export function GroundingAnnotation({
  groundedFacts,
  ungroundedClaims,
  isValid,
  groundingPrecision,
  violations,
}: GroundingAnnotationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const precision = Math.round(groundingPrecision * 100);
  const hasDetails = groundedFacts.length > 0 || ungroundedClaims.length > 0 || violations.length > 0;

  return (
    <section className="rounded-xl border border-hairline bg-surface-lifted p-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-tight',
              isValid
                ? 'border-status-success/25 bg-status-success/10 text-status-success-text'
                : 'border-status-warning/30 bg-status-warning/12 text-status-warning-text',
            )}
          >
            <span className={cn('size-1.5 rounded-full', isValid ? 'bg-status-success' : 'bg-status-warning')} />
            {isValid ? 'Grounded & Validated' : 'Needs Review'} · {precision}%
          </span>
          <span className="text-[11px] text-muted">
            {groundedFacts.length} cited {ungroundedClaims.length > 0 && `· ${ungroundedClaims.length} ungrounded`}
          </span>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted hover:bg-foreground/6 hover:text-foreground transition cursor-pointer"
          >
            {isOpen ? 'Hide facts ▲' : 'Show facts ▼'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-2 space-y-2 border-t border-hairline pt-2 animate-in fade-in-0 duration-150">
          {groundedFacts.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-status-success-text">Grounded Facts</p>
              <ul className="space-y-1">
                {groundedFacts.map((fact, index) => (
                  <li key={`${fact}-${index}`} className="flex items-start gap-1.5 text-[11px] leading-4 text-foreground">
                    <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-status-success" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ungroundedClaims.length > 0 && (
            <div className="rounded-lg border border-status-warning/25 bg-status-warning/8 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-status-warning">Unsupported Claims</p>
              <ul className="mt-1 space-y-1">
                {ungroundedClaims.map((claim, index) => (
                  <li key={`${claim}-${index}`} className="text-[11px] leading-4 text-status-warning-text">• {claim}</li>
                ))}
              </ul>
            </div>
          )}

          {violations.length > 0 && (
            <ul className="space-y-1.5" aria-label="Grounding violations">
              {violations.map((violation, index) => (
                <li key={`${violation.type}-${index}`} className={cn('rounded-lg border p-2 text-[11px] leading-4', severityClasses[violation.severity])}>
                  <span className="font-semibold capitalize">{violation.severity}: </span>{violation.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
