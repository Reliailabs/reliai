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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Incident <span className="ml-2 text-zinc-700">INC-1423</span>
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">Hallucination spike detected</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">AI Support Copilot · Production · Mar 11, 10:22 AM</p>
          </div>
          <span className="shrink-0 rounded-full bg-red-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">
            CRITICAL
          </span>
        </div>

        {/* B. Metric row — Before → After Fix (dominant), Baseline as context */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
          {/* Before — large, red, alarming */}
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Before</p>
            <p className="mt-1 text-2xl font-bold text-red-400">19%</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">failure rate</p>
          </div>
          {/* Baseline — smaller, contextual */}
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Baseline</p>
            <p className="mt-1 text-xl font-bold text-zinc-500">4%</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">healthy</p>
          </div>
          {/* After Fix — dominant, green, the proof */}
          <div className="rounded-r-xl bg-green-950/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-500">After Fix</p>
            <p className="mt-1 text-4xl font-bold leading-none text-green-400">
              <AnimatedCounter from={19} to={5} duration={600} />
              <span className="ml-1 text-2xl">✓</span>
            </p>
            <p className="mt-0.5 text-[10px] text-green-600">near baseline</p>
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

      {/* Single proof strip — replaces 3 cards */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-[11px] shadow-sm">
        <span className="text-zinc-500">⚡ Incident opened automatically</span>
        <span className="text-zinc-300 hidden sm:inline">·</span>
        <span className="text-zinc-500">🔍 Prompt v42 identified at 71% confidence</span>
        <span className="text-zinc-300 hidden sm:inline">·</span>
        <span className="font-semibold text-green-700">✅ 19% → 5% — resolved in 6 minutes</span>
      </div>
    </div>
  );
}
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
=======
import Image from "next/image";

const annotations = [
  { label: "Incident opens", body: "Refusal spike detected automatically" },
  { label: "Root cause", body: "Prompt update linked as primary cause" },
  { label: "Resolution proof", body: "Metric delta after fix applied" },
] as const;
>>>>>>> origin/main

export function HeroAnnotatedVisual() {
  return (
    <div className="flex flex-col gap-4">
<<<<<<< HEAD
      {/* Dark UI mock panel */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">

        {/* A. Incident header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Incident <span className="ml-2 text-zinc-700">INC-1423</span>
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">Hallucination spike detected</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">AI Support Copilot · Production · Mar 11, 10:22 AM</p>
          </div>
          <span className="shrink-0 rounded-full bg-red-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">
            CRITICAL
          </span>
        </div>

        {/* B. Metric row — Before → After Fix (dominant), Baseline as context */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
          {/* Before — large, red, alarming */}
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Before</p>
            <p className="mt-1 text-2xl font-bold text-red-400">19%</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">failure rate</p>
          </div>
          {/* Baseline — smaller, contextual */}
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Baseline</p>
            <p className="mt-1 text-xl font-bold text-zinc-500">4%</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">healthy</p>
          </div>
          {/* After Fix — dominant, green, the proof */}
          <div className="rounded-r-xl bg-green-950/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-500">After Fix</p>
            <p className="mt-1 text-4xl font-bold leading-none text-green-400">
              <AnimatedCounter from={19} to={5} duration={600} />
              <span className="ml-1 text-2xl">✓</span>
            </p>
            <p className="mt-0.5 text-[10px] text-green-600">near baseline</p>
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

      {/* Single proof strip — replaces 3 cards */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-[11px] shadow-sm">
        <span className="text-zinc-500">⚡ Incident opened automatically</span>
        <span className="text-zinc-300 hidden sm:inline">·</span>
        <span className="text-zinc-500">🔍 Prompt v42 identified at 71% confidence</span>
        <span className="text-zinc-300 hidden sm:inline">·</span>
        <span className="font-semibold text-green-700">✅ 19% → 5% — resolved in 6 minutes</span>
=======
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] text-steel">
          app.reliai.dev/incidents/command
        </div>
        <div className="aspect-[16/10] overflow-hidden">
          <Image
            src="/screenshots/incident.png"
            alt="Incident command center showing root cause analysis"
            width={3200}
            height={2000}
            className="h-full w-full object-cover object-top"
            priority
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {annotations.map((a) => (
          <div
            key={a.label}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-steel">
              {a.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{a.body}</p>
          </div>
        ))}
>>>>>>> origin/main
      </div>
    </div>
  );
}
