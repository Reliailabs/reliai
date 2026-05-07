import type {
  AreiComputation,
  AuditListItemRead,
  DeploymentRead,
  IncidentListItemRead,
  OrganizationGuardrailPolicyRead,
  RegressionSnapshotRead,
  TraceListItemRead,
} from "@reliai/types";

export type AreiBand = "low" | "moderate" | "elevated" | "critical";

export interface ComputeAreiInput {
  incidents?: IncidentListItemRead[];
  traces?: TraceListItemRead[];
  regressions?: RegressionSnapshotRead[];
  guardrails?: OrganizationGuardrailPolicyRead[];
  audits?: AuditListItemRead[];
  deployments?: DeploymentRead[];
  previousScore?: number;
}

function cap(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function bandFor(score: number): AreiBand {
  if (score <= 24) return "low";
  if (score <= 49) return "moderate";
  if (score <= 74) return "elevated";
  return "critical";
}

export function computeArei(input: ComputeAreiInput): AreiComputation {
  const incidents = input.incidents ?? [];
  const traces = input.traces ?? [];
  const regressions = input.regressions ?? [];
  const guardrails = input.guardrails ?? [];
  const audits = input.audits ?? [];
  const deployments = input.deployments ?? [];

  const criticalIncidents = incidents.filter((i) => i.status === "open" && i.severity === "critical").length;
  const highIncidents = incidents.filter((i) => i.status === "open" && i.severity === "high").length;
  const openIncidents = incidents.filter((i) => i.status === "open").length;

  const failedTraces = traces.filter((t) => !t.success).length;
  const traceFailureRate = traces.length > 0 ? failedTraces / traces.length : 0;

  const enabledGuardrails = guardrails.filter((g) => g.enabled).length;
  const blockingGuardrails = guardrails.filter(
    (g) => g.enabled && (g.enforcement_mode === "enforce" || g.enforcement_mode === "block"),
  ).length;

  const incompleteAuditRuns = audits.reduce(
    (acc, item) => acc + (item.latest_run ? Number(item.latest_run.status !== "completed") : 0),
    0,
  );
  const passedAudits = audits.filter((a) => a.latest_run?.certification_status === "pass").length;

  const failureRisk = cap(Math.round(traceFailureRate * 30) + (failedTraces >= 10 ? 5 : 0), 25);
  const incidentRisk = cap(criticalIncidents * 9 + highIncidents * 5 + (openIncidents >= 6 ? 4 : 0), 20);

  const hasRecentDeployment = deployments.length > 0;
  const driftBase = regressions.length * 4 + (regressions.length >= 3 ? 3 : 0);
  const driftRisk = cap(driftBase + (hasRecentDeployment && regressions.length > 0 ? 3 : 0), 15);

  const guardrailRisk = cap(
    enabledGuardrails === 0
      ? 15
      : Math.max(0, 10 - blockingGuardrails * 3) + (blockingGuardrails === 0 ? 5 : 0),
    15,
  );

  const auditReadinessGap = cap(
    audits.length === 0
      ? 15
      : incompleteAuditRuns * 4 + (passedAudits === 0 ? 5 : 0),
    15,
  );

  const productionCriticality = cap(
    (criticalIncidents > 0 ? 6 : 0) + (hasRecentDeployment ? 2 : 0) + (openIncidents > 0 ? 2 : 0),
    10,
  );

  const total = cap(
    failureRisk + incidentRisk + driftRisk + guardrailRisk + auditReadinessGap + productionCriticality,
    100,
  );

  const components = {
    failureRisk,
    incidentRisk,
    driftRisk,
    guardrailRisk,
    auditReadinessGap,
    productionCriticality,
  };

  const sorted = Object.entries(components)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value > 0)
    .slice(0, 3);

  const topDrivers = sorted.map(([key, value]) => {
    if (key === "failureRisk") return `Failure risk from ${failedTraces} failed traces (${value}/25).`;
    if (key === "incidentRisk") return `Incident risk from ${openIncidents} open incidents (${value}/20).`;
    if (key === "driftRisk") return `Drift risk from ${regressions.length} regressions${hasRecentDeployment ? " after deployment changes" : ""} (${value}/15).`;
    if (key === "guardrailRisk") return `Guardrail risk from ${enabledGuardrails} enabled policies (${value}/15).`;
    if (key === "auditReadinessGap") return `Audit readiness gap from ${incompleteAuditRuns} incomplete runs (${value}/15).`;
    return `Production criticality from live incident/deployment context (${value}/10).`;
  });

  if (traces.length === 0) topDrivers.push("Trace signals missing; failure risk is inferred conservatively.");
  if (audits.length === 0) topDrivers.push("Audit signals missing; readiness gap is inferred as elevated.");

  const recommendedActions: string[] = [];
  if (incidentRisk >= 10) recommendedActions.push("Investigate open incidents with severity high/critical and contain affected workflows.");
  if (failureRisk >= 12) recommendedActions.push("Review failed traces and harden prompts or guardrails on impacted endpoints.");
  if (driftRisk >= 8) recommendedActions.push("Compare recent deployments against regression events and rollback if needed.");
  if (guardrailRisk >= 8) recommendedActions.push("Increase guardrail enforcement coverage for unsafe output categories.");
  if (auditReadinessGap >= 8) recommendedActions.push("Complete pending audit runs and resolve certification blockers before release.");
  if (recommendedActions.length === 0) {
    recommendedActions.push("Maintain current controls and continue monitoring trend changes.");
  }

  return {
    score: total,
    band: bandFor(total),
    trend: typeof input.previousScore === "number" ? total - input.previousScore : undefined,
    components,
    topDrivers,
    recommendedActions,
  };
}
