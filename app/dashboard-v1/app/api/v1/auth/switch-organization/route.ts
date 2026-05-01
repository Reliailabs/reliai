import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { API_URL, SESSION_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: Request) {
  const body = await request.json();
  const organizationId = body.organization_id;

  if (!organizationId) {
    return NextResponse.json({ detail: "organization_id required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/switch-organization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ organization_id: organizationId }),
    });

    if (!response.ok) {
      return NextResponse.json({ detail: "Failed to switch organization" }, { status: response.status });
    }

    const session = await response.json();
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ detail: "Failed to switch organization" }, { status: 500 });
  }
}