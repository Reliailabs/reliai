import assert from "node:assert/strict";
import test from "node:test";

import { mapTraceForensicsPresenter } from "@/lib/trace-forensics-mapper";

test("maps trace detail/analysis/compare/graph contract fields into presenter shape", () => {
  const mapped = mapTraceForensicsPresenter({
    detail: {
      trace_id: "tr_1",
      request_id: "req_1",
      success: false,
      latency_ms: 321,
      environment: "prod",
      created_at: "2026-05-14T00:00:00Z",
      model_name: "gpt-x",
      prompt_version: "v2",
      error_type: "timeout",
      compare_path: "/traces/tr_1/compare",
      payload_truncated: true,
    },
    analysis: {
      slowest_span: { span_id: "s1", span_name: "Retriever", latency_ms: 210 },
      largest_token_span: { span_id: "s2", span_name: "Generator", token_count: 980 },
      most_guardrail_retries: { span_id: "s3", guardrail_policy: "policy-a", retry_count: 3 },
    },
    compare: {
      pairs: [
        {
          diff_blocks: [{ changed: true }, { changed: false }, { changed: true }],
          baseline_trace: { id: "tr_base", request_id: "req_base" },
        },
      ],
    },
    graph: {
      trace_id: "tr_1",
      environment: "prod",
      nodes: [{}, {}, {}],
      edges: [{}, {}],
    },
  });

  assert.equal(mapped.detail.traceId, "tr_1");
  assert.equal(mapped.detail.payloadTruncated, true);
  assert.equal(mapped.findings.length, 3);
  assert.equal(mapped.compare?.changedBlockCount, 2);
  assert.equal(mapped.compare?.totalBlockCount, 3);
  assert.equal(mapped.compare?.baselineTraceId, "tr_base");
  assert.equal(mapped.graph?.nodeCount, 3);
  assert.equal(mapped.graph?.edgeCount, 2);
});

test("handles missing optional compare/graph/analysis data without introducing derived logic", () => {
  const mapped = mapTraceForensicsPresenter({
    detail: {
      trace_id: "tr_2",
      request_id: "req_2",
      success: true,
    },
    analysis: null,
    compare: null,
    graph: null,
  });

  assert.equal(mapped.detail.traceId, "tr_2");
  assert.equal(mapped.findings.length, 0);
  assert.equal(mapped.compare, null);
  assert.equal(mapped.graph, null);
});
