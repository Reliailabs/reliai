"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Clock, User, CheckCircle, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

interface AuditEvent {
  id: string
  incidentId: string
  incidentTitle: string
  project: string
  eventType: "acknowledged" | "resolved" | "assigned" | "commented" | "escalated"
  operator: string
  operatorEmail: string
  timestamp: string
  details: {
    previousValue?: string
    newValue?: string
    comment?: string
  }
}

// Mock audit events from incident_events table
const auditEvents: AuditEvent[] = [
  {
    id: "evt1",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "acknowledged",
    operator: "Sarah Chen",
    operatorEmail: "sarah.chen@reliai.io",
    timestamp: "2024-01-15T14:32:00Z",
    details: {},
  },
  {
    id: "evt2",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "assigned",
    operator: "Marcus Johnson",
    operatorEmail: "marcus.johnson@reliai.io",
    timestamp: "2024-01-15T14:45:00Z",
    details: {
      previousValue: "Unassigned",
      newValue: "Marcus Johnson",
    },
  },
  {
    id: "evt3",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "commented",
    operator: "Marcus Johnson",
    operatorEmail: "marcus.johnson@reliai.io",
    timestamp: "2024-01-15T15:20:00Z",
    details: {
      comment: "Investigating model drift. Token distribution has changed significantly. Rolling back to previous version.",
    },
  },
  {
    id: "evt4",
    incidentId: "inc124",
    incidentTitle: "API Latency Spike",
    project: "sentiment-analyzer",
    eventType: "acknowledged",
    operator: "Elena Rodriguez",
    operatorEmail: "elena.rodriguez@reliai.io",
    timestamp: "2024-01-15T13:15:00Z",
    details: {},
  },
  {
    id: "evt5",
    incidentId: "inc124",
    incidentTitle: "API Latency Spike",
    project: "sentiment-analyzer",
    eventType: "escalated",
    operator: "Elena Rodriguez",
    operatorEmail: "elena.rodriguez@reliai.io",
    timestamp: "2024-01-15T13:45:00Z",
    details: {
      previousValue: "P3",
      newValue: "P1",
    },
  },
  {
    id: "evt6",
    incidentId: "inc123",
    incidentTitle: "High Error Rate in Sentiment-Analyzer",
    project: "sentiment-analyzer",
    eventType: "resolved",
    operator: "Marcus Johnson",
    operatorEmail: "marcus.johnson@reliai.io",
    timestamp: "2024-01-15T16:10:00Z",
    details: {
      comment: "Rolled back to v0.9.2. Error rate returned to baseline. All tests passing.",
    },
  },
  {
    id: "evt7",
    incidentId: "inc125",
    incidentTitle: "Cost Budget Exceeded",
    project: "data-processor",
    eventType: "acknowledged",
    operator: "James Park",
    operatorEmail: "james.park@reliai.io",
    timestamp: "2024-01-15T12:00:00Z",
    details: {},
  },
]

type EventType = AuditEvent["eventType"]

const eventConfig: Record<EventType, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  acknowledged: {
    label: "Acknowledged",
    color: "text-blue-400",
    icon: CheckCircle,
  },
  resolved: {
    label: "Resolved",
    color: "text-emerald-400",
    icon: CheckCircle,
  },
  assigned: {
    label: "Assigned",
    color: "text-purple-400",
    icon: User,
  },
  commented: {
    label: "Comment",
    color: "text-zinc-400",
    icon: Clock,
  },
  escalated: {
    label: "Escalated",
    color: "text-orange-400",
    icon: AlertTriangle,
  },
}

export default function AuditLogPage() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedProject, setSelectedProject] = useState<string | "all">("all")

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  // Get unique projects for filter
  const projects = ["all", ...new Set(auditEvents.map(e => e.project))]

  // Filter events by project
  const filteredEvents = selectedProject === "all"
    ? auditEvents
    : auditEvents.filter(e => e.project === selectedProject)

  // Sort by timestamp descending
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all incident operations and changes across projects"
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Project:</span>
            <div className="flex gap-2">
              {projects.map((project) => (
                <button
                  key={project}
                  onClick={() => setSelectedProject(project)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded transition-colors font-medium",
                    selectedProject === project
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  )}
                >
                  {project === "all" ? "All Projects" : project}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-medium text-zinc-200">
            {sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""}
          </h3>
        </div>

        <div className="divide-y divide-zinc-800">
          {sortedEvents.map((event) => {
            const isExpanded = expandedRows.has(event.id)
            const EventIcon = eventConfig[event.eventType].icon

            return (
              <div key={event.id} className="bg-zinc-950/50">
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                  onClick={() => toggleRow(event.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <EventIcon className={cn("w-4 h-4", eventConfig[event.eventType].color)} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-zinc-200">
                          {event.incidentTitle}
                        </span>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider",
                          eventConfig[event.eventType].color
                        )}>
                          {eventConfig[event.eventType].label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        <span className="font-medium">{event.operator}</span>
                        {" "}
                        <span>({event.operatorEmail})</span>
                      </p>
                    </div>

                    <div className="text-right text-xs text-zinc-500">
                      <div>{new Date(event.timestamp).toLocaleDateString()}</div>
                      <div>{new Date(event.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-4 border-t border-zinc-800/50">
                    <div className="pt-4 space-y-3">
                      <div>
                        <span className="text-xs text-zinc-500">Incident ID:</span>
                        <span className="ml-2 text-xs font-mono text-zinc-300">{event.incidentId}</span>
                      </div>

                      {event.details.previousValue && (
                        <div>
                          <span className="text-xs text-zinc-500">Change:</span>
                          <span className="ml-2 text-xs text-zinc-300">
                            {event.details.previousValue}
                            {" "}
                            <span className="text-zinc-500">→</span>
                            {" "}
                            {event.details.newValue}
                          </span>
                        </div>
                      )}

                      {event.details.comment && (
                        <div>
                          <span className="text-xs text-zinc-500">Comment:</span>
                          <p className="text-xs text-zinc-300 mt-1 bg-zinc-800/30 p-2 rounded border border-zinc-800">
                            {event.details.comment}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
