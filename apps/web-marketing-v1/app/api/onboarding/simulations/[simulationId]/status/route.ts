import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ simulationId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  const { simulationId } = await context.params;
  const simulationIdTrimmed = simulationId.trim();

  if (!simulationIdTrimmed) {
    return NextResponse.json({ detail: "simulationId is required" }, { status: 400 });
  }

  const upstream = await fetch(
    `${API_URL}/api/v1/onboarding/simulations/${encodeURIComponent(simulationIdTrimmed)}/status`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}
