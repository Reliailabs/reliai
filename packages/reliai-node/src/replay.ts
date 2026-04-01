import { getDefaultClient, type ReliaiClient } from "./client";

export interface ReliaiReplayStep {
  span_id: string;
  parent_span_id: string | null;
  span_name: string | null;
  span_type: string;
  inputs: Record<string, unknown> | null;
  template: string | null;
  variables: Record<string, unknown> | null;
  model: string | null;
  parameters: Record<string, unknown> | null;
  prompt: string | null;
  tool_name: string | null;
  guardrail_policy: string | null;
  guardrail_action: string | null;
}

export interface ReliaiReplayPayload {
  trace_id: string;
  project_id: string;
  environment: string;
  steps: ReliaiReplayStep[];
}

export class ReliaiReplayPipeline {
  constructor(readonly payload: ReliaiReplayPayload) {}

  run(): ReliaiReplayPayload {
    return this.payload;
  }
}

export async function replay(traceId: string, client: ReliaiClient = getDefaultClient()): Promise<ReliaiReplayPipeline> {
  const payload = await client.requestJson<ReliaiReplayPayload>(`/api/v1/traces/${traceId}/replay`);
  return new ReliaiReplayPipeline(payload);
}
