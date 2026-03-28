"use client";

import { CheckCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function AnimatedCounter({
  from,
  to,
  duration = 600,
  suffix = "%",
}: {
  from: number;
  to: number;
  duration?: number;
  suffix?: string;
}) {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setValue(Math.round(from + (to - from) * eased));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [from, to, duration]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

export function HeroAnnotatedVisual() {
  return (
    <div className="flex flex-col gap-4">
      {/* Dark UI mock panel */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">

        {/* A. Incident header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Incident</p>
            <p className="mt-0.5 text-sm font-semibold text-white">Hallucination spike detected</p>
          </div>
          <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">
            CRITICAL
          </span>
        </div>

        {/* B. 3-column metric row */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Current</p>
            <p className="mt-1 text-2xl font-bold text-red-400">19%</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Baseline</p>
            <p className="mt-1 text-2xl font-bold text-zinc-300">4%</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">After Fix</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              <AnimatedCounter from={19} to={5} duration={600} />
              {" ✓"}
            </p>
          </div>
        </div>

        {/* C. Root cause */}
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
            Root Cause — 71% confidence
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Prompt v42 deployed 82 minutes before incident
          </p>
        </div>

        {/* D. Recommended fix */}
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Recommended Fix
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-200">Revert to v41</p>
        </div>

        {/* E. Resolution impact strip — the money shot */}
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-sm font-semibold text-green-900">Fix Verified</p>
          </div>
          <p className="mt-1 text-sm text-green-800">
            Failure rate reduced from 19% → 5%
          </p>
          <p className="mt-0.5 text-xs text-green-700">After reverting prompt v42</p>
          <p className="mt-0.5 text-xs text-green-700">Resolved in 6 minutes</p>
          <p className="mt-2 text-[10px] font-medium text-green-600">
            ✓ Based on real production traces
          </p>
        </div>

      </div>

      {/* 3 callout cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Trigger — neutral */}
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-steel">Trigger</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Incident opened automatically when behavior deviated
          </p>
        </div>
        {/* Root Cause — amber */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Root Cause</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Prompt rollout identified as primary driver (71%)
          </p>
        </div>
        {/* Impact — green, bold metric */}
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green-700">Impact</p>
          <p className="mt-1 text-sm font-bold leading-5 text-green-900">19% → 5%</p>
          <p className="text-xs text-green-700">Failure rate reduced</p>
        </div>
      </div>
    </div>
  );
}
