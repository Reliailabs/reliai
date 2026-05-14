import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = await getApiAccessToken();
  if (!token) return NextResponse.json({ detail: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    projectName?: string;
    modelName?: string;
    promptType?: string;
    simulationType?: string;
  };

  const upstream = await fetch(`${API_URL}/api/v1/onboarding/simulations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      simulation_type: body.simulationType?.trim() || "refusal_spike",
      project_name: body.projectName?.trim() || undefined,
      model_name: body.modelName?.trim() || undefined,
      prompt_type: body.promptType?.trim() || undefined,
    }),
    cache: "no-store",
  });

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}
