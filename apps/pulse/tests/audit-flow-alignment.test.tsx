import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AIReliabilityAudit from "@/app/(marketing)/ai-reliability-audit/page";

test("ai-reliability-audit CTA contract aligns copy with /demo behavior", () => {
  const html = renderToStaticMarkup(<AIReliabilityAudit />);

  assert.match(html, /Run the demo scenario to preview the audit path\./);
  assert.match(html, /Run demo scenario/);
  assert.match(html, /Open demo scenario/);
  assert.doesNotMatch(html, /Book a 20-minute call/);

  const demoHrefMatches = html.match(/href=\"\/demo\"/g) ?? [];
  assert.ok(demoHrefMatches.length >= 2);

  // Guard semantic drift: hero CTA label must resolve to the demo route.
  assert.match(html, /<a href="\/demo"[^>]*>Run demo scenario<\/a>/);
  assert.doesNotMatch(html, /<a href="(?!\/demo)[^"]*"[^>]*>Run demo scenario<\/a>/);

  // Guard semantic drift: final CTA label must resolve to the demo route.
  assert.match(html, /<a href="\/demo"[^>]*>Open demo scenario<\/a>/);
  assert.doesNotMatch(html, /<a href="(?!\/demo)[^"]*"[^>]*>Open demo scenario<\/a>/);
});
