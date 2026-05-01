"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"
import type { ProjectRead, PromptDiffRead, PromptVersionRead } from "@reliai/types"

function DiffRenderer({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split("\n")
  const afterLines = after.split("\n")

  return (
    <div className="grid grid-cols-2 gap-4 min-h-[400px]">
      <div className="border border-zinc-800 rounded bg-zinc-950/50 overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-red-400 font-mono">before</span>
        </div>
        <div className="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
          {beforeLines.map((line, i) => (
            <div key={i} className="text-red-300/80 whitespace-pre">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-zinc-800 rounded bg-zinc-950/50 overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-400 font-mono">after</span>
        </div>
        <div className="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
          {afterLines.map((line, i) => (
            <div key={i} className="text-emerald-300/80 whitespace-pre">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UnifiedDiff({ diff }: { diff: PromptDiffRead["diff"] }) {
  return (
    <div className="border border-zinc-800 rounded bg-zinc-950/50 overflow-hidden">
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3">
        <span className="text-xs font-semibold text-zinc-400">Unified Diff</span>
      </div>
      <div className="p-4 font-mono text-sm leading-relaxed">
        {diff.map((line, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre",
              line.type === "added" && "text-emerald-300",
              line.type === "removed" && "text-red-300",
              line.type === "unchanged" && "text-zinc-500"
            )}
          >
            {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PromptDiffView({
  projects,
  versions,
  diff,
  projectId,
  fromVersionId,
  toVersionId,
}: {
  projects: ProjectRead[]
  versions: PromptVersionRead[]
  diff: PromptDiffRead
  projectId: string
  fromVersionId: string
  toVersionId: string
}) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"split" | "unified">("split")

  const versionOptions = useMemo(
    () => versions.map((v) => ({
      id: v.id,
      label: v.label ?? v.version,
      version: v.version,
    })),
    [versions]
  )

  const updateParams = (next: { projectId?: string; fromId?: string; toId?: string }) => {
    const nextProject = next.projectId ?? projectId
    const nextFrom = next.fromId ?? fromVersionId
    const nextTo = next.toId ?? toVersionId
    router.push(`/prompt-diff?project=${nextProject}&from=${nextFrom}&to=${nextTo}`)
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Prompt Diff Viewer"
        description="Compare prompt changes that led to regressions"
        right={
          <Link href="/regressions" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span className="ml-1 text-xs">Back</span>
          </Link>
        }
      />

      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Project</div>
            <select
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300"
              value={projectId}
              onChange={(e) => updateParams({ projectId: e.target.value })}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">From Version</div>
            <select
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300"
              value={fromVersionId}
              onChange={(e) => updateParams({ fromId: e.target.value })}
            >
              {versionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">To Version</div>
            <select
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300"
              value={toVersionId}
              onChange={(e) => updateParams({ toId: e.target.value })}
            >
              {versionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("split")}
          className={cn(
            "px-3 py-1.5 text-xs rounded transition-colors font-medium",
            viewMode === "split"
              ? "bg-zinc-700 text-zinc-200"
              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          )}
        >
          Split View
        </button>
        <button
          onClick={() => setViewMode("unified")}
          className={cn(
            "px-3 py-1.5 text-xs rounded transition-colors font-medium",
            viewMode === "unified"
              ? "bg-zinc-700 text-zinc-200"
              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          )}
        >
          Unified View
        </button>
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-200">Prompt Changes</h3>
        </div>
        <div className="p-6">
          {viewMode === "split" ? (
            <DiffRenderer before={diff.from_version.content} after={diff.to_version.content} />
          ) : (
            <UnifiedDiff diff={diff.diff} />
          )}
        </div>
      </div>
    </div>
  )
}
