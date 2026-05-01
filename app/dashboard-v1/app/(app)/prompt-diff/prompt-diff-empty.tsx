import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"

export function PromptDiffEmpty() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Prompt Diff Viewer"
        description="Compare prompt changes that led to regressions"
      />
      <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <div className="text-sm text-zinc-200">Select a project and two prompt versions.</div>
        <div className="text-xs text-zinc-500 mt-2">
          Use <span className="font-mono">?project=&lt;id&gt;&amp;from=&lt;versionId&gt;&amp;to=&lt;versionId&gt;</span> in the URL.
        </div>
        <div className="mt-4 text-xs text-zinc-500">
          Need version IDs? Start from{" "}
          <Link href="/projects" className="text-zinc-300 underline underline-offset-2">
            Projects
          </Link>
          .
        </div>
      </div>
    </div>
  )
}
