import Link from "next/link";
import { ArrowLeft, BrainCircuit, ChevronRight, ShieldAlert, TriangleAlert, Waypoints } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getReliabilityPatterns } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

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
  if (value >= 0.5) return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (value >= 0.25) return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
}

export default async function ReliabilityPatternsPage() {
  await requireOperatorSession();
  const { items } = await getReliabilityPatterns().catch(() => ({ items: [] }));
  const highProbabilityCount = items.filter((item) => item.failure_probability >= 0.25).length;
  const totalSamples = items.reduce((sum, item) => sum + item.sample_count, 0);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.08),transparent_38%),radial-gradient(circle_at_top_right,rgba(8,145,178,0.14),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/system/growth" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to platform dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliability intelligence</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Cross-project failure patterns</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Internal pattern board mined from warehouse traces. These rows feed deployment risk, simulation risk
                adjustment, and guardrail recommendation logic across customer traffic.
              </p>
            </div>
            <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
              Operator-only intelligence layer
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <BrainCircuit className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Patterns</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{items.length}</p>
            <p className="mt-2 text-sm text-steel">Canonical reliability patterns currently available to internal engines.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Elevated</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{highProbabilityCount}</p>
            <p className="mt-2 text-sm text-steel">Patterns at or above 25% observed failure probability.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Waypoints className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Sample volume</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(totalSamples)}</p>
            <p className="mt-2 text-sm text-steel">Total trace observations contributing to the visible patterns.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Coverage</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">
              {new Set(items.map((item) => item.pattern_type)).size}
            </p>
            <p className="mt-2 text-sm text-steel">Pattern families mined from model, prompt, and retrieval signals.</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        {items.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10">
              <h2 className="text-xl font-semibold text-ink">No reliability patterns mined yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
                Run the reliability pattern mining worker after traces land in the warehouse to populate this internal
                intelligence surface.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-steel">
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
                  <tr key={item.id} className="border-t border-zinc-200 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium capitalize text-ink">{item.pattern_type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">
                        {item.prompt_pattern_hash ?? "no prompt hash"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-steel">{item.model_family ?? "unknown"}</td>
                    <td className="px-5 py-4 text-sm text-steel">{item.failure_type.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${probabilityTone(item.failure_probability)}`}>
                        {percent(item.failure_probability)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-ink">{compactNumber(item.sample_count)}</td>
                    <td className="px-5 py-4 text-sm text-steel">{new Date(item.last_seen_at).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`/api/v1/intelligence/patterns/${item.id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-steel"
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
