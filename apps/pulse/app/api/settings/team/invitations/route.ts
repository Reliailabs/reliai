import { NextResponse } from "next/server";
import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

type InvitationBody = {
  email?: string;
  role?: string;
};

type BackendInvitation = {
  id: string;
  organization_id: string;
  invited_email: string;
  role: string;
  invited_by_user_id: string;
  invited_by_email: string;
  status: string;
  signup_path: string;
  expires_at: string;
  created_at: string;
};

function mapInvitation(invitation: BackendInvitation) {
  return {
    id: invitation.id,
    invitedEmail: invitation.invited_email,
    role: invitation.role,
    invitedByEmail: invitation.invited_by_email,
    status: invitation.status,
    signupPath: invitation.signup_path,
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
  };
}

async function resolveOrganization() {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  if (!token || !session?.active_organization_id) {
    return null;
  }
  return { token, organizationId: session.active_organization_id };
}

export async function GET() {
  const auth = await resolveOrganization();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/organizations/${auth.organizationId}/invitations`, {
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (response.status === 403) {
      const body = (await response.json()) as { upgrade_prompt?: unknown };
      return NextResponse.json({ error: "plan_gate", upgrade_prompt: body.upgrade_prompt ?? null }, { status: 403 });
    }
    if (!response.ok) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    const payload = (await response.json()) as { items?: BackendInvitation[] };
    return NextResponse.json({ items: (payload.items ?? []).map(mapInvitation) });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const auth = await resolveOrganization();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as InvitationBody;
  if (!body.email || !body.role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/organizations/${auth.organizationId}/invitations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: body.email, role: body.role }),
      cache: "no-store",
    });

    if (response.status === 403) {
      const payload = (await response.json()) as { upgrade_prompt?: unknown };
      return NextResponse.json({ error: "plan_gate", upgrade_prompt: payload.upgrade_prompt ?? null }, { status: 403 });
    }
    if (response.status === 409) {
      return NextResponse.json({ error: "invite_pending" }, { status: 409 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: "invite_failed" }, { status: response.status });
    }
    return NextResponse.json(mapInvitation((await response.json()) as BackendInvitation), { status: 201 });
  } catch {
    return NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }
}
