import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface OnboardingSimulationCreateBody {
  projectName?: string;
  modelName?: string;
  promptType?: string;
  simulationType?: string;
}

export async function POST(request: Request) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as OnboardingSimulationCreateBody;
  const simulationType =
    typeof body.simulationType === "string" && body.simulationType.trim().length > 0
      ? body.simulationType.trim()
      : "refusal_spike";
  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : undefined;
  const modelName = typeof body.modelName === "string" ? body.modelName.trim() : undefined;
  const promptType = typeof body.promptType === "string" ? body.promptType.trim() : undefined;

  const upstream = await fetch(`${API_URL}/api/v1/onboarding/simulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      simulation_type: simulationType,
      project_name: projectName || undefined,
      model_name: modelName || undefined,
      prompt_type: promptType || undefined,
    }),
    cache: "no-store",
  });

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}
