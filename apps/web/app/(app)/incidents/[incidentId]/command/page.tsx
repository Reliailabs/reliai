import { notFound } from "next/navigation";

import { IncidentCommandCenterView } from "@/components/presenters/incident-command-center-view";
import { getIncidentCommandCenter, getProjectRecommendations } from "@/lib/api";

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
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const command = await getIncidentCommandCenter(incidentId).catch(() => null);

  if (!command) {
    notFound();
  }

  const incident = command.incident;
  const recommendations = await getProjectRecommendations(incident.project_id).catch(() => []);
  const suggestedFix = findSuggestedFix(
    recommendations,
    incident.incident_type,
    typeof incident.summary_json.metric_name === "string" ? incident.summary_json.metric_name : null,
  );

  return (
    <IncidentCommandCenterView
      incidentId={incidentId}
      command={command}
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
