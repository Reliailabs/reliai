import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { buildImpactPreview } from "@/lib/assisted-automation";
import { phase9ValidatorErrorResponse, withPhase9ValidatorEnvelope } from "../../_response";

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return phase9ValidatorErrorResponse(401, "unauthorized");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return phase9ValidatorErrorResponse(400, "invalid JSON body");
  }

  const result = buildImpactPreview(payload);
  if (!result.ok) {
    return NextResponse.json(withPhase9ValidatorEnvelope(result), { status: 422 });
  }

  return NextResponse.json(withPhase9ValidatorEnvelope(result), { status: 200 });
}
