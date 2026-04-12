"use client";

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function getUsageState(used: number, limit: number) {
  if (limit === 0) return "enterprise";
  const percent = used / limit;
  if (percent >= 1) return "blocked";
  if (percent >= 0.9) return "critical";
  if (percent >= 0.7) return "warning";
  return "normal";
}

const stateColors: Record<string, string> = {
  normal: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  blocked: "bg-rose-600",
  enterprise: "bg-sky-500",
};

const stateMessages: Record<string, string> = {
  normal: "",
  warning: "You’re on track to exceed your plan.",
  critical: "You’re about to lose observability.",
  blocked: "Trace limit reached. Observability paused.",
  enterprise: "",
};

export function UsageMeter({
  used,
  limit,
  projected,
}: {
  used: number;
  limit: number;
  projected?: number;
}) {
  const state = getUsageState(used, limit);
  const percent = limit > 0 ? Math.min(used / limit, 1) : 0;
  const isOverLimit = limit > 0 && projected !== undefined && projected > limit;
  const showProjected = projected !== undefined && projected !== used;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300">Usage (This Month)</span>
        <span className="font-semibold text-zinc-100">
          {limit > 0 ? `${Math.round(percent * 100)}%` : "Unlimited"}
        </span>
      </div>

      {limit > 0 && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all duration-500 ease-out ${stateColors[state]}`}
            style={{ width: `${percent * 100}%` }}
          />
        </div>
      )}

      <div className="mt-2 text-xs text-zinc-400">
        {limit > 0
          ? `${formatNumber(used)} / ${formatNumber(limit)} traces`
          : `${formatNumber(used)} traces`}
      </div>

      {showProjected && (
        <div className="mt-2 text-xs text-zinc-500">
          Projected: {formatNumber(projected)} {isOverLimit ? "⚠" : ""}
        </div>
      )}

      {stateMessages[state] && (
        <div className="mt-3 text-sm text-zinc-200">{stateMessages[state]}</div>
      )}
    </div>
  );
}