import { NextResponse } from "next/server";
import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

async function resolveOrganization() {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  if (!token || !session?.active_organization_id) {
    return null;
  }
  return { token, organizationId: session.active_organization_id };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const auth = await resolveOrganization();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { invitationId } = await params;
  try {
    const response = await fetch(
      `${API_URL}/api/v1/organizations/${auth.organizationId}/invitations/${invitationId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        cache: "no-store",
      },
    );

    if (response.status === 403) {
      const payload = (await response.json()) as { upgrade_prompt?: unknown };
      return NextResponse.json({ error: "plan_gate", upgrade_prompt: payload.upgrade_prompt ?? null }, { status: 403 });
    }
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ error: "revoke_failed" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }
}
