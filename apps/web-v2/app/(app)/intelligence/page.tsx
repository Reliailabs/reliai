import { getIntelligenceGlobalPatterns, getIntelligenceModels, getIntelligencePrompts, getIntelligenceGuardrails } from "@/lib/api"
import { requireOperatorSession } from "@/lib/auth"
import { IntelligenceView } from "./intelligence-view"

export default async function IntelligencePage() {
  await requireOperatorSession()

  const [globalPatterns, models, prompts, guardrails] = await Promise.all([
    getIntelligenceGlobalPatterns().catch(() => null),
    getIntelligenceModels().catch(() => null),
    getIntelligencePrompts().catch(() => null),
    getIntelligenceGuardrails().catch(() => null),
  ])

  return (
    <IntelligenceView
      globalPatterns={globalPatterns}
      models={models}
      prompts={prompts}
      guardrails={guardrails}
    />
  )
}