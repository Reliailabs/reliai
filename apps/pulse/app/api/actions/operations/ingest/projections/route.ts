import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { getRecentLifecycleIntents, getRecentVerificationIntents } from "@/lib/operations-ingest-projections";
import { phase13ErrorResponse, withPhase13Envelope } from "../../_response";

export async function GET() {
  const session = await getOperatorSession();
  if (!session) {
    return phase13ErrorResponse(401, "unauthorized");
  }

  return NextResponse.json(
    withPhase13Envelope({
      ok: true as const,
      lifecycle_intents: getRecentLifecycleIntents(10),
      verification_intents: getRecentVerificationIntents(10),
    }),
    { status: 200 },
  );
}
