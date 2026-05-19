import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AIReliabilityAudit from "@/app/(marketing)/ai-reliability-audit/page";
import DemoPage from "@/app/demo/page";
import SignupPage from "@/app/signup/page";

test("public entrypoints keep demo/signup/audit continuity links intact", () => {
  const demoHtml = renderToStaticMarkup(<DemoPage />);
  const signupHtml = renderToStaticMarkup(<SignupPage />);
  const auditHtml = renderToStaticMarkup(<AIReliabilityAudit />);

  // /demo must provide entry into signup.
  assert.match(demoHtml, /href="\/signup"/);

  // /signup bridge must provide path back into demo and audit.
  assert.match(signupHtml, /href="\/demo"/);
  assert.match(signupHtml, /href="\/ai-reliability-audit"/);

  // /ai-reliability-audit must keep direct demo path.
  assert.match(auditHtml, /href="\/demo"/);
});

test("signup bridge preserves query context only on ownership transition target", () => {
  const html = renderToStaticMarkup(
    <SignupPage searchParams={{ utm_source: "pulse", return_to: "/demo" }} />,
  );

  // Continue target keeps query context for ownership transition.
  assert.match(html, /Destination: \/sign-in\?utm_source=pulse&amp;return_to=%2Fdemo/);
  assert.match(html, /<a href="\/sign-in\?utm_source=pulse&amp;return_to=%2Fdemo"[^>]*>Continue<\/a>/);

  // Continuity links stay canonical and intentionally do not carry signup query context.
  assert.match(html, /<a[^>]*href="\/demo"[^>]*>Review demo scenario<\/a>/);
  assert.match(html, /<a[^>]*href="\/ai-reliability-audit"[^>]*>Review audit path<\/a>/);
  assert.doesNotMatch(html, /href="\/demo\?utm_source=/);
  assert.doesNotMatch(html, /href="\/ai-reliability-audit\?utm_source=/);
});
