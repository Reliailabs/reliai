import Image from "next/image";

export function HeroAnnotatedVisual() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Trigger</p>
            <p className="mt-2 text-sm font-semibold text-ink">Incident detected automatically</p>
            <p className="mt-1 text-xs text-steel">Behavior deviates from baseline — no manual rules needed</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Impact</p>
            <p className="mt-2 text-sm font-semibold text-ink">Regression resolved</p>
            <p className="mt-1 text-xs text-steel">Failure rate reduced from 19% → 5% post-revert</p>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-steel">
            app.reliai.dev / incidents / command
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            <Image
              src="/screenshots/incident.png"
              alt="Incident command center showing root cause analysis for a hallucination spike"
              width={900}
              height={560}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Root cause</p>
          <p className="mt-2 text-sm font-semibold text-ink">Prompt update caused drift</p>
          <p className="mt-1 text-xs text-steel">Reliai links the regression to a specific version change</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-steel">Fix</p>
          <p className="mt-2 text-sm font-semibold text-ink">Revert or adjust prompt</p>
          <p className="mt-1 text-xs text-steel">Clear, actionable resolution — no manual log search</p>
        </div>
      </div>
    </div>
  );
}
