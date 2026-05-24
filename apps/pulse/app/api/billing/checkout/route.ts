import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

const checkoutSchema = z.object({
  organization_id: z.string().min(1),
  plan: z.enum(["team", "production"])
});

export async function POST(request: Request) {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  const activeOrgId = session?.active_organization_id ?? null;
  if (!token || !activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawPayload = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (parsed.data.organization_id !== activeOrgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const response = await fetch(`${API_URL}/api/v1/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(parsed.data)
  });

  const json = await response.json().catch(() => ({}));
  return NextResponse.json(json, { status: response.status });
}
