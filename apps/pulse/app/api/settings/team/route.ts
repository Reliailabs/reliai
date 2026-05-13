import { NextResponse } from "next/server";
import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
};

export type TeamResponse = {
  items: TeamMember[];
  organizationId: string | null;
};

async function resolveOrgId(): Promise<{ token: string; orgId: string } | null> {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  if (!token || !session?.active_organization_id) return null;
  return { token, orgId: session.active_organization_id };
}

export async function GET() {
  const auth = await resolveOrgId();
  if (!auth) return NextResponse.json({ items: [], organizationId: null }, { status: 200 });

  try {
    const response = await fetch(`${API_URL}/api/v1/organizations/${auth.orgId}/members`, {
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (response.status === 403) {
      const body = (await response.json()) as { upgrade_prompt?: string };
      return NextResponse.json({ error: "plan_gate", upgrade_prompt: body.upgrade_prompt ?? null }, { status: 403 });
    }
    if (!response.ok) return NextResponse.json({ items: [], organizationId: auth.orgId }, { status: 200 });

    const data = (await response.json()) as {
      items: Array<{ user_id: string; display_name: string | null; email: string | null; role: string; created_at: string }>;
    };
    const items: TeamMember[] = (data.items ?? []).map((m) => ({
      userId: m.user_id,
      name: m.display_name ?? (m.email?.split("@")[0] ?? "Unknown Member"),
      email: m.email ?? "(no email)",
      role: m.role,
      joinedAt: m.created_at,
    }));

    return NextResponse.json({ items, organizationId: auth.orgId } satisfies TeamResponse);
  } catch {
    return NextResponse.json({ items: [], organizationId: null }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const auth = await resolveOrgId();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as { name?: string; email?: string; role?: string };
  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
  }

  // Step 1 — resolve email → user_id
  const lookupResponse = await fetch(
    `${API_URL}/api/v1/operators/lookup?email=${encodeURIComponent(body.email.trim().toLowerCase())}`,
    {
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      cache: "no-store",
    },
  );

  if (lookupResponse.status === 404) {
    return NextResponse.json({ error: "no_account", message: "No Reliai account found for that email address." }, { status: 404 });
  }
  if (!lookupResponse.ok) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }

  const { user_id } = (await lookupResponse.json()) as { user_id: string };

  // Step 2 — add to org
  const addResponse = await fetch(`${API_URL}/api/v1/organizations/${auth.orgId}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, role: body.role, display_name: body.name.trim() }),
    cache: "no-store",
  });

  if (addResponse.status === 403) {
    const errBody = (await addResponse.json()) as { upgrade_prompt?: string };
    return NextResponse.json({ error: "plan_gate", upgrade_prompt: errBody.upgrade_prompt ?? null }, { status: 403 });
  }
  if (!addResponse.ok) {
    return NextResponse.json({ error: "add_failed" }, { status: addResponse.status });
  }

  const member = (await addResponse.json()) as { user_id: string; display_name: string | null; email: string | null; role: string; created_at: string };
  return NextResponse.json({
    userId: member.user_id,
    name: member.display_name ?? body.name.trim(),
    email: member.email ?? body.email,
    role: member.role,
    joinedAt: member.created_at,
  } satisfies TeamMember, { status: 201 });
}
