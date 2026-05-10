export type PulseMetricCard = {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
};

export type PulseIncidentItem = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  duration: string;
  assignee: string;
};

export type PulseTimelinePoint = {
  time: string;
  requests: number;
  errors: number;
};

export type PulseActivityItem = {
  id: string;
  type: "incident" | "deploy";
  title: string;
  time: string;
  status: "active" | "success" | "resolved";
};

export type PulseOverviewData = {
  metrics: PulseMetricCard[];
  activeIncidents: PulseIncidentItem[];
  timelinePoints: PulseTimelinePoint[];
  areiScore: number;
  areiDelta: number | null;
  recentActivity: PulseActivityItem[];
  dataMode: "live" | "demo";
  sourceErrors: string[];
};

export type CausalityConfidence = "insufficient" | "low" | "medium" | "high";

export type CausalityEvidenceLink = {
  label: string;
  href: string;
};

export type CausalityEvidenceItem = {
  id: string;
  title: string;
  summary: string;
  confidence: CausalityConfidence;
  evidenceWindow: string;
  observedBeforeDegradation: string;
  requiresOperatorReview: true;
  links: CausalityEvidenceLink[];
};

export type CausalityEvidenceData = {
  items: CausalityEvidenceItem[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
};

export type AttributionSuggestion = {
  id: string;
  title: string;
  suggestion: string;
  reason: string;
  confidence: CausalityConfidence;
  requiresOperatorReview: true;
  links: CausalityEvidenceLink[];
};

export type AttributionSuggestionData = {
  items: AttributionSuggestion[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
};

export type ServiceStatus = "healthy" | "degraded" | "down" | "maintenance";

export type ServiceCard = {
  name: string;
  description: string;
  status: ServiceStatus;
  version: string;
  uptime: string;
  requests: string;
  errorRate: string;
  latency: string;
  team: string;
  repo: string;
  lastDeploy: string;
};

export type ServicesSurfaceData = {
  services: ServiceCard[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
};

export type IncidentSurfaceStatus = "investigating" | "mitigating" | "monitoring" | "resolved";

export type IncidentTimelineEntry = {
  time: string;
  event: string;
  type: "alert" | "notification" | "action";
};

export type IncidentSurfaceItem = {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: IncidentSurfaceStatus;
  duration: string;
  assignee: string;
  assigneeInitials: string;
  impactedServices: string[];
  timeline: IncidentTimelineEntry[];
  intelligence: {
    contributingFactors: string[];
    confidence: "insufficient" | "low" | "medium" | "high";
    evidenceLinks: Array<{ label: string; href: string }>;
    requiresOperatorReview: true;
  };
};

export type IncidentsSurfaceData = {
  incidents: IncidentSurfaceItem[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
};

export type IncidentRouteContext = {
  selectedIncidentId: string | null;
};

export type ErrorTrendPoint = {
  time: string;
  errors: number;
  rate: number;
};

export type ErrorFunnelStage = {
  stage: string;
  count: number;
  percentage: number;
};

export type ErrorTopItem = {
  id: string;
  type: string;
  message: string;
  count: number;
  change: string;
  trend: "up" | "down";
  service: string;
  lastSeen: string;
};

export type ErrorMetricItem = {
  label: string;
  value: string;
  change: string;
  good: boolean;
};

export type ErrorsSurfaceData = {
  errorTrend: ErrorTrendPoint[];
  funnelData: ErrorFunnelStage[];
  topErrors: ErrorTopItem[];
  intelligenceSnippets: ErrorIntelligenceSnippet[];
  metrics: ErrorMetricItem[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
};

export type ErrorIntelligenceSnippet = {
  id: string;
  title: string;
  confidence: "insufficient" | "low" | "medium" | "high";
  contributingFactors: string[];
  evidenceLinks: Array<{ label: string; href: string }>;
  requiresOperatorReview: true;
};

export type TraceTrendPoint = {
  time: string;
  p50: number;
  p95: number;
  p99: number;
};

export type TraceThroughputPoint = {
  time: string;
  rps: number;
};

export type TraceMetricItem = {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  good: boolean;
};

export type TraceServiceLatency = {
  name: string;
  p50: number;
  p95: number;
  p99: number;
  status: "healthy" | "degraded";
};

export type TracesSurfaceData = {
  latencyData: TraceTrendPoint[];
  throughputData: TraceThroughputPoint[];
  metrics: TraceMetricItem[];
  serviceLatencies: TraceServiceLatency[];
  intelligenceSnippets: TraceIntelligenceSnippet[];
  sourceErrors: string[];
  hasTraceData: boolean;
  dataMode: "live" | "demo";
  traceRefs?: Array<{
    id: string;
    requestId: string;
    comparePath?: string | null;
    graphPath?: string | null;
  }>;
};

export type TraceRouteContextMode = "list" | "detail" | "compare" | "graph";

export type TraceRouteContext = {
  selectedTraceId: string | null;
  mode: TraceRouteContextMode;
};

export type TraceIntelligenceSnippet = {
  id: string;
  title: string;
  confidence: "insufficient" | "low" | "medium" | "high";
  observedContributingFactors: string[];
  relatedOperationalSignals: string[];
  evidenceReferences: Array<{ label: string; href: string }>;
  requiresOperatorReview: true;
};

export type DeploymentFrequencyPoint = {
  day: string;
  deploys: number;
};

export type DeploymentMetricItem = {
  label: string;
  value: string;
  change: string;
};

export type DeploymentStatus = "success" | "failed" | "rollback";

export type DeploymentSurfaceItem = {
  id: string;
  service: string;
  version: string;
  status: DeploymentStatus;
  environment: string;
  duration: string;
  timestamp: string;
  author: string;
  authorInitials: string;
  commit: string;
  commitHash: string;
};

export type DeploymentsSurfaceData = {
  deploymentFrequency: DeploymentFrequencyPoint[];
  deployments: DeploymentSurfaceItem[];
  deploymentRefs?: Array<{
    id: string;
    detailPath: string;
  }>;
  metrics: DeploymentMetricItem[];
  sourceErrors: string[];
  hasDeploymentData: boolean;
  dataMode: "live" | "demo";
};

export type DeploymentRouteContextMode = "list" | "detail";

export type DeploymentRouteContext = {
  selectedDeploymentId: string | null;
  mode: DeploymentRouteContextMode;
};

export type ProjectRouteContextMode =
  | "overview"
  | "incidents"
  | "audits"
  | "traces"
  | "deployments"
  | "guardrails"
  | "metrics";

export type ProjectRouteContext = {
  projectId: string;
  mode: ProjectRouteContextMode;
};

export type ProjectControlParityData = {
  projectId: string;
  projectName: string;
  auditCertificationStatus: string | null;
  auditRiskScore: number | null;
  openCriticalFindings: number | null;
  openBlockingFindings: number | null;
  certificationAtRisk: boolean;
  certificationRiskReason: string | null;
  latestAuditId: string | null;
  latestAuditCompletedAt: string | null;
  sourceErrors: string[];
};

export type AuditResponseTrendPoint = {
  week: string;
  ack: number;
  resolve: number;
};

export type AuditScheduleItem = {
  name: string;
  initials: string;
  role: string;
  shift: string;
  status: "active" | "standby" | "upcoming";
};

export type AuditRecentItem = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  acknowledged: boolean;
  ackTime: string;
  assignee: string;
  timestamp: string;
  resolved: boolean;
};

export type AuditMetricItem = {
  label: string;
  value: string;
  change: string;
  good: boolean;
};

export type AuditsSurfaceData = {
  responseTimeData: AuditResponseTrendPoint[];
  currentSchedule: AuditScheduleItem[];
  recentPages: AuditRecentItem[];
  metrics: AuditMetricItem[];
  sourceErrors: string[];
  hasAuditData: boolean;
  dataMode: "live" | "demo";
};

export type AuditRouteContextMode = "list" | "detail" | "results" | "new";

export type AuditRouteContext = {
  selectedAuditId: string | null;
  mode: AuditRouteContextMode;
};

export type GuardrailUptimePoint = {
  day: string;
  uptime: number;
};

export type GuardrailMetricItem = {
  label: string;
  value: string;
  target: string;
  status: "met" | "at_risk";
};

export type GuardrailServiceStatus = {
  name: string;
  uptime: number;
  target: number;
  incidents: number;
  downtime: string;
  status: "operational" | "degraded";
};

export type GuardrailOutageItem = {
  id: string;
  service: string;
  duration: string;
  impact: string;
  date: string;
  resolved: boolean;
};

export type GuardrailsSurfaceData = {
  uptimeHistory: GuardrailUptimePoint[];
  slaMetrics: GuardrailMetricItem[];
  services: GuardrailServiceStatus[];
  recentOutages: GuardrailOutageItem[];
  sourceErrors: string[];
  hasGuardrailData: boolean;
  dataMode: "live" | "demo";
};

export type OncallResponseTrendPoint = {
  week: string;
  ack: number;
  resolve: number;
};

export type OncallScheduleItem = {
  name: string;
  initials: string;
  role: string;
  shift: string;
  status: "active" | "standby" | "upcoming";
};

export type OncallPageItem = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  acknowledged: boolean;
  ackTime: string;
  assignee: string;
  timestamp: string;
  resolved: boolean;
};

export type OncallMetricItem = {
  label: string;
  value: string;
  change: string;
  good: boolean;
};

export type OncallSurfaceData = {
  responseTimeData: OncallResponseTrendPoint[];
  currentSchedule: OncallScheduleItem[];
  recentPages: OncallPageItem[];
  metrics: OncallMetricItem[];
  sourceErrors: string[];
  hasOncallData: boolean;
  dataMode: "live" | "demo";
};

export type PostmortemItem = {
  id: string;
  title: string;
  incident: string;
  severity: "critical" | "high" | "medium" | "low";
  duration: string;
  date: string;
  author: string;
  authorInitials: string;
  status: "published" | "draft";
  impact: string;
  rootCause: string;
  actionItems: number;
  completedItems: number;
  tags: string[];
};

export type PostmortemMetricItem = {
  label: string;
  value: string;
  period: string;
};

export type PostmortemsSurfaceData = {
  postmortems: PostmortemItem[];
  metrics: PostmortemMetricItem[];
  sourceErrors: string[];
  hasPostmortemData: boolean;
  dataMode: "live" | "demo";
};

export type SettingsQuickItem = {
  id: string;
  label: string;
  description: string;
  status: "mapped" | "partial" | "stub";
  href: string;
  visibility?: "all" | "admin" | "system_admin";
};

export type SettingsIntegrationItem = {
  id: string;
  name: string;
  connected: boolean;
  icon: string;
  statusLabel: string;
  href?: string;
};

export type SettingsProfile = {
  initials: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export type SettingsSurfaceData = {
  profile: SettingsProfile;
  quickItems: SettingsQuickItem[];
  integrations: SettingsIntegrationItem[];
  sourceErrors: string[];
  hasSettingsData: boolean;
  dataMode: "live" | "demo";
};
