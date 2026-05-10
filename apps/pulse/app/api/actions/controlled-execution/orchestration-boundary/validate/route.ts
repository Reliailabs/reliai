import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateOrchestrationBoundary } from "@/lib/controlled-execution";

export async function POST(request: Request) {
  const session = await getOperatorSession();
  if (!session) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "invalid JSON body" }, { status: 400 });
  }

  const result = validateOrchestrationBoundary(payload);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result, { status: 200 });
}
