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
