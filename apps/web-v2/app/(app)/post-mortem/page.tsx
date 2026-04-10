"use client"

import { useState } from "react"
import { CheckCircle, Plus, X, Clock, Zap, AlertTriangle, ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { CostPerIncident, calculateCostMetrics } from "@/components/cost-per-incident"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type CauseCategory =
  | "code_defect"
  | "infrastructure"
  | "human_error"
  | "external_dependency"
  | "configuration"
  | "monitoring"
  | "other"

type SeverityLevel = "critical" | "high" | "medium" | "low"
type Priority      = "critical" | "high" | "medium" | "low"

interface ActionItem {
  id: string
  title: string
  description: string
  assignee: string
  dueDate: string
  priority: Priority
}

// ── Cause categories ──────────────────────────────────────────────────────────

const causeCategories: Record<CauseCategory, { label: string; short: string }> = {
  code_defect:         { label: "Code Defect",        short: "Code"          },
  infrastructure:      { label: "Infrastructure",      short: "Infra"         },
  human_error:         { label: "Human Error",         short: "Human"         },
  external_dependency: { label: "External Dependency", short: "External"      },
  configuration:       { label: "Configuration",       short: "Config"        },
  monitoring:          { label: "Monitoring Gap",      short: "Monitoring"    },
  other:               { label: "Other",               short: "Other"         },
}

// ── Priority colours ──────────────────────────────────────────────────────────

const priorityStyle: Record<Priority, string> = {
  critical: "text-red-400    bg-red-500/10    border-red-500/20",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium:   "text-amber-400  bg-amber-500/10  border-amber-500/20",
  low:      "text-zinc-400   bg-zinc-700/30   border-zinc-700",
}

// ── Severity styles ───────────────────────────────────────────────────────────

const severityBar: Record<SeverityLevel, string> = {
  critical: "bg-red-500",
  high:     "bg-amber-500",
  medium:   "bg-yellow-500",
  low:      "bg-blue-500",
}

const severityBadge: Record<SeverityLevel, string> = {
  critical: "text-red-400    bg-red-500/10    border-red-500/20",
  high:     "text-amber-400  bg-amber-500/10  border-amber-500/20",
  medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low:      "text-blue-400   bg-blue-500/10   border-blue-500/20",
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const incident = {
  id:               "inc-123",
  title:            "High Error Rate in Sentiment-Analyzer",
  severity:         "critical" as SeverityLevel,
  project:          "sentiment-analyzer",
  model:            "claude-3-haiku",
  startTime:        "2024-01-15T14:30:00Z",
  detectedAt:       "2024-01-15T14:32:00Z",
  respondedAt:      "2024-01-15T14:40:00Z",
  resolvedAt:       "2024-01-15T16:45:00Z",
  duration:         "2h 15m",
  detectionTime:    "2m",
  responseTime:     "8m",
  resolutionTime:   "127m",
  affectedServices: ["sentiment-analyzer", "sentiment-cache"],
  rootCause:        "New model version (v0.9.4) had different token handling causing unexpected behavior on edge cases",
  causeCategory:    "code_defect" as CauseCategory,
  contributingFactors: [
    "Insufficient pre-deployment testing on edge cases",
    "Missing canary deployment strategy",
    "Lack of automated regression detection",
  ],
}

// ── Timeline segment ──────────────────────────────────────────────────────────

function TimelineSegment({
  label, time, duration, accent, last = false,
}: {
  label: string
  time: string
  duration?: string
  accent: string
  last?: boolean
}) {
  return (
    <div className="flex items-center gap-0 flex-1">
      <div className="flex flex-col items-center gap-1">
        <div className={cn("w-2 h-2 rounded-full shrink-0", accent)} />
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">
          {label}
        </div>
        <div className="text-[10px] font-mono text-zinc-600 whitespace-nowrap">
          {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      {!last && (
        <div className="flex flex-1 flex-col items-center mx-2">
          <div className="flex items-center gap-1 w-full">
            <div className="flex-1 h-px bg-zinc-800" />
            <ArrowRight className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
          </div>
          {duration && (
            <div className="flex items-center gap-0.5 mt-1 text-[10px] text-zinc-600">
              <Clock className="w-2.5 h-2.5" />
              {duration}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PostMortemPage() {
  const [causeCategory,  setCauseCategory]  = useState<CauseCategory>(incident.causeCategory)
  const [actionItems,    setActionItems]    = useState<ActionItem[]>([])
  const [newItem,        setNewItem]        = useState<Partial<ActionItem>>({})
  const [isCompleted,    setIsCompleted]    = useState(false)

  const addActionItem = () => {
    if (!newItem.title) return
    setActionItems([...actionItems, {
      id:          Math.random().toString(36).slice(2, 9),
      title:       newItem.title,
      description: newItem.description || "",
      assignee:    newItem.assignee    || "Unassigned",
      dueDate:     newItem.dueDate     || "",
      priority:    newItem.priority    || "medium",
    }])
    setNewItem({})
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Post-Mortem Review"
        description="Structured incident review and corrective action tracking"
        right={
          isCompleted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-medium text-amber-400">In review</span>
            </div>
          )
        }
      />

      <div className="p-6 space-y-4">

        {/* ── Incident header ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex">
          {/* Severity bar */}
          <div className={cn("w-1 shrink-0", severityBar[incident.severity])} />

          <div className="flex-1 px-5 py-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-50 leading-snug">
                  {incident.title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-zinc-600">{incident.id}</span>
                  <span className="text-zinc-800">·</span>
                  <span className="text-xs text-zinc-600">{incident.project}</span>
                  <span className="text-zinc-800">·</span>
                  <span className="text-xs font-mono text-zinc-600">{incident.model}</span>
                </div>
              </div>
              <span className={cn(
                "inline-flex items-center px-2 py-1 rounded text-[11px] font-bold tracking-widest border shrink-0",
                severityBadge[incident.severity]
              )}>
                {incident.severity.toUpperCase()}
              </span>
            </div>

            {/* Key metrics strip */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Duration",   value: incident.duration,       icon: Clock        },
                { label: "Detection",  value: incident.detectionTime,  icon: Zap          },
                { label: "Response",   value: incident.responseTime,   icon: AlertTriangle },
                { label: "Resolution", value: incident.resolutionTime, icon: CheckCircle  },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2.5 flex items-center gap-2">
                  <Icon className="w-3 h-3 text-zinc-600 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</div>
                    <div className="text-sm font-semibold text-zinc-200 tabular-nums mt-0.5">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Incident timeline */}
            <div className="bg-zinc-950/60 border border-zinc-800 rounded px-4 py-3">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">
                Incident Timeline
              </div>
              <div className="flex items-start">
                <TimelineSegment
                  label="Started"
                  time={incident.startTime}
                  duration={incident.detectionTime}
                  accent="bg-red-500"
                />
                <TimelineSegment
                  label="Detected"
                  time={incident.detectedAt}
                  duration={incident.responseTime}
                  accent="bg-amber-500"
                />
                <TimelineSegment
                  label="Responded"
                  time={incident.respondedAt}
                  duration={incident.resolutionTime}
                  accent="bg-blue-500"
                />
                <TimelineSegment
                  label="Resolved"
                  time={incident.resolvedAt}
                  accent="bg-emerald-500"
                  last
                />
              </div>
            </div>

            {/* Affected services */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Affected:</span>
              {incident.affectedServices.map((s) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Root cause analysis ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Root Cause Analysis
            </span>
          </div>
          <div className="px-4 py-4 space-y-4">

            {/* Root cause callout */}
            <div className="flex gap-3 bg-zinc-950/60 border border-zinc-800 rounded px-3 py-3">
              <div className="w-0.5 bg-amber-500/60 rounded-full shrink-0" />
              <p className="text-sm text-zinc-300 leading-relaxed">{incident.rootCause}</p>
            </div>

            {/* Cause category pills */}
            <div>
              <div className="text-xs text-zinc-600 mb-2">Cause Category</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(causeCategories) as [CauseCategory, { label: string; short: string }][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCauseCategory(key)}
                    className={cn(
                      "px-2.5 py-1 rounded border text-xs font-medium transition-all",
                      causeCategory === key
                        ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                        : "bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                    )}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contributing factors */}
            <div>
              <div className="text-xs text-zinc-600 mb-2">Contributing Factors</div>
              <div className="space-y-1.5">
                {incident.contributingFactors.map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-3 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded"
                  >
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 rounded w-4 h-4 flex items-center justify-center shrink-0 mt-px">
                      {i + 1}
                    </span>
                    <span className="text-xs text-zinc-300">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Cost analysis ── */}
        <CostPerIncident
          metrics={calculateCostMetrics(48200, 12800, incident.model)}
        />

        {/* ── Action items ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Action Items
            </span>
            {actionItems.length > 0 && (
              <span className="text-xs text-zinc-500 tabular-nums">
                <span className="text-zinc-200 font-medium">{actionItems.length}</span> added
              </span>
            )}
          </div>

          <div className="divide-y divide-zinc-800/40">
            {/* Existing items */}
            {actionItems.map((item) => (
              <div key={item.id} className="flex items-start gap-4 px-4 py-3 hover:bg-zinc-800/20 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-200">{item.title}</span>
                    <span className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                      priorityStyle[item.priority]
                    )}>
                      {item.priority}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-zinc-500 mb-1">{item.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-zinc-700">
                    <span>{item.assignee}</span>
                    {item.dueDate && <span>Due {item.dueDate}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setActionItems(actionItems.filter((a) => a.id !== item.id))}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add new */}
            <div className="px-4 py-4 space-y-2.5">
              <input
                type="text"
                placeholder="New action item title…"
                value={newItem.title || ""}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addActionItem()}
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none transition-colors"
              />
              <textarea
                placeholder="Description (optional)"
                value={newItem.description || ""}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                rows={2}
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none transition-colors"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Assignee"
                  value={newItem.assignee || ""}
                  onChange={(e) => setNewItem({ ...newItem, assignee: e.target.value })}
                  className="bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none transition-colors"
                />
                <input
                  type="date"
                  value={newItem.dueDate || ""}
                  onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })}
                  className="bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                />
                <select
                  value={newItem.priority || "medium"}
                  onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as Priority })}
                  className="bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <button
                onClick={addActionItem}
                className="w-full flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded px-3 py-2 text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Action Item
              </button>
            </div>
          </div>
        </div>

        {/* ── Complete ── */}
        <div className="flex items-center gap-3 pb-2">
          <button
            onClick={() => setIsCompleted(!isCompleted)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border",
              isCompleted
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600"
            )}
          >
            <CheckCircle className="w-4 h-4" />
            {isCompleted ? "Completed — click to reopen" : "Mark Post-Mortem Complete"}
          </button>
          {isCompleted && (
            <span className="text-xs text-zinc-600">Recorded as incident event · visible in audit log</span>
          )}
        </div>

      </div>
    </div>
  )
}
