const steps = ["Detect", "Understand", "Fix", "Prove", "Share"];

export function WorkflowSteps() {
  return (
    <div className="my-[24px] flex items-center gap-[8px]">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-[8px]">
          <div className="rounded-lg border border-border bg-bg px-[12px] py-[6px]">
            <span className="text-sm font-medium text-textPrimary">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-textMuted text-xs">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
