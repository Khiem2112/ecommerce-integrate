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
  low: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
  medium: 'border-orange-400/25 bg-orange-400/10 text-orange-100',
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
};

export function GroundingAnnotation({
  groundedFacts,
  ungroundedClaims,
  isValid,
  groundingPrecision,
  violations,
}: GroundingAnnotationProps) {
  const precision = Math.round(groundingPrecision * 100);

  return (
    <section className="space-y-3 border-t border-slate-700/80 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-300">Grounding check</h4>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            isValid
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/25 bg-rose-400/10 text-rose-200',
          )}
        >
          {isValid ? 'Validated' : 'Needs review'} · {precision}% grounded
        </span>
      </div>

      {groundedFacts.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Evidence cited</p>
          <ul className="space-y-1.5">
            {groundedFacts.map((fact, index) => (
              <li key={`${fact}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-300">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ungroundedClaims.length > 0 && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Unsupported claims</p>
          <ul className="mt-1.5 space-y-1">
            {ungroundedClaims.map((claim, index) => <li key={`${claim}-${index}`} className="text-xs leading-5 text-amber-100">• {claim}</li>)}
          </ul>
        </div>
      )}

      {violations.length > 0 && (
        <ul className="space-y-2" aria-label="Grounding violations">
          {violations.map((violation, index) => (
            <li key={`${violation.type}-${index}`} className={cn('rounded-lg border p-2.5 text-xs leading-5', severityClasses[violation.severity])}>
              <span className="font-semibold capitalize">{violation.severity}: </span>{violation.description}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
