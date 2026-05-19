import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AIReliabilityAudit from "@/app/(marketing)/ai-reliability-audit/page";
import DemoPage from "@/app/demo/page";
import SignupPage from "@/app/signup/page";

test("public entrypoint triad stays connected without dead ends", () => {
  const demoHtml = renderToStaticMarkup(<DemoPage />);
  const auditHtml = renderToStaticMarkup(<AIReliabilityAudit />);
  const signupHtml = renderToStaticMarkup(<SignupPage />);

  // /demo offers both audit and signup paths.
  assert.match(demoHtml, /href="\/ai-reliability-audit"/);
  assert.match(demoHtml, /href="\/signup"/);

  // /ai-reliability-audit offers demo and signup paths.
  assert.match(auditHtml, /href="\/demo"/);
  assert.match(auditHtml, /href="\/signup"/);

  // /signup offers demo and audit paths.
  assert.match(signupHtml, /href="\/demo"/);
  assert.match(signupHtml, /href="\/ai-reliability-audit"/);
});
