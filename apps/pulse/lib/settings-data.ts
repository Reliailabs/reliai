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

  return {
    profile: {
      initials: initials(firstName, lastName),
      firstName,
      lastName,
      email,
      role,
    },
    quickItems: [
      { id: "appearance", label: "Appearance", description: "Customize dashboard layout and theme behavior", status: "mapped" },
      { id: "integrations", label: "Integrations", description: "Connect incident, alerting, and workflow tools", status: "mapped" },
      { id: "security", label: "Security", description: "Control authentication and access settings", status: "mapped" },
      { id: "organization", label: "Organization", description: "Manage tenant profile and environment defaults", status: "partial" },
      { id: "members", label: "Members", description: "Manage members and role assignments", status: "partial" },
      { id: "services", label: "Services", description: "Define service ownership and environment policies", status: "stub" },
      { id: "alerts", label: "Alerts", description: "Configure alert rules and escalation policies", status: "stub" },
      { id: "notifications", label: "Notifications", description: "Configure personal delivery preferences", status: "stub" },
      { id: "system", label: "System Admin", description: "Elevated admin controls and operator policies", status: "stub" },
    ],
    integrations: [
      { name: "Alert Target", connected: alertEnabled, icon: "AT", statusLabel: alertEnabled ? "Connected" : "Not configured" },
      { name: "Slack", connected: false, icon: "S", statusLabel: "Planned" },
      { name: "PagerDuty", connected: false, icon: "PD", statusLabel: "Planned" },
      { name: "GitHub", connected: false, icon: "GH", statusLabel: "Planned" },
    ],
    sourceErrors: Array.from(new Set(sourceErrors)),
    hasSettingsData: true,
    dataMode: "live",
  };
}
