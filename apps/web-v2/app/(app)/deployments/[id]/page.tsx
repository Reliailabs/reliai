import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getDeploymentDetail } from "@/lib/api";

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getDeploymentDetail(id).catch(() => null);
  if (!detail) {
    notFound();
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title={`Deployment ${id.slice(0, 8)}`}
        description={`Deployed to ${detail.environment} at ${new Date(detail.deployed_at).toLocaleString()}`}
        right={
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            {detail.project_id}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Environment</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.environment}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Deployed By</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.deployed_by || "n/a"}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Risk Level</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.latest_risk_score?.risk_level || "n/a"}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Gate Decision</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.gate?.decision || "n/a"}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Deployment Info</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Deployment ID</dt>
                <dd className="text-right text-zinc-100">{detail.id}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Project ID</dt>
                <dd className="text-right text-zinc-100">{detail.project_id}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Prompt Version</dt>
                <dd className="text-right text-zinc-100">{detail.prompt_version?.version || "n/a"}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Model Version</dt>
                <dd className="text-right text-zinc-100">{detail.model_version?.model_name || "n/a"}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Events</p>
            <div className="mt-4 space-y-3">
              {detail.events.length > 0 ? (
                detail.events.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-zinc-800 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-100">{event.event_type}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No events recorded</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Analysis</p>
           <pre className="mt-4 p-4 rounded-2xl border border-zinc-800 text-sm text-zinc-300 overflow-auto">
            {JSON.stringify(detail.risk_analysis_json, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}