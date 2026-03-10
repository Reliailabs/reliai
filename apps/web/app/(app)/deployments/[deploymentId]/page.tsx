import Link from "next/link";
import { ArrowLeft, ArrowRight, GitCommitHorizontal, History, ShieldAlert } from "lucide-react";

import type { DeploymentDetailRead } from "@reliai/types";

import { Card } from "@/components/ui/card";
import { getDeploymentDetail } from "@/lib/api";

function renderMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No metadata recorded.";
  }
  return JSON.stringify(metadata, null, 2);
}

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ deploymentId: string }>;
}) {
  const { deploymentId } = await params;
  const detail: DeploymentDetailRead = await getDeploymentDetail(deploymentId);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link
          href={`/projects/${detail.project_id}/timeline`}
          className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to timeline
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment detail</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {detail.prompt_version?.version ?? "Prompt n/a"} · {detail.model_version?.model_name ?? "Model n/a"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-steel">
              {detail.environment} · {new Date(detail.deployed_at).toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {detail.deployed_by ?? "unknown deployer"}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <GitCommitHorizontal className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment metadata</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Change record</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Prompt version</p>
              <p className="mt-2 text-sm font-medium text-ink">{detail.prompt_version?.version ?? "n/a"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Model version</p>
              <p className="mt-2 text-sm font-medium text-ink">{detail.model_version?.model_name ?? "n/a"}</p>
            </div>
          </div>
          <pre className="mt-5 overflow-x-auto rounded-[24px] border border-zinc-200 bg-zinc-950 px-4 py-4 text-xs leading-6 text-zinc-100">
            {renderMetadata(detail.metadata_json as Record<string, unknown> | null | undefined)}
          </pre>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment events</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Timeline</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {detail.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <p className="text-sm font-medium text-ink">{event.event_type}</p>
                  <p className="mt-1 text-sm text-steel">{new Date(event.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Linked incidents</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Investigation paths</h2>
              </div>
            </div>
            {detail.incident_ids.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-steel">No incidents currently linked to this deployment.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {detail.incident_ids.map((incidentId) => (
                  <Link
                    key={incidentId}
                    href={`/incidents/${incidentId}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-ink">{incidentId}</span>
                    <ArrowRight className="h-4 w-4 text-steel" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
