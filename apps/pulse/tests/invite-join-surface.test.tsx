import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import JoinPage from "@/app/join/page";

test("join surface renders invitation details and accept action", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({
      id: "inv-123",
      organization_name: "Gamma AI",
      invited_email: "joiner@gamma.test",
      role: "member",
      invited_by_email: "owner@gamma.test",
      status: "pending",
      join_path: "/join?token=abc123",
      expires_at: "2026-05-22T12:00:00.000Z",
      created_at: "2026-05-21T12:00:00.000Z",
    }),
  })) as typeof fetch;

  try {
    const html = renderToStaticMarkup(
      await JoinPage({ searchParams: Promise.resolve({ token: "abc123", return_to: "/settings#team" }) }),
    );

    assert.match(html, /Accept team invitation/);
    assert.match(html, /Gamma AI/);
    assert.match(html, /joiner@gamma.test/);
    assert.match(html, /owner@gamma.test/);
    assert.match(html, /Create account and join/);
    assert.match(html, /action="\/api\/invitations\/abc123\/accept"/);
    assert.match(html, /Returns to \/settings#team/);
    assert.match(html, /href="\/signup\?entry=team-invite&amp;email=joiner%40gamma\.test"/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("join surface maps not_found error to explicit invitation-not-found copy", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: false,
  })) as typeof fetch;

  try {
    const html = renderToStaticMarkup(
      await JoinPage({ searchParams: Promise.resolve({ token: "missing", error: "not_found" }) }),
    );

    assert.match(html, /This invitation link was not found\./);
    assert.doesNotMatch(html, /Invitation link not found or no longer valid\./);
  } finally {
    global.fetch = originalFetch;
  }
});
