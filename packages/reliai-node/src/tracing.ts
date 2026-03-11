export interface ReliaiRetrievalSpan {
  retrievalLatencyMs?: number;
  sourceCount?: number;
  topK?: number;
  queryText?: string;
  retrievedChunks?: Array<Record<string, unknown>>;
}

export interface ReliaiTraceEvent {
  timestamp?: Date | string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string | null;
  spanName?: string;
  startTime?: Date | string;
  durationMs?: number;
  environment?: string;
  userId?: string;
  sessionId?: string;
  model: string;
  provider?: string;
  promptVersion?: string;
  input?: string;
  output?: string | null;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalCostUsd?: number;
  success?: boolean;
  errorType?: string;
  metadata?: Record<string, unknown> | null;
  retrieval?: ReliaiRetrievalSpan | null;
}
