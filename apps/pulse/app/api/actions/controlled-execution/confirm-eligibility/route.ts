import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";
import { validateControlledExecutionConfirmation } from "@/lib/controlled-execution";

const RESPONSE_CONTRACT = {
  contract_version: "phase8-v1",
  mode: "validation_only",
  execution_granted: false,
} as const;

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

  const result = validateControlledExecutionConfirmation(payload);
  if (!result.ok) {
    return NextResponse.json({ ...RESPONSE_CONTRACT, ...result }, { status: 422 });
  }

  return NextResponse.json({ ...RESPONSE_CONTRACT, ...result }, { status: 200 });
}
