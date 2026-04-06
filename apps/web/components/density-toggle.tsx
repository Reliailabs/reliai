"use client";

import { useEffect, useState } from "react";

const DENSITY_KEY = "reliai:density";

type DensityMode = "comfortable" | "compact";

export function DensityToggle() {
  const [mode, setMode] = useState<DensityMode>("comfortable");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DENSITY_KEY);
    const initial = stored === "compact" ? "compact" : "comfortable";
    setMode(initial);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DENSITY_KEY, mode);
    document.body.classList.toggle("density-compact", mode === "compact");
  }, [mode]);

  return (
    <div className="density-toggle flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-secondary">
      <span className="text-[10px] uppercase tracking-[0.2em] text-secondary">Density</span>
      <div className="flex rounded-md bg-surface p-0.5">
        <button
          type="button"
          onClick={() => setMode("comfortable")}
          className={`rounded px-2 py-1 text-[11px] font-medium transition ${
            mode === "comfortable" ? "bg-surfaceAlt text-primary" : "text-secondary"
          }`}
        >
          Comfortable
        </button>
        <button
          type="button"
          onClick={() => setMode("compact")}
          className={`rounded px-2 py-1 text-[11px] font-medium transition ${
            mode === "compact" ? "bg-surfaceAlt text-primary" : "text-secondary"
          }`}
        >
          Compact
        </button>
      </div>
    </div>
  );
}
