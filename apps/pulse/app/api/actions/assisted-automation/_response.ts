import { NextResponse } from "next/server";

export const PHASE9_VALIDATOR_RESPONSE_CONTRACT = {
  contract_version: "phase9-v1",
  mode: "validation_only",
  execution_granted: false,
} as const;

export type Phase9ValidatorEnvelope = typeof PHASE9_VALIDATOR_RESPONSE_CONTRACT;
export type Phase9ValidatorResult<T extends object> = Phase9ValidatorEnvelope & T;

type Phase9ValidatorErrorPayload = {
  ok: false;
  errors: string[];
  warnings: string[];
};

export function withPhase9ValidatorEnvelope<T extends object>(payload: T): Phase9ValidatorResult<T> {
  return {
    ...PHASE9_VALIDATOR_RESPONSE_CONTRACT,
    ...payload,
  };
}

export function phase9ValidatorError(message: string): Phase9ValidatorResult<Phase9ValidatorErrorPayload> {
  return withPhase9ValidatorEnvelope({
    ok: false as const,
    errors: [message],
    warnings: [],
  });
}

export function phase9ValidatorErrorResponse(status: 400 | 401, message: string) {
  return NextResponse.json(phase9ValidatorError(message), { status });
}
