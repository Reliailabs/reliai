import { NextResponse } from "next/server";
import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export type IncidentLifecycleResponse = {
  status: string;
  assignee: string;
  assigneeInitials: string;
};

function initials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const response = await fetch(`${API_URL}/api/v1/incidents/${id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "resolve failed" }, { status: response.status });
    }

    const data = (await response.json()) as {
      status: string;
      acknowledged_by_operator_email?: string | null;
    };
    const email = data.acknowledged_by_operator_email ?? null;
    return NextResponse.json({
      status: data.status,
      assignee: email ?? "Unassigned",
      assigneeInitials: email ? initials(email) : "UA",
    } satisfies IncidentLifecycleResponse);
  } catch {
    return NextResponse.json({ error: "resolve failed" }, { status: 500 });
  }
}
