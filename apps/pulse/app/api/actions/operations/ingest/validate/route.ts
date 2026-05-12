import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateOperationsEventIngest } from "@/lib/operations-ingest";
import { checkOperationsEventDuplicate, recordOperationsEventFingerprint } from "@/lib/operations-ingest-dedup";
import { phase13ErrorResponse, withPhase13Envelope } from "../../_response";

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return phase13ErrorResponse(401, "unauthorized");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return phase13ErrorResponse(400, "invalid JSON body");
  }

  const result = validateOperationsEventIngest(payload);
  if (!result.ok) {
    return NextResponse.json(withPhase13Envelope(result), { status: 422 });
  }

  const dedup = checkOperationsEventDuplicate(
    result.event_fingerprint,
    result.request.idempotency_key,
    result.request_shape_hash,
  );
  if (dedup.status === "accepted_duplicate") {
    return NextResponse.json(
      withPhase13Envelope({
        ok: true as const,
        ingest_accepted: true as const,
        response_class: "accepted_duplicate" as const,
        warnings: ["duplicate replay accepted"],
        duplicate_of_event_id: dedup.record.eventId,
        event_fingerprint: result.event_fingerprint,
        request_shape_hash: result.request_shape_hash,
      }),
      { status: 200 },
    );
  }
  if (dedup.status === "rejected_idempotency") {
    return NextResponse.json(
      withPhase13Envelope({
        ok: false as const,
        ingest_accepted: false as const,
        response_class: "rejected_idempotency" as const,
        errors: ["idempotency key replay with changed event semantics"],
        warnings: [],
        duplicate_of_event_id: dedup.record.eventId,
        event_fingerprint: result.event_fingerprint,
      }),
      { status: 409 },
    );
  }

  recordOperationsEventFingerprint(
    result.event_fingerprint,
    result.request.idempotency_key,
    result.request_shape_hash,
    result.request.event_id,
  );

  return NextResponse.json(withPhase13Envelope(result), { status: 200 });
}
