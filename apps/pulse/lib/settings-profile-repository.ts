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

function profileFromSession(session: Awaited<ReturnType<typeof requireOperatorSession>>): ProfileRead {
  const firstName = session.operator.first_name ?? "Operator";
  const lastName = session.operator.last_name ?? "User";
  const email = session.operator.email ?? "unknown@local";
  const role = session.memberships[0]?.role ?? "operator";

  return {
    initials: toInitials(firstName, lastName),
    firstName,
    lastName,
    email,
    role,
  };
}

async function readLiveProfile(): Promise<ProfileSurfaceRead> {
  const session = await requireOperatorSession("/settings");
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const token = await getApiAccessToken();

  if (!token) {
    return {
      profile: profileFromSession(session),
      organization: { id: orgId },
      dataMode: "live",
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
    const firstName = data.operator.first_name ?? session.operator.first_name ?? "Operator";
    const lastName = data.operator.last_name ?? session.operator.last_name ?? "User";
    const email = data.operator.email ?? session.operator.email ?? "unknown@local";
    const role = data.operator.role ?? session.memberships[0]?.role ?? "operator";

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
      profile: profileFromSession(session),
      organization: { id: orgId },
      dataMode: "live",
      sourceErrors: ["session"],
    };
  }
}

export async function getSettingsProfile(): Promise<ProfileSurfaceRead> {
  return readLiveProfile();
}


export class ProfileUpdateError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export type ProfileUpdateInput = {
  firstName: string;
  lastName: string;
};

export async function updateSettingsProfile(input: ProfileUpdateInput): Promise<ProfileSurfaceRead> {
  const session = await requireOperatorSession("/settings");
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const token = await getApiAccessToken();
  if (!token) throw new Error("missing session token");

  const response = await fetch(`${API_URL}/api/v1/auth/profile`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ first_name: input.firstName, last_name: input.lastName }),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text().catch(() => null);
    }
    throw new ProfileUpdateError("profile update failed", response.status, detail);
  }

  const payload = (await response.json()) as {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };

  const firstName = payload.first_name ?? input.firstName ?? session.operator.first_name ?? "Operator";
  const lastName = payload.last_name ?? input.lastName ?? session.operator.last_name ?? "User";
  const email = payload.email ?? session.operator.email ?? "unknown@local";

  return {
    profile: {
      initials: toInitials(firstName, lastName),
      firstName,
      lastName,
      email,
      role: "operator",
    },
    organization: { id: orgId },
    dataMode: "live",
    sourceErrors: [],
  };
}
