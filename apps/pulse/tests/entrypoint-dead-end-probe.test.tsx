import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MarketingPage from "@/app/(marketing)/page";
import AIReliabilityAudit from "@/app/(marketing)/ai-reliability-audit/page";
import DemoPage from "@/app/demo/page";
import SignupPage from "@/app/signup/page";

type Route = "/" | "/demo" | "/ai-reliability-audit" | "/signup";

const ENTRYPOINTS: Route[] = ["/", "/demo", "/ai-reliability-audit", "/signup"];

function extractEntrypointLinks(html: string): Set<Route> {
  const links = new Set<Route>();
  for (const route of ENTRYPOINTS) {
    if (html.includes(`href="${route}"`)) links.add(route);
  }
  return links;
}

test("phase14 dead-end probe: entrypoint graph has no dead ends and is strongly connected", () => {
  const rendered: Record<Route, string> = {
    "/": renderToStaticMarkup(<MarketingPage />),
    "/demo": renderToStaticMarkup(<DemoPage />),
    "/ai-reliability-audit": renderToStaticMarkup(<AIReliabilityAudit />),
    "/signup": renderToStaticMarkup(<SignupPage />),
  };

  const edges = new Map<Route, Set<Route>>();
  for (const route of ENTRYPOINTS) {
    const outgoing = extractEntrypointLinks(rendered[route]);
    outgoing.delete(route);
    edges.set(route, outgoing);
    assert.ok(outgoing.size > 0, `${route} has no continuity transition links to other entrypoints`);
  }

  for (const start of ENTRYPOINTS) {
    const visited = new Set<Route>();
    const queue: Route[] = [start];
    while (queue.length) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      const next = edges.get(node) ?? new Set<Route>();
      for (const target of next) {
        if (!visited.has(target)) queue.push(target);
      }
    }
    assert.equal(visited.size, ENTRYPOINTS.length, `entrypoint graph is not strongly connected from ${start}`);
  }
});
