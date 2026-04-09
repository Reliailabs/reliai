"use client"

import Link from "next/link"
import { ArrowRight, Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { MetricTile } from "@/components/metric-tile"
import { cn } from "@/lib/utils"

// Mock data for projects
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
      errorRate: { value: "2.1%", tone: "stable" as const },
      latency: { value: "1.2s", tone: "warning" as const },
      throughput: { value: "1.2K/min", tone: "stable" as const },
      uptime: { value: "99.9%", tone: "stable" as const },
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
      errorRate: { value: "5.7%", tone: "critical" as const },
      latency: { value: "3.8s", tone: "critical" as const },
      throughput: { value: "450/min", tone: "warning" as const },
      uptime: { value: "97.2%", tone: "warning" as const },
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
      errorRate: { value: "0.8%", tone: "stable" as const },
      latency: { value: "45s", tone: "stable" as const },
      throughput: { value: "2.1K/min", tone: "stable" as const },
      uptime: { value: "99.95%", tone: "stable" as const },
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
      errorRate: { value: "1.5%", tone: "stable" as const },
      latency: { value: "2.1s", tone: "warning" as const },
      throughput: { value: "890/min", tone: "stable" as const },
      uptime: { value: "98.7%", tone: "warning" as const },
    },
    alerts: 2,
    incidents: 1,
  },
]

type ProjectStatus = "healthy" | "at_risk" | "maintenance"

interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  model: string
  version: string
  lastDeployed: string
  metrics: {
    errorRate: { value: string; tone: "critical" | "warning" | "stable" }
    latency: { value: string; tone: "critical" | "warning" | "stable" }
    throughput: { value: string; tone: "critical" | "warning" | "stable" }
    uptime: { value: string; tone: "critical" | "warning" | "stable" }
  }
  alerts: number
  incidents: number
}

// ── Status configuration ──────────────────────────────────────────────────────

const statusConfig: Record<ProjectStatus, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  healthy: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: CheckCircle,
  },
  at_risk: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: AlertTriangle,
  },
  maintenance: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Clock,
  },
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const StatusIcon = statusConfig[project.status].icon

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 hover:bg-zinc-900/70 hover:border-zinc-700 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-zinc-200 group-hover:text-zinc-100 transition-colors truncate">
              {project.name}
            </h3>
            <StatusIcon className={cn("w-4 h-4", statusConfig[project.status].color)} />
          </div>
          <p className="text-sm text-zinc-500 line-clamp-2">{project.description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors ml-4" />
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
        <span>{project.model}</span>
        <span>•</span>
        <span>{project.version}</span>
        <span>•</span>
        <span>Updated {new Date(project.lastDeployed).toLocaleDateString()}</span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricTile
          label="Error Rate"
          value={project.metrics.errorRate.value}
          tone={project.metrics.errorRate.tone}
        />
        <MetricTile
          label="Latency"
          value={project.metrics.latency.value}
          tone={project.metrics.latency.tone}
        />
        <MetricTile
          label="Throughput"
          value={project.metrics.throughput.value}
          tone={project.metrics.throughput.tone}
        />
        <MetricTile
          label="Uptime"
          value={project.metrics.uptime.value}
          tone={project.metrics.uptime.tone}
        />
      </div>

      {/* Alerts and incidents */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-zinc-400">{project.alerts} alerts</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-red-400" />
          <span className="text-zinc-400">{project.incidents} incidents</span>
        </div>
      </div>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const healthyCount = projects.filter(p => p.status === 'healthy').length
  const atRiskCount = projects.filter(p => p.status === 'at_risk').length
  const maintenanceCount = projects.filter(p => p.status === 'maintenance').length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Projects"
        description="Monitor and manage your AI projects and deployments"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold text-emerald-400">{healthyCount}</div>
              <div className="text-sm text-zinc-500">Healthy</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-2xl font-bold text-amber-400">{atRiskCount}</div>
              <div className="text-sm text-zinc-500">At Risk</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-2xl font-bold text-blue-400">{maintenanceCount}</div>
              <div className="text-sm text-zinc-500">Maintenance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}