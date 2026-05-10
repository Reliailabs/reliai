export const PHASE8_VALIDATOR_RESPONSE_CONTRACT = {
  contract_version: "phase8-v1",
  mode: "validation_only",
  execution_granted: false,
} as const;

export function withPhase8ValidatorEnvelope<T extends object>(payload: T) {
  return {
    ...PHASE8_VALIDATOR_RESPONSE_CONTRACT,
    ...payload,
  };
}
