import Link from "next/link";
import { notFound } from "next/navigation";

import { getRegressionsSurfaceData } from "@/lib/regressions-data";

function time(v: string | null): string {
  if (!v) return "unknown";
  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

type RegressionDetailPageProps = {
  params: Promise<{ regressionId: string }>;
};

export default async function RegressionDetailPage({ params }: RegressionDetailPageProps) {
  const { regressionId } = await params;
  const data = await getRegressionsSurfaceData();
  const item = data.items.find((row) => row.id === regressionId) ?? null;
  if (!item) notFound();

  return (
    <div className="mx-auto w-full max-w-[1000px] px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Regression — {item.id}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Legacy regression detail. Operations provides timeline/proposal/verification context.</p>
        </div>
        <Link href={`/operations/regressions/${item.id}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Open in Operations
        </Link>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">{item.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">{item.status} • detected {time(item.detectedAt)}</p>
      </div>
      <div className="mt-4">
        <Link href="/regressions" className="text-sm text-muted-foreground hover:text-foreground">
          Back to regressions
        </Link>
      </div>
    </div>
  );
}
