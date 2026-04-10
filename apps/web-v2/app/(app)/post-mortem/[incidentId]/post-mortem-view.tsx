"use client"

import { useState } from "react"
import { CheckCircle, Plus, Clock, Zap, AlertTriangle, ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { CostPerIncident, calculateCostMetrics } from "@/components/cost-per-incident"
import { cn } from "@/lib/utils"

export type PostMortemCauseCategory =
  | "code_defect"
  | "infrastructure"
  | "human_error"
  | "external_dependency"
  | "configuration"
  | "monitoring"
  | "other"

type CauseCategory = PostMortemCauseCategory

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

export type PostMortemIncident = {
  id: string
  title: string
  severity: SeverityLevel
  project: string
  model: string
  startTime: string
  detectedAt: string
  respondedAt: string
  resolvedAt: string
  duration: string
  detectionTime: string
  responseTime: string
  resolutionTime: string
  affectedServices: string[]
  rootCause: string
  causeCategory: CauseCategory
  contributingFactors: string[]
}

const causeCategories: Record<CauseCategory, { label: string; short: string }> = {
  code_defect:         { label: "Code Defect",        short: "Code"          },
  infrastructure:      { label: "Infrastructure",      short: "Infra"         },
  human_error:         { label: "Human Error",         short: "Human"         },
  external_dependency: { label: "External Dependency", short: "External"      },
  configuration:       { label: "Configuration",       short: "Config"        },
  monitoring:          { label: "Monitoring Gap",      short: "Monitoring"    },
  other:               { label: "Other",               short: "Other"         },
}

const priorityStyle: Record<Priority, string> = {
  critical: "text-red-400    bg-red-500/10    border-red-500/20",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium:   "text-amber-400  bg-amber-500/10  border-amber-500/20",
  low:      "text-zinc-400   bg-zinc-700/30   border-zinc-700",
}

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

export function PostMortemView({ incident }: { incident: PostMortemIncident }) {
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

  const costMetrics = calculateCostMetrics(0, 0, incident.model)

  return (
    <div className="min-h-full">
      <PageHeader
        title="Post-Mortem Review"
        description="Structured incident review and corrective action tracking"
        right={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border",
                severityBadge[incident.severity]
              )}
            >
              {incident.severity}
            </span>
            <span className="text-[10px] text-zinc-500">{incident.id}</span>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="flex items-start gap-4 px-6 py-5">
            <div className={cn("w-1.5 rounded-full shrink-0 mt-1", severityBar[incident.severity])} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold text-zinc-100">{incident.title}</div>
              <div className="text-sm text-zinc-500 mt-1">
                {incident.project} · {incident.model}
              </div>
              <div className="mt-3 text-xs text-zinc-500 leading-relaxed">
                {incident.rootCause}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div className="font-mono text-zinc-400">{incident.duration}</div>
              <div className="mt-1">{new Date(incident.startTime).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-6 py-4">
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
            Timeline
          </div>
          <div className="flex items-center">
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
              accent="bg-emerald-500"
              last
            />
          </div>
        </div>

        <CostPerIncident metrics={costMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                Primary Cause
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(causeCategories).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setCauseCategory(key as CauseCategory)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded border transition-colors",
                      causeCategory === key
                        ? "border-zinc-500 text-zinc-100 bg-zinc-800"
                        : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                    )}
                  >
                    {value.short}
                  </button>
                ))}
              </div>
              <div className="text-xs text-zinc-500 mt-3 leading-relaxed">
                {causeCategories[causeCategory].label}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                Contributing Factors
              </div>
              <ul className="space-y-2">
                {incident.contributingFactors.map((factor, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                Action Items
              </div>
              <button
                onClick={() => setIsCompleted(!isCompleted)}
                className={cn(
                  "text-[10px] uppercase tracking-widest px-2 py-1 rounded border",
                  isCompleted
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-500 border-zinc-700"
                )}
              >
                {isCompleted ? "Completed" : "In progress"}
              </button>
            </div>

            <div className="space-y-3">
              {actionItems.map((item) => (
                <div key={item.id} className="border border-zinc-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-200">{item.title}</div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded border", priorityStyle[item.priority])}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">{item.description}</div>
                  <div className="text-xs text-zinc-600 flex items-center gap-3">
                    <span>{item.assignee}</span>
                    <span>{item.dueDate || "No due date"}</span>
                  </div>
                </div>
              ))}

              <div className="border border-dashed border-zinc-700 rounded-lg p-4 space-y-3">
                <div className="text-xs text-zinc-500">Add action item</div>
                <input
                  value={newItem.title || ""}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="Title"
                  className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200"
                />
                <textarea
                  value={newItem.description || ""}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Description"
                  className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={newItem.assignee || ""}
                    onChange={(e) => setNewItem({ ...newItem, assignee: e.target.value })}
                    placeholder="Assignee"
                    className="flex-1 text-sm bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200"
                  />
                  <input
                    value={newItem.dueDate || ""}
                    onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })}
                    placeholder="Due date"
                    className="w-32 text-sm bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200"
                  />
                  <button
                    onClick={addActionItem}
                    className="px-3 py-2 rounded bg-zinc-100 text-zinc-950 text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Customer Impact</div>
              <div className="text-sm text-zinc-200">Contained</div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Detection gap</div>
              <div className="text-sm text-zinc-200">Needs review</div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">Automation</div>
              <div className="text-sm text-zinc-200">Suggested fixes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
