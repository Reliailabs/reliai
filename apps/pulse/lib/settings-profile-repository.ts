import "server-only";

import { getApiAccessToken, requireOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export type ProfileRead = {
  initials: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export type ProfileSurfaceRead = {
  profile: ProfileRead;
  organization: { id: string | null };
  dataMode: "live" | "demo";
  sourceErrors: string[];
};

type SessionRead = {
  operator: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

function toInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? "R"}${lastName[0] ?? "L"}`.toUpperCase();
}

function fallbackProfile(): ProfileRead {
  return {
    initials: "RO",
    firstName: "Reliai",
    lastName: "Operator",
    email: "operator@reliai.dev",
    role: "operator",
  };
}

async function readLiveProfile(): Promise<ProfileSurfaceRead> {
  const session = await requireOperatorSession("/settings");
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const token = await getApiAccessToken();

  if (!token) {
    return {
      profile: fallbackProfile(),
      organization: { id: orgId },
      dataMode: "demo",
      sourceErrors: ["missing-session-token"],
    };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`session ${response.status}`);
    }

    const data = (await response.json()) as SessionRead;
    const firstName = data.operator.first_name ?? "Reliai";
    const lastName = data.operator.last_name ?? "Operator";
    const email = data.operator.email ?? "operator@reliai.dev";
    const role = data.operator.role ?? "operator";

    return {
      profile: {
        initials: toInitials(firstName, lastName),
        firstName,
        lastName,
        email,
        role,
      },
      organization: { id: orgId },
      dataMode: "live",
      sourceErrors: [],
    };
  } catch {
    return {
      profile: fallbackProfile(),
      organization: { id: orgId },
      dataMode: "demo",
      sourceErrors: ["session"],
    };
  }
}

export async function getSettingsProfile(): Promise<ProfileSurfaceRead> {
  return readLiveProfile();
}
