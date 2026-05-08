import { getAudits } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PanelError } from "@/components/ui/panel-error";

export default async function AuditsPage() {
  let audits = { items: [] as Awaited<ReturnType<typeof getAudits>>["items"] };
  let hasError = false;
  try {
    audits = await getAudits({});
  } catch {
    hasError = true;
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Audits"
        description="Compliance readiness and production reliability certification status."
      />
      <div className="p-6">
        {hasError ? (
          <div className="mb-4">
            <PanelError detail="Audit list source is currently unavailable." />
          </div>
        ) : null}
        {audits.items.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            No audits yet. Run a reliability audit to establish certification posture.
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/80 text-zinc-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Audit</th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-left">Run status</th>
                  <th className="px-4 py-3 text-left">Certification</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {audits.items.map((item) => (
                  <tr key={item.audit.id} className="border-t border-zinc-800">
                    <td className="px-4 py-3 text-zinc-100">{item.audit.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{item.audit.target_system_name}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.latest_run?.status ?? "draft"}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.latest_run?.certification_status ?? "pending"}</td>
                    <td className="px-4 py-3 text-zinc-500">{new Date(item.audit.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
