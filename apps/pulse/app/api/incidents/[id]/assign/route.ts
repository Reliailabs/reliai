import { NextResponse } from "next/server";
import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { incidentOwnerPath } from "@/lib/incidents-action-contract";

export type AssignResponse = {
  assignee: string;
  assigneeInitials: string;
};

function initials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { userId: string | null };

  try {
    const response = await fetch(`${API_URL}${incidentOwnerPath(id)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ owner_operator_user_id: body.userId ?? null }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "assign failed" }, { status: response.status });
    }

    const data = (await response.json()) as {
      acknowledged_by_operator_email?: string | null;
    };

    const email = data.acknowledged_by_operator_email ?? null;
    const assignee = email ?? "Unassigned";
    return NextResponse.json({
      assignee,
      assigneeInitials: email ? initials(email) : "UA",
    } satisfies AssignResponse);
  } catch {
    return NextResponse.json({ error: "assign failed" }, { status: 500 });
  }
}
