"use client";

import { usePathname, useSearchParams } from "next/navigation";

import type { EnvironmentRead } from "@reliai/types";

type ProjectEnvironmentShellProps = {
  projectId: string;
  projectName: string;
  defaultEnvironment: string;
  environments: EnvironmentRead[];
};

function withEnvironment(path: string, environment: string) {
  const params = new URLSearchParams();
  params.set("environment", environment);
  return `${path}?${params.toString()}`;
}

export function ProjectEnvironmentShell({
  projectId,
  projectName,
  defaultEnvironment,
  environments,
}: ProjectEnvironmentShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedEnvironment =
    searchParams.get("environment")?.trim().toLowerCase() || defaultEnvironment;

  const tabs = [
    { label: "Reliability", href: `/projects/${projectId}/reliability`, active: pathname.endsWith("/reliability") },
    { label: "Control", href: `/projects/${projectId}/control`, active: pathname.endsWith("/control") },
    { label: "Timeline", href: `/projects/${projectId}/timeline`, active: pathname.endsWith("/timeline") },
    { label: "Deployments", href: `/projects/${projectId}/deployments`, active: pathname.endsWith("/deployments") },
    { label: "Guardrails", href: `/projects/${projectId}/guardrails`, active: pathname.endsWith("/guardrails") },
    { label: "Metrics", href: `/projects/${projectId}/metrics`, active: pathname.endsWith("/metrics") },
    { label: "Ingestion", href: `/projects/${projectId}/ingestion`, active: pathname.endsWith("/ingestion") },
    { label: "Processors", href: `/projects/${projectId}/processors`, active: pathname.endsWith("/processors") },
    { label: "Project settings", href: `/projects/${projectId}/settings`, active: pathname.endsWith("/settings") },
    { label: "Incidents", href: `/incidents?projectId=${projectId}&environment=${selectedEnvironment}`, active: pathname === "/incidents" },
  ];

  return (
    <div className="rounded-[24px] border border-default bg-surface px-5 py-4 shadow-none">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-secondary">Project scope</p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-lg font-semibold text-primary">{projectName}</h1>
            <span className="rounded-full border border-default bg-surface-elevated px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-secondary">
              {selectedEnvironment}
            </span>
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated px-4 py-3 text-sm text-secondary">
          <span className="font-medium text-primary">Environment</span>
          <select
            value={selectedEnvironment}
            onChange={(event) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("environment", event.target.value);
              window.location.assign(`${pathname}?${params.toString()}`);
            }}
            className="min-w-44 rounded-md border border-default bg-surface px-3 py-2 text-sm text-primary outline-none"
          >
            {environments.map((environment) => (
              <option key={environment.id} value={environment.name}>
                {environment.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <a
            key={tab.label}
            href={tab.href.startsWith("/incidents") ? tab.href : withEnvironment(tab.href, selectedEnvironment)}
            className={`rounded-full border border-transparent px-3 py-2 text-sm font-medium transition ${
              tab.active
                ? "tab-active border-default"
                : "tab-inactive bg-surface-elevated hover:border-default"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
}
