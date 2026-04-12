import Link from "next/link";
import { ArrowRight, GitCommitHorizontal, ShieldAlert } from "lucide-react";

import { getProject, getProjectDeployments } from "@/lib/api";

function metadataLabel(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const strategy = typeof metadata.deployment_strategy === "string" ? metadata.deployment_strategy : null;
  const pipeline = typeof metadata.pipeline === "string" ? metadata.pipeline : null;
  return [strategy, pipeline].filter(Boolean).join(" · ") || null;
}

export default async function ProjectDeploymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, deployments] = await Promise.all([
    getProject(id),
    getProjectDeployments(id, environment),
  ]);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-800 bg-zinc-950 px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Deployment history</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{project.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Review environment-scoped prompt and model rollouts before jumping into incident or regression investigation.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
            {environment ?? project.environment} · {deployments.items.length} deployments
          </div>
        </div>
      </header>

      {deployments.items.length === 0 ? (
        <div className="rounded-[28px] border-zinc-800 p-6">
          <p className="text-sm leading-6 text-zinc-500">
            No deployments recorded for this environment yet. Create a deployment event before using environment-scoped incident correlation.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border-zinc-800">
          <div className="divide-y divide-zinc-200">
            {deployments.items.map((deployment) => {
              const label = metadataLabel(deployment.metadata_json);
              return (
                <Link
                  key={deployment.id}
                  href={`/deployments/${deployment.id}`}
                  className="grid gap-4 px-6 py-5 transition hover:bg-zinc-900 lg:grid-cols-[minmax(0,1.3fr)_180px_220px_24px] lg:items-center"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                        {deployment.environment}
                      </span>
                      {label ? (
                        <span className="inline-flex rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-700">
                          {label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-100">
                      {deployment.deployed_by ?? "Automated rollout"}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {new Date(deployment.deployed_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-sm text-zinc-500">
                    <p className="inline-flex items-center gap-2 text-zinc-100">
                      <GitCommitHorizontal className="h-4 w-4 text-zinc-500" />
                      {deployment.prompt_version_id ?? "No prompt version linked"}
                    </p>
                  </div>
                  <div className="text-sm text-zinc-500">
                    <p className="inline-flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      {deployment.model_version_id ?? "No model version linked"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-500" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
