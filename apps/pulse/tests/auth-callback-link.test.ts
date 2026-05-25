import assert from "node:assert/strict";
import test from "node:test";

import { resolveExternalAuthCallbackHref } from "@/lib/auth-callback-link";

function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
  const prev = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = prev;
    }
  }
}

test("resolveExternalAuthCallbackHref rejects when missing config", () => {
  withEnv("NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL", undefined, () => {
    const resolved = resolveExternalAuthCallbackHref(
      new URL("http://localhost:3005/auth/callback?code=abc"),
      new URLSearchParams("code=abc"),
    );
    assert.deepEqual(resolved, { ok: false, reason: "missing" });
  });
});

test("resolveExternalAuthCallbackHref rejects invalid callback target", () => {
  withEnv("NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL", "https://web.reliai.dev/not-callback", () => {
    const resolved = resolveExternalAuthCallbackHref(
      new URL("http://localhost:3005/auth/callback?code=abc"),
      new URLSearchParams("code=abc"),
    );
    assert.deepEqual(resolved, { ok: false, reason: "invalid" });
  });
});

test("resolveExternalAuthCallbackHref rejects same-origin loop target", () => {
  withEnv("NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL", "http://localhost:3005/auth/callback", () => {
    const resolved = resolveExternalAuthCallbackHref(
      new URL("http://localhost:3005/auth/callback?code=abc"),
      new URLSearchParams("code=abc"),
    );
    assert.deepEqual(resolved, { ok: false, reason: "loop" });
  });
});

test("resolveExternalAuthCallbackHref forwards query params to external callback", () => {
  withEnv("NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL", "https://app.reliai.dev/auth/callback", () => {
    const resolved = resolveExternalAuthCallbackHref(
      new URL("http://localhost:3005/auth/callback?code=abc&state=xyz"),
      new URLSearchParams("code=abc&state=xyz"),
    );
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const url = new URL(resolved.href);
    assert.equal(url.origin, "https://app.reliai.dev");
    assert.equal(url.pathname, "/auth/callback");
    assert.equal(url.searchParams.get("code"), "abc");
    assert.equal(url.searchParams.get("state"), "xyz");
  });
});

test("resolveExternalAuthCallbackHref drops unknown callback params", () => {
  withEnv("NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL", "https://app.reliai.dev/auth/callback", () => {
    const resolved = resolveExternalAuthCallbackHref(
      new URL("http://localhost:3005/auth/callback?code=abc&state=xyz&project_id=proj_123&return_to=%2Fpulse"),
      new URLSearchParams("code=abc&state=xyz&project_id=proj_123&return_to=%2Fpulse"),
    );
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const url = new URL(resolved.href);
    assert.equal(url.searchParams.get("code"), "abc");
    assert.equal(url.searchParams.get("state"), "xyz");
    assert.equal(url.searchParams.has("project_id"), false);
    assert.equal(url.searchParams.has("return_to"), false);
  });
});
