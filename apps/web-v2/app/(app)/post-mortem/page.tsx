"use client"

import { useState } from "react"
import { CheckCircle, AlertCircle, Plus, X } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

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
  owner: string
}

interface PostMortemData {
  incidentId: string
  incidentTitle: string
  duration: string
  startTime: string
  endTime: string
  severity: SeverityLevel
  detectionTime: string
  responseTime: string
  resolutionTime: string
  affectedServices: string[]
  rootCause: string
  causeCategory: CauseCategory
  contributing_factors: string[]
  recommended_actions: ActionItem[]
}

const causeCategories: Record<CauseCategory, { label: string; description: string }> = {
  code_defect:         { label: "Code Defect",          description: "Bug in application or library code"          },
  infrastructure:      { label: "Infrastructure",        description: "Server, network, or resource issue"          },
  human_error:         { label: "Human Error",           description: "Mistake during deployment or configuration"  },
  external_dependency: { label: "External Dependency",   description: "Third-party service or API failure"          },
  configuration:       { label: "Configuration",         description: "Incorrect settings or parameters"            },
  monitoring:          { label: "Monitoring Gap",        description: "Lack of visibility or alerting"             },
  other:               { label: "Other",                 description: "Uncategorized or multiple factors"          },
}

const priorityColor: Record<Priority, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low:      "text-zinc-400 bg-zinc-700/30 border-zinc-700",
}

const mockIncident: PostMortemData = {
  incidentId:   "inc-123",
  incidentTitle: "High Error Rate in Sentiment-Analyzer",
  duration:      "2h 15m",
  startTime:     "2024-01-15T14:30:00Z",
  endTime:       "2024-01-15T16:45:00Z",
  severity:      "critical",
  detectionTime: "2m",
  responseTime:  "8m",
  resolutionTime: "127m",
  affectedServices: ["sentiment-analyzer", "sentiment-cache"],
  rootCause: "New model version (v0.9.4) had different token handling causing unexpected behavior on edge cases",
  causeCategory: "code_defect",
  contributing_factors: [
    "Insufficient pre-deployment testing on edge cases",
    "Missing canary deployment strategy",
    "Lack of automated regression detection",
  ],
  recommended_actions: [],
}

export default function PostMortemPage() {
  const [formData, setFormData]         = useState<PostMortemData>(mockIncident)
  const [actionItems, setActionItems]   = useState<ActionItem[]>([])
  const [newItem, setNewItem]           = useState<Partial<ActionItem>>({})
  const [isCompleted, setIsCompleted]   = useState(false)

  const addActionItem = () => {
    if (!newItem.title) return
    setActionItems([
      ...actionItems,
      {
        id:          Math.random().toString(36).slice(2, 9),
        title:       newItem.title,
        description: newItem.description || "",
        assignee:    newItem.assignee || "Unassigned",
        dueDate:     newItem.dueDate || "",
        priority:    newItem.priority || "medium",
        owner:       "Current User",
      },
    ])
    setNewItem({})
  }

  const removeActionItem = (id: string) => {
    setActionItems(actionItems.filter((i) => i.id !== id))
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Post-Mortem Review"
        description="Structured incident review and action item tracking"
      />

      <div className="p-6 space-y-4">
        {/* ── Incident summary ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Incident
            </span>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border",
                formData.severity === "critical"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              )}
            >
              {formData.severity.toUpperCase()}
            </span>
          </div>
          <div className="px-4 py-3">
            <div className="text-sm font-medium text-zinc-100 mb-1">{formData.incidentTitle}</div>
            <div className="text-xs font-mono text-zinc-600 mb-4">{formData.incidentId}</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Duration",   value: formData.duration       },
                { label: "Detection",  value: formData.detectionTime  },
                { label: "Response",   value: formData.responseTime   },
                { label: "Resolution", value: formData.resolutionTime },
              ].map((m) => (
                <div key={m.label} className="bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2.5">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{m.label}</div>
                  <div className="text-sm font-semibold text-zinc-200 tabular-nums">{m.value}</div>
                </div>
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
            {/* Root cause */}
            <div>
              <div className="text-xs text-zinc-500 mb-1.5">Root Cause</div>
              <div className="bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2.5">
                <p className="text-xs text-zinc-300">{formData.rootCause}</p>
              </div>
            </div>

            {/* Cause category */}
            <div>
              <div className="text-xs text-zinc-500 mb-2">Cause Category</div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(causeCategories).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setFormData({ ...formData, causeCategory: key as CauseCategory })}
                    className={cn(
                      "p-2.5 border rounded-lg text-left transition-all",
                      formData.causeCategory === key
                        ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                        : "bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                    )}
                  >
                    <div className="text-xs font-medium">{val.label}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{val.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contributing factors */}
            <div>
              <div className="text-xs text-zinc-500 mb-1.5">Contributing Factors</div>
              <ul className="space-y-1.5">
                {formData.contributing_factors.map((factor, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-xs text-zinc-300 px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded"
                  >
                    <span className="text-amber-400 shrink-0">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Action items ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
              Action Items
              {actionItems.length > 0 && (
                <span className="ml-1.5 text-zinc-400 normal-case">{actionItems.length}</span>
              )}
            </span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {/* Existing items */}
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="border border-zinc-800 rounded-lg px-4 py-3 bg-zinc-950/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200">{item.title}</span>
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                          priorityColor[item.priority]
                        )}
                      >
                        {item.priority}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-zinc-500">{item.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                      <span>{item.assignee}</span>
                      {item.dueDate && <span>Due {item.dueDate}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => removeActionItem(item.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add new item */}
            <div className="border border-zinc-800 rounded-lg px-4 py-3 bg-zinc-950/50 space-y-2.5">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                  Action Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Implement canary deployment for model updates"
                  value={newItem.title || ""}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                  Description
                </label>
                <textarea
                  placeholder="What needs to be done?"
                  value={newItem.description || ""}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                    Assignee
                  </label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newItem.assignee || ""}
                    onChange={(e) => setNewItem({ ...newItem, assignee: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newItem.dueDate || ""}
                    onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                    Priority
                  </label>
                  <select
                    value={newItem.priority || "medium"}
                    onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as Priority })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
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

        {/* ── Submit ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCompleted(true)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all border",
              isCompleted
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600"
            )}
          >
            {isCompleted ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Post-Mortem Completed
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                Mark as Complete
              </>
            )}
          </button>
          {isCompleted && (
            <span className="text-xs text-emerald-400">
              Recorded as an incident event
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
