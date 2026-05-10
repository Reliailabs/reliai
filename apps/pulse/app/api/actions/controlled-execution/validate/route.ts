import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateControlledExecutionRequest } from "@/lib/controlled-execution";
import { phase8ValidatorErrorResponse, withPhase8ValidatorEnvelope } from "../_response";

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return phase8ValidatorErrorResponse(401, "unauthorized");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return phase8ValidatorErrorResponse(400, "invalid JSON body");
  }

  const result = validateControlledExecutionRequest(payload);
  if (!result.ok) {
    return NextResponse.json(withPhase8ValidatorEnvelope(result), { status: 422 });
  }

  return NextResponse.json(withPhase8ValidatorEnvelope(result), { status: 200 });
}
