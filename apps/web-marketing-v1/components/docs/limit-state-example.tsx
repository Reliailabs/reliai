interface LimitStateExampleProps {
  message?: string;
  detail?: string;
}

export function LimitStateExample({
  message = "Sampling active — some traces are not stored",
  detail = "Dropping ~120 traces/min",
}: LimitStateExampleProps) {
  return (
    <div className="my-[24px] rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-[16px]">
      <div className="text-sm font-medium text-warning">{message}</div>
      {detail ? (
        <div className="mt-[4px] text-xs text-textMuted">{detail}</div>
      ) : null}
    </div>
  );
}
