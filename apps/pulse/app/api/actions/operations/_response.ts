import { NextResponse } from "next/server";

export const PHASE13_INGEST_CONTRACT = {
  contract_version: "phase13-v1",
  mode: "validation_only",
  execution_granted: false,
} as const;

type Envelope = typeof PHASE13_INGEST_CONTRACT;
type Result<T extends object> = Envelope & T;

export function withPhase13Envelope<T extends object>(payload: T): Result<T> {
  return {
    ...PHASE13_INGEST_CONTRACT,
    ...payload,
  };
}

export function phase13ErrorResponse(status: 400 | 401, message: string) {
  return NextResponse.json(
    withPhase13Envelope({
      ok: false as const,
      ingest_accepted: false as const,
      create_accepted: false as const,
      transition_accepted: false as const,
      verification_write_accepted: false as const,
      errors: [message],
      warnings: [],
    }),
    { status },
  );
}
