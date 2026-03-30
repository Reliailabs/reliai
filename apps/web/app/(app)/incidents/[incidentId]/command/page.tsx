import { notFound } from "next/navigation";

import type { AiIncidentSummaryRequest, AiIncidentSummaryResponse } from "@reliai/types";

import { IncidentCommandCenterView } from "@/components/presenters/incident-command-center-view";
import { CohortDiffView } from "@/components/presenters/cohort-diff-view";
import { PromptDiffView } from "@/components/presenters/prompt-diff-view";
import {
  generateIncidentAiSummary,
  getIncidentCommandCenter,
  getIncidentTraceCompare,
  getProjectRecommendations,
} from "@/lib/api";

const VALID_TABS = ["overview", "cohort-diff", "prompt-diff", "traces"] as const;
type Tab = typeof VALID_TABS[number];

function findSuggestedFix(
  recommendations: Awaited<ReturnType<typeof getProjectRecommendations>>,
  incidentType: string,
  metricName: string | null,
) {
  return (
    recommendations.find((recommendation) => {
      const relatedIncidentTypes = Array.isArray(recommendation.evidence_json.related_incident_types)
        ? recommendation.evidence_json.related_incident_types
        : [];
      const recommendationMetric =
        typeof recommendation.evidence_json.metric_name === "string"
          ? recommendation.evidence_json.metric_name
          : null;
      return (
        relatedIncidentTypes.includes(incidentType) ||
        (metricName !== null && recommendationMetric === metricName)
      );
    }) ?? null
  );
}

export default async function IncidentCommandCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { incidentId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = VALID_TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "overview";

  const command = await getIncidentCommandCenter(incidentId).catch(() => null);
  if (!command) {
    notFound();
  }

  const incident = command.incident;

  if (tab === "cohort-diff" || tab === "prompt-diff" || tab === "traces") {
    const comparison = await getIncidentTraceCompare(incidentId).catch(() => null);

    if (tab === "cohort-diff") {
      return (
        <CohortDiffView
          incidentId={incidentId}
          incident={incident}
          comparison={comparison}
          activeTab={tab}
        />
      );
    }

    if (tab === "prompt-diff") {
      return (
        <PromptDiffView
          incidentId={incidentId}
          incident={incident}
          comparison={comparison}
          activeTab={tab}
        />
      );
    }

    // "traces" tab — redirect to existing compare page
    if (tab === "traces") {
      return (
        <CohortDiffView
          incidentId={incidentId}
          incident={incident}
          comparison={comparison}
          activeTab={tab}
        />
      );
    }
  }

  const recommendations = await getProjectRecommendations(incident.project_id).catch(() => []);
  const suggestedFix = findSuggestedFix(
    recommendations,
    incident.incident_type,
    typeof incident.summary_json.metric_name === "string" ? incident.summary_json.metric_name : null,
  );

  const aiSummaryAction = async (
    payload: AiIncidentSummaryRequest
  ): Promise<AiIncidentSummaryResponse> => {
    "use server";
    return generateIncidentAiSummary(incidentId, payload);
  };

  return (
    <IncidentCommandCenterView
      incidentId={incidentId}
      command={command}
      activeTab="overview"
      aiSummaryAction={aiSummaryAction}
      suggestedFix={
        suggestedFix
          ? {
              title: suggestedFix.title,
              description: suggestedFix.description,
            }
          : null
      }
    />
  );
}
