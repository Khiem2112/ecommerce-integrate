'use client';

import { useState } from 'react';
import { Badge, Button } from '@/components/atoms';

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
  readonly defaultOpen?: boolean;
};

const severityBadgeVariants: Record<'low' | 'medium' | 'high', 'warning' | 'amber' | 'rose'> = {
  low: 'warning',
  medium: 'amber',
  high: 'rose',
};

export function GroundingAnnotation({
  groundedFacts,
  ungroundedClaims,
  isValid,
  groundingPrecision,
  violations,
  defaultOpen = false,
}: GroundingAnnotationProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const precision = Math.round(groundingPrecision * 100);
  const hasDetails = groundedFacts.length > 0 || ungroundedClaims.length > 0 || violations.length > 0;
  const highSeverityViolations = violations.filter((v) => v.severity === 'high');
  const otherViolations = violations.filter((v) => v.severity !== 'high');

  return (
    <section className="rounded-xl border border-hairline bg-surface-lifted p-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={isValid ? 'success' : 'warning'}
            size="xs"
            useDot
            label={`${isValid ? 'Grounded & Validated' : 'Needs Review'} · ${precision}%`}
          />
          <span className="text-[11px] text-muted">
            {groundedFacts.length} cited {ungroundedClaims.length > 0 && `· ${ungroundedClaims.length} ungrounded`}
          </span>
        </div>

        {hasDetails && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsOpen((prev) => !prev)}
            className="h-6 px-2 text-[10px] font-semibold text-muted hover:text-foreground"
          >
            {isOpen ? 'Hide facts ▲' : 'Show facts ▼'}
          </Button>
        )}
      </div>

      {/* High-severity violations always visible */}
      {highSeverityViolations.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-semantic-error/20 pt-2" aria-label="Critical violations">
          {highSeverityViolations.map((violation, index) => (
            <li
              key={`high-${violation.type}-${index}`}
              className="flex items-start gap-2 rounded-lg border border-semantic-error/25 bg-semantic-error/8 p-2 text-[11px] leading-4 text-foreground"
            >
              <Badge
                variant="rose"
                size="xs"
                label="high"
              />
              <span>{violation.description}</span>
            </li>
          ))}
        </ul>
      )}

      {isOpen && (
        <div className="mt-2 space-y-2 border-t border-hairline pt-2 animate-in fade-in-0 duration-150">
          {groundedFacts.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-status-success-text">
                Grounded Facts
              </p>
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
              <p className="text-[10px] font-bold uppercase tracking-wide text-status-warning">
                Unsupported Claims
              </p>
              <ul className="mt-1 space-y-1">
                {ungroundedClaims.map((claim, index) => (
                  <li key={`${claim}-${index}`} className="text-[11px] leading-4 text-status-warning-text">
                    • {claim}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {otherViolations.length > 0 && (
            <ul className="space-y-1.5" aria-label="Grounding violations">
              {otherViolations.map((violation, index) => (
                <li
                  key={`${violation.type}-${index}`}
                  className="flex items-start gap-2 rounded-lg border border-hairline bg-white p-2 text-[11px] leading-4 text-foreground shadow-xs"
                >
                  <Badge
                    variant={severityBadgeVariants[violation.severity]}
                    size="xs"
                    label={violation.severity}
                  />
                  <span>{violation.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
