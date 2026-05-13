import { NextResponse } from "next/server";
import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export type IncidentMember = {
  userId: string;
  email: string;
};

export type IncidentMembersResponse = {
  items: IncidentMember[];
};

export async function GET() {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  if (!token || !session) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const orgId = session.active_organization_id;
  if (!orgId) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/organizations/${orgId}/members`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const data = (await response.json()) as { items: Array<{ user_id: string; email: string | null }> };
    const items: IncidentMember[] = (data.items ?? [])
      .filter((m) => m.email)
      .map((m) => ({ userId: m.user_id, email: m.email! }));

    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
