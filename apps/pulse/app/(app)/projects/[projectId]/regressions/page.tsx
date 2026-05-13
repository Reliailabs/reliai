import Link from "next/link";

import { requireOperatorSession } from "@/lib/auth";
import { getRegressionsSurfaceData } from "@/lib/regressions-data";

type ProjectRegressionsPageProps = {
  params: Promise<{ projectId: string }>;
};

function time(v: string | null): string {
  if (!v) return "unknown";
  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function ProjectRegressionsPage({ params }: ProjectRegressionsPageProps) {
  const { projectId } = await params;
  await requireOperatorSession();
  const data = await getRegressionsSurfaceData(projectId);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Project Regressions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only project regressions view. Use Operations for full workflow context.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back to project
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {data.items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No regressions found for this project.
          </div>
        ) : (
          data.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">{item.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.id} • {item.status} • {time(item.detectedAt)}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/regressions/${item.id}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Open legacy detail
                </Link>
                <Link
                  href={`/operations/regressions/${item.id}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Open in Operations
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
