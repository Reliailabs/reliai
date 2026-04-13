import { BrainCircuit, ChevronRight, ShieldAlert, TriangleAlert, Waypoints } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SubPageHeader } from "@/components/ui/sub-page-header";
import { getReliabilityPatterns } from "@/lib/api";

function percent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function probabilityTone(value: number) {
  if (value >= 0.5) return "bg-red-500/10 text-red-400 border-red-500/30";
  if (value >= 0.25) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-blue-500/10 text-blue-400 border-blue-500/30";
}

export default async function ReliabilityPatternsPage() {
  const { items } = await getReliabilityPatterns().catch(() => ({ items: [] }));
  const highProbabilityCount = items.filter((item) => item.failure_probability >= 0.25).length;
  const totalSamples = items.reduce((sum, item) => sum + item.sample_count, 0);

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="Reliability intelligence"
        title="Cross-project failure patterns"
        description="Internal pattern board mined from warehouse traces. These rows feed deployment risk, simulation risk adjustment, and guardrail recommendation logic across customer traffic."
        backHref="/system/growth"
        backLabel="Back to platform dashboard"
        right={
          <div className="rounded-full border border-zinc-800 bg-zinc-900/85 px-5 py-3 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur">
            Operator-only intelligence layer
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <BrainCircuit className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Patterns</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{items.length}</p>
          <p className="mt-2 text-sm text-zinc-400">Canonical reliability patterns currently available to internal engines.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <TriangleAlert className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Elevated</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{highProbabilityCount}</p>
          <p className="mt-2 text-sm text-zinc-400">Patterns at or above 25% observed failure probability.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Waypoints className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Sample volume</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{compactNumber(totalSamples)}</p>
          <p className="mt-2 text-sm text-zinc-400">Total trace observations contributing to the visible patterns.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Coverage</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">
            {new Set(items.map((item) => item.pattern_type)).size}
          </p>
          <p className="mt-2 text-sm text-zinc-400">Pattern families mined from model, prompt, and retrieval signals.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-6 py-10">
              <h2 className="text-xl font-semibold text-zinc-100">No reliability patterns mined yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Run the reliability pattern mining worker after traces land in the warehouse to populate this internal
                intelligence surface.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Pattern</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Failure type</th>
                  <th className="px-5 py-3 font-medium">Probability</th>
                  <th className="px-5 py-3 font-medium">Sample size</th>
                  <th className="px-5 py-3 font-medium">Last seen</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium capitalize text-zinc-100">{item.pattern_type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                        {item.prompt_pattern_hash ?? "no prompt hash"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400">{item.model_family ?? "unknown"}</td>
                    <td className="px-5 py-4 text-sm text-zinc-400">{item.failure_type.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${probabilityTone(item.failure_probability)}`}>
                        {percent(item.failure_probability)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">{compactNumber(item.sample_count)}</td>
                    <td className="px-5 py-4 text-sm text-zinc-400">{new Date(item.last_seen_at).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`/api/v1/intelligence/patterns/${item.id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100 hover:text-zinc-400"
                      >
                        API
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}