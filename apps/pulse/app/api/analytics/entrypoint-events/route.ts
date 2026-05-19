import { NextResponse } from "next/server";

import type { EntrypointAnalyticsEvent } from "@/lib/entrypoint-analytics";
import { normalizeEntrypointEvent } from "@/lib/entrypoint-evidence";
import { getEntrypointEvidenceStoreAdapter } from "@/lib/entrypoint-evidence-store";

type RequestBody = {
  event?: EntrypointAnalyticsEvent;
  event_time_utc?: string;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.event) {
    return NextResponse.json({ ok: false, error: "missing_event" }, { status: 400 });
  }

  try {
    const eventTimeUTC = body.event_time_utc ?? new Date().toISOString();
    const normalized = normalizeEntrypointEvent(body.event, eventTimeUTC);
    const store = getEntrypointEvidenceStoreAdapter();
    await store.append(normalized);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_event";
    const isClientError =
      message.startsWith("unknown_event:") || message.startsWith("unknown_route:") || message === "invalid_event_time_utc";
    return NextResponse.json({ ok: false, error: message }, { status: isClientError ? 400 : 503 });
  }
}
