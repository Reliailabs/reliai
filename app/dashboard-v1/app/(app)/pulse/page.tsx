import {
  getAudits,
  getDashboardChanges,
  getIncidents,
  getOrganizationEvaluationUsage,
  getOrganizationPolicies,
  getProjectDeployments,
  getProjects,
  getProjectRegressions,
  getProjectTimeline,
  getTraces,
} from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/time";
import type { PulseDecisionSummary, ReliabilityTimelineEvent } from "@reliai/types";
import type {
  AuditListResponse,
  DeploymentListResponse,
  IncidentListResponse,
  OrganizationGuardrailPolicyListResponse,
  ProjectListResponse,
  RegressionListResponse,
  TimelineResponse,
  TraceListResponse,
} from "@reliai/types";
import { PulseView, type PulseIssue } from "./pulse-view";
import { computeArei } from "@/lib/arei";

function toSeverityWeight(severity: string) {
  if (severity === "critical") return 22;
  if (severity === "high") return 14;
  if (severity === "medium") return 8;
  return 4;
}

const CORE_DATA_SOURCES = ["Incidents", "Traces", "Audits", "Projects"] as const;

type FetchResult<T> = { data: T | null; error: boolean };

async function safeFetch<T>(promise: Promise<T>): Promise<FetchResult<T>> {
  try {
    const data = await promise;
    return { data, error: false };
  } catch {
    return { data: null, error: true };
  }
}

export default async function PulsePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const demoMode = params.demo === "1";

  const session = await requireOperatorSession();
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id;

  const demoNow = new Date().toISOString();

  const [changeFeedResult, incidentsResult, tracesResult, auditsResult, projectsResult, evaluationUsageResult] = demoMode
    ? [
        { data: { changes: [] }, error: false },
        {
          data: {
            items: [
              {
                id: "demo-inc-1",
                organization_id: "demo-org",
                project_id: "demo-project-1",
                environment_id: "production",
                fingerprint: "demo-fingerprint-1",
                title: "Hallucination spike in support workflow",
                severity: "critical",
                status: "open",
                incident_type: "hallucination",
                project_name: "Customer Support Copilot",
                started_at: demoNow,
                acknowledged_at: null,
                acknowledged_by_operator_email: null,
                owner_operator_email: null,
                resolved_at: null,
                summary_json: {},
                created_at: demoNow,
                updated_at: demoNow,
              },
            ],
          } as unknown as IncidentListResponse,
          error: false,
        },
        {
          data: {
            items: [
              {
                id: "demo-trace-1",
                organization_id: "demo-org",
                project_id: "demo-project-1",
                request_id: "req-demo-1042",
                model_name: "gpt-4.1",
                timestamp: demoNow,
                created_at: demoNow,
                success: false,
                environment: "production",
                refusal_detected: false,
                prompt_version: "demo",
                latency_ms: 1200,
                prompt_tokens: 100,
                completion_tokens: 40,
              },
              {
                id: "demo-trace-2",
                organization_id: "demo-org",
                project_id: "demo-project-1",
                request_id: "req-demo-1043",
                model_name: "gpt-4.1",
                timestamp: demoNow,
                created_at: demoNow,
                success: true,
                environment: "production",
                refusal_detected: false,
                prompt_version: "demo",
                latency_ms: 800,
                prompt_tokens: 94,
                completion_tokens: 29,
              },
            ],
          } as unknown as TraceListResponse,
          error: false,
        },
        {
          data: {
            items: [
              {
                audit: {
                  id: "demo-audit-1",
                  name: "Support Agent Production Readiness",
                  target_system_name: "Support Agent",
                  updated_at: demoNow,
                },
                latest_run: {
                  status: "completed",
                  certification_status: "conditional",
                },
              },
            ],
          } as unknown as AuditListResponse,
          error: false,
        },
        {
          data: {
            items: [{ id: "demo-project-1", name: "Customer Support Copilot" }],
          } as unknown as ProjectListResponse,
          error: false,
        },
        { data: { used_today: 9 }, error: false },
      ]
    : await Promise.all([
        safeFetch(getDashboardChanges()),
        safeFetch(getIncidents({ limit: 20 })),
        safeFetch(getTraces({ limit: 20 })),
        safeFetch(getAudits({})),
        safeFetch(getProjects()),
        orgId
          ? safeFetch(getOrganizationEvaluationUsage(orgId, { window_days: 7 }))
          : Promise.resolve({ data: null, error: false }),
      ]);

  const incidents = incidentsResult.data ?? { items: [] };
  const traces = tracesResult.data ?? { items: [] };
  const audits = auditsResult.data ?? { items: [] };
  const projects = projectsResult.data ?? { items: [] };
  const evaluationUsage = evaluationUsageResult.data;
  const changeFeed = changeFeedResult.data;

  const firstProject = projects.items[0];
  const [regressionsResult, guardrailPoliciesResult, projectTimelineResult, deploymentsResult] = demoMode
    ? [
        {
          data: { items: [{ id: "demo-regression-1" }, { id: "demo-regression-2" }] } as unknown as RegressionListResponse,
          error: false,
        },
        {
          data: {
            items: [
              {
                id: "demo-policy-1",
                enabled: true,
                enforcement_mode: "warn",
                policy_type: "toxicity",
              },
            ],
          } as unknown as OrganizationGuardrailPolicyListResponse,
          error: false,
        },
        {
          data: {
            items: [
              {
                event_type: "incident_opened",
                title: "Critical incident opened",
                timestamp: demoNow,
                summary: "Unsafe output spike in support workflow",
              },
              {
                event_type: "deployment",
                title: "Model update deployed",
                timestamp: demoNow,
                summary: "gpt-4.1 rollout in production",
              },
            ],
          } as unknown as TimelineResponse,
          error: false,
        },
        {
          data: {
            items: [
              {
                id: "demo-deploy-1",
                project_id: "demo-project-1",
                created_at: demoNow,
                deployed_at: demoNow,
                environment: "production",
              },
            ],
          } as unknown as DeploymentListResponse,
          error: false,
        },
      ]
    : await Promise.all([
        firstProject
          ? safeFetch(getProjectRegressions(firstProject.id, { limit: 20 }))
          : Promise.resolve({ data: { items: [] }, error: false }),
        orgId
          ? safeFetch(getOrganizationPolicies(orgId))
          : Promise.resolve({ data: { items: [] }, error: false }),
        firstProject
          ? safeFetch(getProjectTimeline(firstProject.id, { limit: 25 }))
          : Promise.resolve({ data: { items: [] }, error: false }),
        firstProject
          ? safeFetch(getProjectDeployments(firstProject.id))
          : Promise.resolve({ data: { items: [] }, error: false }),
      ]);

  const regressions = regressionsResult.data ?? { items: [] };
  const guardrailPolicies = guardrailPoliciesResult.data ?? { items: [] };
  const projectTimeline = projectTimelineResult.data ?? { items: [] };
  const deployments = deploymentsResult.data ?? { items: [] };

  const now = Date.now();
  const openIncidents = incidents.items.filter((item) => item.status !== "resolved");
  const criticalOpen = openIncidents.filter((item) => item.severity === "critical").length;
  const highOpen = openIncidents.filter((item) => item.severity === "high").length;
  const failedEvals = evaluationUsage?.used_today ?? 0;
  const regressionDetections = regressions.items.length;
  const highRiskOutputs = traces.items.filter((trace) => !trace.success).length;

  const arei = computeArei({
    incidents: incidents.items,
    traces: traces.items,
    regressions: regressions.items,
    guardrails: guardrailPolicies.items,
    audits: audits.items,
    deployments: deployments.items,
  });

  const issues: PulseIssue[] = [
    {
      id: "incidents",
      title: `${criticalOpen + highOpen} open high-severity incidents`,
      severity: (criticalOpen > 0 ? "critical" : highOpen > 0 ? "high" : "medium") as PulseIssue["severity"],
      reason: "Ongoing customer-impact risk across active incident queue.",
      impact: "Customer-facing reliability degraded",
      href: "/incidents",
    },
    {
      id: "regressions",
      title: `${regressionDetections} regression detections`,
      severity: (regressionDetections > 2 ? "high" : "medium") as PulseIssue["severity"],
      reason: "Behavior drift signals were detected after recent changes.",
      impact: "Compliance readiness and model stability at risk",
      href: "/deployments",
    },
    {
      id: "outputs",
      title: `${highRiskOutputs} high-risk outputs in latest traces`,
      severity: (highRiskOutputs > 5 ? "high" : "medium") as PulseIssue["severity"],
      reason: "Unsafe or failed outputs were observed in recent traffic.",
      impact: "Trust and guardrail posture weakening",
      href: "/traces",
    },
  ].sort((a, b) => toSeverityWeight(b.severity) - toSeverityWeight(a.severity));

  const recommendation =
    issues[0]?.id === "incidents"
      ? {
          title: "Contain active incidents before new rollout",
          href: "/incidents",
          cta: "Investigate incidents",
        }
      : issues[0]?.id === "regressions"
        ? {
            title: "Validate latest deployment against regression signals",
            href: "/deployments",
            cta: "Review deployments",
          }
        : {
            title: "Inspect high-risk outputs and tighten guardrails",
            href: "/traces",
            cta: "Review traces",
          };

  const timeline: ReliabilityTimelineEvent[] = [
    ...(changeFeed?.changes ?? []).map((change) => ({
      id: `change-${change.id}`,
      type: (change.kind.includes("deploy") ? "deployment" : "audit") as ReliabilityTimelineEvent["type"],
      title: change.summary,
      occurred_at: change.created_at,
      impact: change.related_incident_count
        ? `${change.related_incident_count} linked incidents`
        : "Operational change recorded",
      href: change.path || "/deployments",
    })),
    ...projectTimeline.items.slice(0, 10).map((item, index) => ({
      id: `timeline-${index}-${item.timestamp}`,
      type: (
        item.event_type.includes("regression")
          ? "regression"
          : item.event_type.includes("incident")
            ? "incident"
            : "deployment"
      ) as ReliabilityTimelineEvent["type"],
      title: item.title,
      occurred_at: item.timestamp,
      impact: item.summary,
      href: "/metrics",
    })),
    ...audits.items.slice(0, 5).map((item) => ({
      id: `audit-${item.audit.id}`,
      type: "audit" as const,
      title: `${item.audit.name} certification ${item.latest_run?.certification_status ?? "pending"}`,
      occurred_at: item.audit.updated_at,
      impact: item.latest_run?.status ?? "active",
      href: `/audits`,
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 12);

  const hasData =
    incidents.items.length > 0 || traces.items.length > 0 || audits.items.length > 0 || regressions.items.length > 0;

  const dataErrors = [
    ["Incidents", incidentsResult.error],
    ["Traces", tracesResult.error],
    ["Audits", auditsResult.error],
    ["Projects", projectsResult.error],
    ["Regressions", regressionsResult.error],
    ["Policies", guardrailPoliciesResult.error],
    ["Timeline", projectTimelineResult.error],
    ["Deployments", deploymentsResult.error],
  ]
    .filter(([, failed]) => failed)
    .map(([label]) => label as string);
  const sourcesHealthy = CORE_DATA_SOURCES.every((source) => !dataErrors.includes(source));

  const decision: PulseDecisionSummary = {
    risk_level: arei.band === "elevated" ? "high" : arei.band,
    at_risk: arei.band === "critical" || arei.band === "elevated",
    at_risk_reason: arei.topDrivers[0] ?? "Reliability exposure increased based on recent production signals.",
    why_it_matters:
      "Unchecked reliability exposure can lead to unsafe outputs, customer incidents, and delayed compliance decisions.",
    topDrivers: arei.topDrivers,
    recommendedActions: arei.recommendedActions,
    top_issues: issues,
    recommended_action: recommendation,
    arei: {
      score: arei.score,
      delta: arei.trend,
      breakdown: [
        { label: "Failure Risk", value: arei.components.failureRisk },
        { label: "Incident Risk", value: arei.components.incidentRisk },
        { label: "Drift Risk", value: arei.components.driftRisk },
        { label: "Guardrail Risk", value: arei.components.guardrailRisk },
        { label: "Audit Readiness Gap", value: arei.components.auditReadinessGap },
        { label: "Production Criticality", value: arei.components.productionCriticality },
      ],
    },
  };

  return (
    <PulseView
      now={now}
      decision={decision}
      timeline={timeline}
      setupState={{
        has_data: hasData || !sourcesHealthy,
        checklist: [
          { key: "connect", label: "Connect your AI system", complete: projects.items.length > 0, href: "/settings" },
          { key: "audit", label: "Run reliability audit", complete: audits.items.length > 0, href: "/audits" },
          { key: "guardrails", label: "Enable guardrails", complete: guardrailPolicies.items.length > 0, href: "/guardrails" },
          { key: "traces", label: "Ingest traces", complete: traces.items.length > 0, href: "/traces" },
        ],
        demo_mode: demoMode,
      }}
      quickStats={{
        compliance_readiness: audits.items.filter((item) => item.latest_run?.certification_status === "pass").length,
        high_risk_outputs: highRiskOutputs,
        model_drift_events: regressionDetections,
        failed_evals: failedEvals,
      }}
      recentIncidents={incidents.items.slice(0, 5)}
      riskyTraces={traces.items.filter((trace) => !trace.success).slice(0, 5)}
      latestAudit={audits.items[0] ?? null}
      deploymentSummary={{
        total: deployments.items.length,
        latest: deployments.items[0] ?? null,
        regressionDetections,
      }}
      formatRelative={(value) => formatRelativeTime(value, now)}
      dataMode={demoMode ? "demo" : "live"}
      dataErrors={dataErrors}
      trendAvailable={typeof arei.trend === "number"}
    />
  );
}
