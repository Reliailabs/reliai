import Link from "next/link";

import { SystemLayoutShell } from "./_components/system-layout-shell";
import { getSystemPlatformSurfaceData } from "@/lib/system-platform-data";
import { getSystemPipelineSurfaceData } from "@/lib/system-pipeline-data";
import { getSystemExtensionsSurfaceData } from "@/lib/system-extensions-data";

function statusTone(status: "healthy" | "warning" | "unavailable") {
  if (status === "healthy") return "bg-success/10 text-success border-success/40";
  if (status === "warning") return "bg-warning/10 text-warning border-warning/40";
  return "bg-muted text-muted-foreground border-border";
}

export default async function SystemPage() {
  const [{ metrics: platform, sourceErrors: platformErrors }, { pipeline, sourceErrors: pipelineErrors }, { items: extensions, sourceErrors: extensionErrors }] =
    await Promise.all([
      getSystemPlatformSurfaceData(),
      getSystemPipelineSurfaceData(),
      getSystemExtensionsSurfaceData(),
    ]);

  const platformStatus: "healthy" | "warning" | "unavailable" =
    !platform || platformErrors.length > 0
      ? "unavailable"
      : platform.customer_overload_risk === "critical" || platform.customer_overload_risk === "high"
        ? "warning"
        : "healthy";
  const pipelineStatus: "healthy" | "warning" | "unavailable" =
    !pipeline || pipelineErrors.length > 0
      ? "unavailable"
      : pipeline.consumers.some((consumer) => consumer.health === "degraded" || consumer.health === "stalled")
        ? "warning"
        : "healthy";
  const extensionsStatus: "healthy" | "warning" | "unavailable" =
    extensionErrors.length > 0
      ? "unavailable"
      : extensions.some((item) => item.health === "degraded")
        ? "warning"
        : "healthy";

  return (
    <SystemLayoutShell
      title="System"
      description="System command center for platform health, pipeline telemetry, extension runtime, and upcoming intelligence surfaces."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/pulse/system/platform" className="rounded-2xl border border-border bg-card p-5 hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Platform health</p>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(platformStatus)}`}>
              {platformStatus}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {platform
              ? `Ingest ${platform.trace_ingest_rate.toFixed(2)}/min · Failure ${(platform.processor_failure_rate * 100).toFixed(2)}%`
              : "Platform metrics unavailable"}
          </p>
        </Link>
        <Link href="/pulse/system/pipeline" className="rounded-2xl border border-border bg-card p-5 hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Pipeline status</p>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(pipelineStatus)}`}>
              {pipelineStatus}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pipeline
              ? `${pipeline.consumers.length} consumers · ${pipeline.recent_events_published} recent events`
              : "Pipeline telemetry unavailable"}
          </p>
        </Link>
        <Link href="/pulse/system/extensions" className="rounded-2xl border border-border bg-card p-5 hover:bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Extensions status</p>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(extensionsStatus)}`}>
              {extensionsStatus}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {extensions.length > 0
              ? `${extensions.length} processors · ${extensions.filter((item) => item.health === "degraded").length} degraded`
              : "No extension telemetry yet"}
          </p>
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">Customers & Growth</p>
          <p className="mt-1 text-xs text-muted-foreground">Read-only customer and growth telemetry surface.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/pulse/system/customers" className="rounded-full border border-border px-3 py-1 hover:bg-muted/30">Customers</Link>
            <Link href="/pulse/system/growth" className="rounded-full border border-border px-3 py-1 hover:bg-muted/30">Growth</Link>
            <Link href="/pulse/system/expansion" className="rounded-full border border-border px-3 py-1 hover:bg-muted/30">Expansion</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">Reliability Intelligence</p>
          <p className="mt-1 text-xs text-muted-foreground">Read-only reliability pattern and intelligence telemetry surface.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/pulse/system/reliability-patterns" className="rounded-full border border-border px-3 py-1 hover:bg-muted/30">Reliability</Link>
            <Link href="/pulse/system/intelligence" className="rounded-full border border-border px-3 py-1 hover:bg-muted/30">Intelligence</Link>
          </div>
        </div>
      </section>
    </SystemLayoutShell>
  );
}
