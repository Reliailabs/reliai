import { NextResponse } from "next/server";
import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  if (!token || !session?.active_organization_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const orgId = session.active_organization_id;

  try {
    const response = await fetch(`${API_URL}/api/v1/organizations/${orgId}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (response.status === 403) {
      const body = (await response.json()) as { upgrade_prompt?: string };
      return NextResponse.json({ error: "plan_gate", upgrade_prompt: body.upgrade_prompt ?? null }, { status: 403 });
    }
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ error: "remove_failed" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "remove_failed" }, { status: 500 });
  }
}
