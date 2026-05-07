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
};

export type IncidentsSurfaceData = {
  incidents: IncidentSurfaceItem[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
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
  metrics: ErrorMetricItem[];
  sourceErrors: string[];
  dataMode: "live" | "demo";
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
  sourceErrors: string[];
  hasTraceData: boolean;
  dataMode: "live" | "demo";
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
  metrics: DeploymentMetricItem[];
  sourceErrors: string[];
  hasDeploymentData: boolean;
  dataMode: "live" | "demo";
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
