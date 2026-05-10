export const PHASE8_VALIDATOR_RESPONSE_CONTRACT = {
  contract_version: "phase8-v1",
  mode: "validation_only",
  execution_granted: false,
} as const;

export type Phase8ValidatorEnvelope = typeof PHASE8_VALIDATOR_RESPONSE_CONTRACT;

export type Phase8ValidatorResult<T extends object> = Phase8ValidatorEnvelope & T;

export type Phase8ValidatorErrorPayload = {
  ok: false;
  errors: string[];
  warnings: string[];
};

export function withPhase8ValidatorEnvelope<T extends object>(payload: T): Phase8ValidatorResult<T> {
  return {
    ...PHASE8_VALIDATOR_RESPONSE_CONTRACT,
    ...payload,
  };
}

export function phase8ValidatorError(message: string): Phase8ValidatorResult<Phase8ValidatorErrorPayload> {
  return withPhase8ValidatorEnvelope({
    ok: false as const,
    errors: [message],
    warnings: [],
  });
}
