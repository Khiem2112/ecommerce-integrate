type EvidenceFactListProps = {
  readonly facts: readonly {
    readonly id: number;
    readonly fact: string;
    readonly evidence: string;
    readonly confidence: number;
    readonly lastObserved: string;
  }[];
  readonly highConfidenceFactCount: number;
};

export function EvidenceFactList({ facts, highConfidenceFactCount }: EvidenceFactListProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence facts</h3>
        <span className="text-[10px] text-emerald-300">{highConfidenceFactCount} high confidence</span>
      </div>
      {facts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">No evidence-backed facts are available.</div>
      ) : (
        <ul className="space-y-2">
          {facts.map((fact) => {
            const percentage = Math.round(fact.confidence * 100);
            return (
              <li key={fact.id} className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
                <p className="text-xs font-medium leading-5 text-slate-200">{fact.fact}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{fact.evidence}</p>
                <div className="mt-2 flex items-center gap-2">
                  <progress
                  value={fact.confidence}
                  max={1}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800 accent-emerald-400"
                  aria-label={`${percentage}% confidence`}
                />
                  <span className="text-[10px] font-semibold text-emerald-300">{percentage}%</span>
                </div>
                <time className="mt-1.5 block text-[10px] text-slate-600" dateTime={fact.lastObserved}>Observed {new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(fact.lastObserved))}</time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
