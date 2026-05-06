interface IncidentProofCardProps {
  title?: string;
  before: string;
  after: string;
  resolvedIn?: string;
  note?: string;
}

export function IncidentProofCard({
  title = "Incident resolved",
  before,
  after,
  resolvedIn,
  note = "Based on production traces",
}: IncidentProofCardProps) {
  return (
    <div className="my-[24px] rounded-xl border border-border bg-surface p-[20px]">
      <div className="text-xs text-textMuted">{title}</div>
      <div className="flex items-center gap-[12px] mt-[12px]">
        <span className="text-xl font-semibold text-error">{before}</span>
        <span className="text-textMuted text-sm">→</span>
        <span className="text-xl font-semibold text-success">{after} ✓</span>
      </div>
      <div className="text-xs text-textMuted mt-[8px]">
        {resolvedIn ? `Resolved in ${resolvedIn} · ` : ""}{note}
      </div>
    </div>
  );
}
