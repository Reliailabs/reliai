import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SignupPage from "@/app/signup/page";

test("signup surface exposes explicit continuity paths", () => {
  const html = renderToStaticMarkup(<SignupPage searchParams={{ utm_source: "pulse" }} />);

  assert.match(html, /Continue to account setup/);
  assert.match(html, /Review demo scenario/);
  assert.match(html, /Review audit path/);
  assert.match(html, /Back to product/);

  assert.match(html, /href="\/demo"/);
  assert.match(html, /href="\/ai-reliability-audit"/);
  assert.match(html, /href="\//);
});

test("signup surface shows contextual team invite handoff when entry is team-invite", () => {
  const html = renderToStaticMarkup(
    <SignupPage searchParams={{ entry: "team-invite", email: "invitee@company.com" }} />,
  );

  assert.match(html, /Team invite handoff/);
  assert.match(html, /invitee@company.com/);
  assert.match(html, /Continue with account creation for invitee@company.com/);
});
