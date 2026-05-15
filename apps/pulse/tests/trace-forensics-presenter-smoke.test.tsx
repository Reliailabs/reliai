import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TraceForensicsPanel, type TraceForensicsViewModel } from "@/components/dashboard/content/performance-content";

const baseForensics: TraceForensicsViewModel = {
  detail: {
    traceId: "tr_1",
    requestId: "req_1",
    success: true,
    latencyMs: 120,
    environment: "prod",
    createdAt: "2026-05-14T00:00:00Z",
    modelName: "gpt-x",
    promptVersion: "v1",
    errorType: null,
    comparePath: "/traces/tr_1/compare",
    payloadTruncated: false,
  },
  findings: [{ label: "Slowest step", detail: "Retriever · 80 ms" }],
  compare: { changedBlockCount: 2, totalBlockCount: 5, baselineTraceId: "tr_base", baselineRequestId: "req_base" },
  graph: { nodeCount: 16, edgeCount: 22, environment: "prod" },
};

test("detail mode renders metadata and findings", () => {
  const html = renderToStaticMarkup(
    <TraceForensicsPanel mode="detail" forensics={baseForensics} forensicsError={null} />,
  );
  assert.match(html, /req_1/);
  assert.match(html, /Latency 120 ms/);
  assert.match(html, /Slowest step/);
});

test("compare mode renders changed\/total and baseline reference", () => {
  const html = renderToStaticMarkup(
    <TraceForensicsPanel mode="compare" forensics={baseForensics} forensicsError={null} />,
  );
  assert.match(html, /Changed blocks: 2\/5/);
  assert.match(html, /Baseline tr_base/);
});

test("graph mode renders node\/edge summary", () => {
  const html = renderToStaticMarkup(
    <TraceForensicsPanel mode="graph" forensics={baseForensics} forensicsError={null} />,
  );
  assert.match(html, /Graph nodes: 16 · edges: 22/);
});
