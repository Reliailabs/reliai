import assert from "node:assert/strict";
import test from "node:test";

import { resolveSignupHref } from "@/lib/signup-link";

function withEnv(value: string | undefined, run: () => void) {
  const prev = process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL;
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL;
  } else {
    process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL = value;
  }
  try {
    run();
  } finally {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL;
    } else {
      process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL = prev;
    }
  }
}

test("signup link defaults to /sign-in when external owner URL is not configured", () => {
  withEnv(undefined, () => {
    assert.equal(resolveSignupHref(), "/sign-in");
  });
});

test("signup link uses configured external /signup owner URL", () => {
  withEnv("https://app.reliai.com/signup", () => {
    assert.equal(resolveSignupHref(), "https://app.reliai.com/signup");
  });
});

test("signup link rejects invalid or ambiguous configured values", () => {
  withEnv("javascript:alert(1)", () => {
    assert.equal(resolveSignupHref(), "/sign-in");
  });
  withEnv("https://app.reliai.com/pricing", () => {
    assert.equal(resolveSignupHref(), "/sign-in");
  });
  withEnv("/signup", () => {
    assert.equal(resolveSignupHref(), "/sign-in");
  });
});

test("signup link preserves query params for external owner URL", () => {
  withEnv("https://app.reliai.com/signup", () => {
    assert.equal(
      resolveSignupHref(new URLSearchParams("utm_source=pulse&campaign=phase12")),
      "https://app.reliai.com/signup?utm_source=pulse&campaign=phase12",
    );
  });
});

test("signup link preserves query params for fallback targets", () => {
  withEnv("/signup", () => {
    assert.equal(resolveSignupHref(new URLSearchParams("next=%2Fpulse")), "/sign-in?next=%2Fpulse");
  });
});

test("signup link does not overwrite existing external query params", () => {
  withEnv("https://app.reliai.com/signup?utm_source=web", () => {
    assert.equal(
      resolveSignupHref(new URLSearchParams("utm_source=pulse&campaign=phase12")),
      "https://app.reliai.com/signup?utm_source=web&campaign=phase12",
    );
  });
});

test("signup link preserves and extends existing fallback query params", () => {
  withEnv("/sign-in?entry=signup", () => {
    assert.equal(
      resolveSignupHref(new URLSearchParams("return_to=%2Fonboarding")),
      "/sign-in?entry=signup&return_to=%2Fonboarding",
    );
  });
});
