"use client";

import Link from "next/link";
import { ArrowLeft, Network, AlertTriangle } from "lucide-react";
import type { OperationsGraphSurfaceData } from "@/lib/operations-graph-data";
import { ProjectScopeSelector, type ProjectScopeSelectorOption } from "@/components/dashboard/project-scope-selector";

export function OperationsGraphSurface({
  data,
  projectScope,
}: {
  data: OperationsGraphSurfaceData;
  projectScope?: {
    projects: ProjectScopeSelectorOption[];
    selectedProjectId: string | null;
  };
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="space-y-1">
        <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Operations center
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Operations Graph — {data.entityId}</h1>
        <p className="text-sm text-muted-foreground">Read-only operational graph: deployment → regression → incident → proposal → verification.</p>
      </div>
      {projectScope ? (
        <div className="mt-3 flex items-center justify-end">
          <ProjectScopeSelector
            projects={projectScope.projects}
            selectedProjectId={projectScope.selectedProjectId}
          />
        </div>
      ) : null}

      {data.sourceErrors.length > 0 ? (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Data source unavailable: {data.sourceErrors.join(", ")}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Advisory graph only — requires operator review.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">No write actions, approvals, execution, or rollback operations are available on this route.</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Network className="h-4 w-4 text-primary" />
            Nodes
          </p>
          {data.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No graph nodes linked to this entity.</p>
          ) : (
            <div className="space-y-2">
              {data.nodes.map((node) => (
                <div key={node.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{node.type} • {node.label}</p>
                    <Link href={node.href} className="text-xs text-primary hover:underline">Open</Link>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{node.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Edges</p>
          {data.edges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No graph edges linked to this entity.</p>
          ) : (
            <div className="space-y-2">
              {data.edges.map((edge, index) => (
                <div key={`${edge.from}-${edge.to}-${edge.relation}-${index}`} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{edge.from}</p>
                  <p className="text-sm font-medium">{edge.relation}</p>
                  <p className="text-xs text-muted-foreground">{edge.to}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
