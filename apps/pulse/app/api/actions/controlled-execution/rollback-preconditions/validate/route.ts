import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateRollbackPreconditions } from "@/lib/controlled-execution";
import { phase8ValidatorError, withPhase8ValidatorEnvelope } from "../../_response";

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return NextResponse.json(
      phase8ValidatorError("unauthorized"),
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      phase8ValidatorError("invalid JSON body"),
      { status: 400 },
    );
  }

  const result = validateRollbackPreconditions(payload);
  if (!result.ok) {
    return NextResponse.json(withPhase8ValidatorEnvelope(result), { status: 422 });
  }

  return NextResponse.json(withPhase8ValidatorEnvelope(result), { status: 200 });
}
