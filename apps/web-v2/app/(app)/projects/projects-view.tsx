"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

type ProjectStatus = "healthy" | "at_risk" | "maintenance"
type MetricTone = "critical" | "warning" | "stable"

export interface ProjectCardData {
  id: string
  name: string
  description: string
  status: ProjectStatus
  model: string
  version: string
  lastDeployed: string
  metrics: {
    errorRate:  { value: string; tone: MetricTone }
    latency:    { value: string; tone: MetricTone }
    throughput: { value: string; tone: MetricTone }
    uptime:     { value: string; tone: MetricTone }
  }
  alerts: number
  incidents: number
}

const statusDot: Record<ProjectStatus, string> = {
  healthy:     "bg-emerald-500",
  at_risk:     "bg-amber-500",
  maintenance: "bg-blue-500",
}

const metricTone: Record<MetricTone, string> = {
  stable:   "border-emerald-500/30 bg-emerald-500/5  text-emerald-400",
  warning:  "border-amber-500/30  bg-amber-500/5   text-amber-400",
  critical: "border-red-500/30    bg-red-500/5     text-red-400",
}

function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg overflow-hidden transition-colors"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot[project.status])} />
          <span className="text-sm font-medium text-zinc-100 truncate group-hover:text-zinc-50 transition-colors">
            {project.name}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
      </div>

      <div className="px-4 py-3">
        <p className="text-xs text-zinc-500 mb-3">{project.description}</p>

        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(
            [
              { label: "Error",      ...project.metrics.errorRate  },
              { label: "Latency",    ...project.metrics.latency    },
              { label: "Throughput", ...project.metrics.throughput },
              { label: "Uptime",     ...project.metrics.uptime     },
            ] as { label: string; value: string; tone: MetricTone }[]
          ).map((m) => (
            <div key={m.label} className={cn("rounded border px-2 py-1.5", metricTone[m.tone])}>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-0.5">
                {m.label}
              </div>
              <div className="text-xs font-semibold tabular-nums">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-600">
            {project.model} · {project.version}
          </span>
          <div className="flex items-center gap-2 text-xs">
            {project.incidents > 0 && (
              <span className="text-red-400 tabular-nums">{project.incidents} incidents</span>
            )}
            {project.alerts > 0 && (
              <span className="text-amber-400 tabular-nums">{project.alerts} alerts</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ProjectsView({ projects }: { projects: ProjectCardData[] }) {
  const atRisk      = projects.filter((p) => p.status === "at_risk").length
  const maintenance = projects.filter((p) => p.status === "maintenance").length

  return (
    <div className="min-h-full">
      <PageHeader
        title="Projects"
        description="Monitor and manage your AI projects and deployments"
        right={
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              <span className="text-zinc-200 font-medium">{projects.length}</span> projects
            </span>
            {atRisk > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-amber-400 tabular-nums">{atRisk} at risk</span>
              </>
            )}
            {maintenance > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-blue-400 tabular-nums">{maintenance} maintenance</span>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
