import type { Route } from "next";
import Link from "next/link";
import { ChevronRight, Filter, Radar, SearchSlash } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listTraces, type TraceFilters } from "@/lib/api";

function getStatusPill(success: boolean, errorType: string | null) {
  if (success) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (errorType) {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

export default async function TracesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const filters: TraceFilters = {
    projectId: readSearchParam(params.project_id),
    modelName: readSearchParam(params.model_name),
    promptVersion: readSearchParam(params.prompt_version),
    success: readSearchParam(params.success) as "true" | "false" | undefined,
    dateFrom: readSearchParam(params.date_from),
    dateTo: readSearchParam(params.date_to),
    cursor: readSearchParam(params.cursor),
    limit: readSearchParam(params.limit) ? Number(readSearchParam(params.limit)) : 25
  };

  const traces = await listTraces(filters).catch(() => ({ items: [], next_cursor: null }));
  const hasFilters =
    Boolean(filters.projectId) ||
    Boolean(filters.modelName) ||
    Boolean(filters.promptVersion) ||
    Boolean(filters.success) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace explorer</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Inspect recent AI requests
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Narrow by project, model, prompt version, outcome, and time window. Each row links
              directly to persisted retrieval and evaluation records.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {traces.items.length} trace{traces.items.length === 1 ? "" : "s"} loaded
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        <div className="border-b border-zinc-200 px-6 py-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              name="project_id"
              defaultValue={filters.projectId}
              placeholder="Project ID"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-ink outline-none ring-0 placeholder:text-zinc-400"
            />
            <input
              name="model_name"
              defaultValue={filters.modelName}
              placeholder="Model"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-zinc-400"
            />
            <input
              name="prompt_version"
              defaultValue={filters.promptVersion}
              placeholder="Prompt version"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-zinc-400"
            />
            <select
              name="success"
              defaultValue={filters.success ?? ""}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-ink outline-none"
            >
              <option value="">Any outcome</option>
              <option value="true">Success</option>
              <option value="false">Failure</option>
            </select>
            <input
              name="date_from"
              type="datetime-local"
              defaultValue={filters.dateFrom}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-ink outline-none"
            />
            <input
              name="date_to"
              type="datetime-local"
              defaultValue={filters.dateTo}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-ink outline-none"
            />
            <div className="xl:col-span-6 flex flex-wrap items-center gap-3">
              <button className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black">
                Apply filters
              </button>
              {hasFilters ? (
                <Link
                  href={"/traces" as Route}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-steel transition hover:bg-zinc-50 hover:text-ink"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        {traces.items.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10">
              <SearchSlash className="h-6 w-6 text-steel" />
              <h2 className="mt-4 text-xl font-semibold text-ink">No traces match these filters</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-steel">
                Send the first trace through `/api/v1/ingest/traces`, or widen the filter window if
                you are querying a narrow project or prompt version.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-50 text-xs uppercase tracking-[0.18em] text-steel">
                <tr>
                  <th className="px-6 py-4 font-medium">Request</th>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Model</th>
                  <th className="px-6 py-4 font-medium">Prompt</th>
                  <th className="px-6 py-4 font-medium">Output</th>
                  <th className="px-6 py-4 font-medium">Latency</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {traces.items.map((trace) => (
                  <tr key={trace.id} className="border-t border-zinc-200 align-top">
                    <td className="px-6 py-4">
                      <Link
                        href={`/traces/${trace.id}` as Route}
                        className="inline-flex items-center gap-2 text-sm font-medium text-ink transition hover:text-accent"
                      >
                        {trace.request_id}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-steel">
                        {trace.environment}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-steel">
                      {new Date(trace.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-ink">{trace.model_name}</p>
                      <p className="mt-1 text-sm text-steel">{trace.model_provider ?? "provider n/a"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-steel">
                      {trace.prompt_version ?? "Unversioned"}
                    </td>
                    <td className="px-6 py-4 text-sm text-steel">
                      <p className="max-w-[320px] leading-6">
                        {trace.output_preview ?? trace.input_preview ?? "No preview stored"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-steel">
                      {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "n/a"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusPill(
                          trace.success,
                          trace.error_type
                        )}`}
                      >
                        {trace.success ? "Success" : trace.error_type ?? "Failure"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {traces.next_cursor ? (
          <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
            <div className="flex items-center gap-2 text-sm text-steel">
              <Radar className="h-4 w-4" />
              Additional traces are available.
            </div>
            <Link
              href={
                (`/traces?${new URLSearchParams({
                  ...(filters.projectId ? { project_id: filters.projectId } : {}),
                  ...(filters.modelName ? { model_name: filters.modelName } : {}),
                  ...(filters.promptVersion ? { prompt_version: filters.promptVersion } : {}),
                  ...(filters.success ? { success: filters.success } : {}),
                  ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
                  ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
                  cursor: traces.next_cursor
                }).toString()}`) as Route
              }
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-ink transition hover:bg-zinc-50"
            >
              Next page
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
