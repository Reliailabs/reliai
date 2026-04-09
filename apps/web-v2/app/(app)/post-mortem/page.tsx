"use client"

import { useState } from "react"
import { CheckCircle, AlertCircle, Plus, X } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

type CauseCategory = "code_defect" | "infrastructure" | "human_error" | "external_dependency" | "configuration" | "monitoring" | "other"
type SeverityLevel = "critical" | "high" | "medium" | "low"

type Priority = "critical" | "high" | "medium" | "low"

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
  code_defect: { label: "Code Defect", description: "Bug in application or library code" },
  infrastructure: { label: "Infrastructure", description: "Server, network, or resource issue" },
  human_error: { label: "Human Error", description: "Mistake during deployment or configuration" },
  external_dependency: { label: "External Dependency", description: "Third-party service or API failure" },
  configuration: { label: "Configuration", description: "Incorrect settings or parameters" },
  monitoring: { label: "Monitoring Gap", description: "Lack of visibility or alerting" },
  other: { label: "Other", description: "Uncategorized or multiple factors" },
}

// Mock incident data
const mockIncident: PostMortemData = {
  incidentId: "inc-123",
  incidentTitle: "High Error Rate in Sentiment-Analyzer",
  duration: "2h 15m",
  startTime: "2024-01-15T14:30:00Z",
  endTime: "2024-01-15T16:45:00Z",
  severity: "critical",
  detectionTime: "2m",
  responseTime: "8m",
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
  const [formData, setFormData] = useState<PostMortemData>(mockIncident)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [newActionItem, setNewActionItem] = useState<Partial<ActionItem>>({})
  const [isCompleted, setIsCompleted] = useState(false)

  const addActionItem = () => {
    if (!newActionItem.title) return
    const item: ActionItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: newActionItem.title || "",
      description: newActionItem.description || "",
      assignee: newActionItem.assignee || "Unassigned",
      dueDate: newActionItem.dueDate || "",
      priority: newActionItem.priority || "medium",
      owner: "Current User",
    }
    setActionItems([...actionItems, item])
    setNewActionItem({})
  }

  const removeActionItem = (id: string) => {
    setActionItems(actionItems.filter(item => item.id !== id))
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Post-Mortem Review"
        description="Structured incident review and action item tracking"
      />

      {/* Incident summary */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">{formData.incidentTitle}</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Incident ID</div>
            <div className="text-sm font-mono text-zinc-300">{formData.incidentId}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">Severity</div>
            <div className={cn(
              "inline-block px-2 py-1 rounded text-xs font-semibold",
              formData.severity === "critical"
                ? "bg-red-500/10 text-red-400"
                : "bg-amber-500/10 text-amber-400"
            )}>
              {formData.severity.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Duration</div>
            <div className="text-sm font-semibold text-zinc-200">{formData.duration}</div>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Detection Time</div>
            <div className="text-sm font-semibold text-zinc-200">{formData.detectionTime}</div>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Response Time</div>
            <div className="text-sm font-semibold text-zinc-200">{formData.responseTime}</div>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded p-3">
            <div className="text-xs text-zinc-500 mb-1">Resolution Time</div>
            <div className="text-sm font-semibold text-zinc-200">{formData.resolutionTime}</div>
          </div>
        </div>
      </div>

      {/* Root cause analysis */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-200">Root Cause Analysis</h3>
        </div>
        <div className="p-6 space-y-6">
          {/* Root cause summary */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-2 block">Root Cause</label>
            <div className="bg-zinc-950/50 border border-zinc-800 rounded p-4">
              <p className="text-sm text-zinc-300">{formData.rootCause}</p>
            </div>
          </div>
          {/* Cause category selection */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-3 block">Cause Category</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(causeCategories).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setFormData({ ...formData, causeCategory: key as CauseCategory })}
                  className={cn(
                    "p-3 border rounded-lg text-left transition-all text-xs",
                    formData.causeCategory === key
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-200"
                      : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  <div className="font-semibold">{value.label}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{value.description}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Contributing factors */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-2 block">Contributing Factors</label>
            <ul className="space-y-2">
              {formData.contributing_factors.map((factor, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-300 p-3 bg-zinc-950/50 border border-zinc-800 rounded">
                  <span className="text-amber-400 shrink-0">•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Action items */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-200">Action Items ({actionItems.length})</h3>
        </div>
        <div className="p-6 space-y-4">
          {/* Existing action items */}
          {actionItems.length > 0 && (
            <div className="space-y-3 mb-6">
              {actionItems.map((item) => (
                <div key={item.id} className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-zinc-200">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                        <span>Assignee: {item.assignee}</span>
                        {item.dueDate && <span>Due: {item.dueDate}</span>}
                        <span className={cn(
                          "px-2 py-0.5 rounded",
                          item.priority === "critical"
                            ? "bg-red-500/10 text-red-400"
                            : item.priority === "high"
                              ? "bg-orange-500/10 text-orange-400"
                              : item.priority === "medium"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-zinc-700/50 text-zinc-400"
                        )}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeActionItem(item.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Add new action item form */}
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/50 space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1 block">Action Title</label>
              <input
                type="text"
                placeholder="e.g., Implement canary deployment for model updates"
                value={newActionItem.title || ""}
                onChange={(e) => setNewActionItem({ ...newActionItem, title: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1 block">Description</label>
              <textarea
                placeholder="What needs to be done?"
                value={newActionItem.description || ""}
                onChange={(e) => setNewActionItem({ ...newActionItem, description: e.target.value })}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Assignee</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={newActionItem.assignee || ""}
                  onChange={(e) => setNewActionItem({ ...newActionItem, assignee: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Due Date</label>
                <input
                  type="date"
                  value={newActionItem.dueDate || ""}
                  onChange={(e) => setNewActionItem({ ...newActionItem, dueDate: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Priority</label>
                <select
                  value={newActionItem.priority || "medium"}
                  onChange={(e) => setNewActionItem({ ...newActionItem, priority: e.target.value as Priority })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
                >
                  <option>critical</option>
                  <option>high</option>
                  <option>medium</option>
                  <option>low</option>
                </select>
              </div>
            </div>
            <button
              onClick={addActionItem}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Action Item
            </button>
          </div>
        </div>
      </div>
      {/* Submit */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsCompleted(true)}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all",
            isCompleted
              ? "bg-emerald-600 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
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
          <div className="text-sm text-emerald-400 flex items-center gap-2">
            ✓ Post-mortem has been recorded as an incident event
          </div>
        )}
      </div>
    </div>
  )
}
