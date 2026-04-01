export function AiTrustCard() {
  return (
    <div className="my-[24px] rounded-xl border border-border bg-surface p-[20px]">
      <div className="text-sm font-semibold text-textPrimary mb-[12px]">AI vs system signals</div>
      <div className="space-y-[8px]">
        <div className="flex items-start gap-[8px] text-sm">
          <span className="mt-[2px] h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
          <div>
            <span className="text-textPrimary font-medium">Deterministic</span>
            <span className="text-textSecondary ml-[6px]">— root cause, metrics, traces, patterns</span>
          </div>
        </div>
        <div className="flex items-start gap-[8px] text-sm">
          <span className="mt-[2px] h-[6px] w-[6px] shrink-0 rounded-full bg-info" />
          <div>
            <span className="text-textPrimary font-medium">AI-assisted</span>
            <span className="text-textSecondary ml-[6px]">— summaries, explanations, ticket drafts</span>
          </div>
        </div>
      </div>
      <p className="mt-[12px] text-xs text-textMuted">
        AI never decides root cause. It only explains what the system already determined.
      </p>
    </div>
  );
}
