import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { SettingsSurfaceData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type SessionRead = {
  operator: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    role?: string | null;
    is_system_admin?: boolean;
  };
};

type AlertTargetRead = {
  enabled: boolean;
  target_type?: string | null;
};

async function apiRequest<T>(path: string): Promise<T> {
  const token = await getApiAccessToken();
  if (!token) throw new Error("missing session token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`api request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function safeFetch<T>(promise: Promise<T>): Promise<FetchResult<T>> {
  try {
    return { data: await promise, error: false };
  } catch {
    return { data: null, error: true };
  }
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? "R"}${lastName[0] ?? "L"}`.toUpperCase();
}

export async function getSettingsSurfaceData(organizationId: string | null): Promise<SettingsSurfaceData> {
  const sourceErrors: string[] = [];
  const sessionResult = await safeFetch(apiRequest<SessionRead>("/api/v1/auth/session"));
  if (sessionResult.error) sourceErrors.push("session");

  const alertResult =
    organizationId
      ? await safeFetch(
          apiRequest<AlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target`),
        )
      : ({ data: null, error: false } as FetchResult<AlertTargetRead>);
  if (alertResult.error) sourceErrors.push("alert-target");

  const firstName = sessionResult.data?.operator.first_name ?? "Reliai";
  const lastName = sessionResult.data?.operator.last_name ?? "Operator";
  const email = sessionResult.data?.operator.email ?? "operator@reliai.dev";
  const role = sessionResult.data?.operator.role ?? "operator";
  const alertEnabled = Boolean(alertResult.data?.enabled);
  const isSystemAdmin = Boolean(sessionResult.data?.operator.is_system_admin);

  return {
    profile: {
      initials: initials(firstName, lastName),
      firstName,
      lastName,
      email,
      role,
    },
    quickItems: [
      { id: "appearance", label: "Appearance", description: "Customize dashboard layout and theme behavior", status: "mapped", href: "/settings#appearance", visibility: "all" },
      { id: "integrations", label: "Integrations", description: "Connect incident, alerting, and workflow tools", status: "mapped", href: "/settings#integrations", visibility: "admin" },
      { id: "security", label: "Security", description: "Control authentication and access settings", status: "mapped", href: "/settings#security", visibility: "admin" },
      { id: "project", label: "Project Settings", description: "Project profile, slug, and configuration", status: "partial", href: "/settings#project", visibility: "admin" },
      { id: "organization", label: "Organization Settings", description: "Manage tenant profile and environment defaults", status: "partial", href: "/settings#organization", visibility: "admin" },
      { id: "members", label: "Members", description: "Manage members and role assignments", status: "partial", href: "/settings#members", visibility: "admin" },
      { id: "alerts", label: "Alert Settings", description: "Configure alert targets and escalation policies", status: "mapped", href: "/settings#alerts", visibility: "admin" },
      { id: "notifications", label: "Notifications", description: "Configure personal delivery preferences", status: "stub", href: "/settings#notifications", visibility: "all" },
      { id: "services", label: "Services / Systems", description: "Service ownership and environment policy controls", status: "stub", href: "/settings#services", visibility: "admin" },
      { id: "pipeline", label: "Pipeline", description: "Ingestion pipeline health", status: "mapped", href: "/pulse/system/pipeline", visibility: "system_admin" },
      { id: "extensions", label: "Extensions", description: "Processor extensions", status: "mapped", href: "/pulse/system/extensions", visibility: "system_admin" },
      { id: "customers", label: "Customers", description: "Customer expansion", status: "partial", href: "/pulse/system/customers", visibility: "system_admin" },
      { id: "growth", label: "Growth", description: "Tenant growth", status: "partial", href: "/pulse/system/growth", visibility: "system_admin" },
      { id: "expansion", label: "Expansion", description: "Expansion metrics", status: "partial", href: "/pulse/system/expansion", visibility: "system_admin" },
      { id: "platform", label: "Platform", description: "Platform reliability", status: "mapped", href: "/pulse/system/platform", visibility: "system_admin" },
      { id: "reliability", label: "Reliability", description: "System-level patterns", status: "stub", href: "/pulse/system/reliability-patterns", visibility: "system_admin" },
      { id: "intelligence", label: "Intelligence", description: "Reliability intelligence", status: "stub", href: "/pulse/system/intelligence", visibility: "system_admin" },
    ].filter((item) => {
      if (item.visibility === "all") return true;
      if (item.visibility === "admin") return true;
      if (item.visibility === "system_admin") return isSystemAdmin;
      return true;
    }),
    integrations: [
      { name: "Alert Target", connected: alertEnabled, icon: "AT", statusLabel: alertEnabled ? "Connected" : "Not configured" },
      { name: "Datadog", connected: false, icon: "DD", statusLabel: "Planned" },
      { name: "Email", connected: false, icon: "E", statusLabel: "Planned" },
      { name: "Jira", connected: false, icon: "J", statusLabel: "Planned" },
      { name: "Slack", connected: false, icon: "S", statusLabel: "Planned" },
      { name: "PagerDuty", connected: false, icon: "PD", statusLabel: "Planned" },
      { name: "GitHub", connected: false, icon: "GH", statusLabel: "Planned" },
    ],
    sourceErrors: Array.from(new Set(sourceErrors)),
    hasSettingsData: true,
    dataMode: "live",
  };
}
