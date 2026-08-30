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
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">Evidence facts</h3>
        <span className="text-[10px] font-bold text-status-success-text">{highConfidenceFactCount} high confidence</span>
      </div>
      {facts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-white p-3 text-center text-xs text-muted">No evidence-backed facts are available.</div>
      ) : (
        <ul className="space-y-1.5">
          {facts.map((fact) => {
            const percentage = Math.round(fact.confidence * 100);
            return (
              <li key={fact.id} className="rounded-2xl border border-hairline bg-white p-3 shadow-xs">
                <p className="text-xs font-semibold leading-4.5 text-foreground">{fact.fact}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted">{fact.evidence}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
                    <div
                      className="h-full rounded-full bg-status-success transition-all duration-200"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-status-success-text">{percentage}%</span>
                </div>
                <time className="mt-1 block text-[10px] text-muted" dateTime={fact.lastObserved}>Observed {new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(fact.lastObserved))}</time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
