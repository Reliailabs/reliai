import { getProjects, getPromptDiff, getPromptVersions } from "@/lib/api"
import { PromptDiffEmpty } from "./prompt-diff-empty"
import { PromptDiffView } from "./prompt-diff-view"

export default async function PromptDiffPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const projectId = Array.isArray(params.project) ? params.project[0] : params.project
  const fromVersionId = Array.isArray(params.from) ? params.from[0] : params.from
  const toVersionId = Array.isArray(params.to) ? params.to[0] : params.to

  if (!projectId || !fromVersionId || !toVersionId) {
    return <PromptDiffEmpty />
  }

  const [projectsResponse, versionsResponse, diff] = await Promise.all([
    getProjects(),
    getPromptVersions(projectId),
    getPromptDiff(fromVersionId, toVersionId),
  ])

  return (
    <PromptDiffView
      projects={projectsResponse.items}
      versions={versionsResponse.items}
      diff={diff}
      projectId={projectId}
      fromVersionId={fromVersionId}
      toVersionId={toVersionId}
    />
  )
}
