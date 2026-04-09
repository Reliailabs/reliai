"use client"

import Link from "next/link"
import { ChevronRight, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

const projects = [
  {
    id: "sentiment-analyzer",
    name: "Sentiment Analyzer",
    description: "AI-powered sentiment analysis for customer feedback",
    status: "healthy" as const,
    model: "claude-3-haiku",
    version: "v0.9.4",
    lastDeployed: "2024-01-15T08:00:00Z",
    metrics: {
      errorRate:  { value: "2.1%",     tone: "stable"   as const },
      latency:    { value: "1.2s",     tone: "warning"  as const },
      throughput: { value: "1.2K/min", tone: "stable"   as const },
      uptime:     { value: "99.9%",    tone: "stable"   as const },
    },
    alerts: 3,
    incidents: 2,
  },
  {
    id: "code-review-assistant",
    name: "Code Review Assistant",
    description: "Automated code review and quality analysis",
    status: "at_risk" as const,
    model: "gpt-4",
    version: "v1.2.1",
    lastDeployed: "2024-01-14T16:30:00Z",
    metrics: {
      errorRate:  { value: "5.7%",   tone: "critical" as const },
      latency:    { value: "3.8s",   tone: "critical" as const },
      throughput: { value: "450/min",tone: "warning"  as const },
      uptime:     { value: "97.2%",  tone: "warning"  as const },
    },
    alerts: 8,
    incidents: 5,
  },
  {
    id: "data-processor",
    name: "Data Processor",
    description: "Batch processing and ETL operations",
    status: "healthy" as const,
    model: "claude-3-sonnet",
    version: "v2.0.3",
    lastDeployed: "2024-01-13T12:00:00Z",
    metrics: {
      errorRate:  { value: "0.8%",     tone: "stable" as const },
      latency:    { value: "45s",      tone: "stable" as const },
      throughput: { value: "2.1K/min", tone: "stable" as const },
      uptime:     { value: "99.95%",   tone: "stable" as const },
    },
    alerts: 1,
    incidents: 0,
  },
  {
    id: "recommendation-engine",
    name: "Recommendation Engine",
    description: "Personalized content recommendations",
    status: "maintenance" as const,
    model: "gpt-3.5-turbo",
    version: "v1.8.2",
    lastDeployed: "2024-01-10T09:15:00Z",
    metrics: {
      errorRate:  { value: "1.5%",   tone: "stable"  as const },
      latency:    { value: "2.1s",   tone: "warning" as const },
      throughput: { value: "890/min",tone: "stable"  as const },
      uptime:     { value: "98.7%",  tone: "warning" as const },
    },
    alerts: 2,
    incidents: 1,
  },
]

type ProjectStatus = "healthy" | "at_risk" | "maintenance"
type MetricTone = "critical" | "warning" | "stable"

interface Project {
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

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg overflow-hidden transition-colors"
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot[project.status])} />
          <span className="text-sm font-medium text-zinc-100 truncate group-hover:text-zinc-50 transition-colors">
            {project.name}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        <p className="text-xs text-zinc-500 mb-3">{project.description}</p>

        {/* Compact metric row */}
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

        {/* Footer meta */}
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

export default function ProjectsPage() {
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

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  )
}
