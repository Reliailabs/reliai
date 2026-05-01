import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ simulationId: string }> }
) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  const { simulationId } = await params;
  const upstream = await fetch(
    `${API_URL}/api/v1/onboarding/simulations/${encodeURIComponent(simulationId)}/status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}