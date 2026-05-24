import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { devAuthEnabled, getAuthRuntimeConfigError } from "@/lib/constants";

function withEnv<T>(updates: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("dev auth is fail-closed by default unless explicitly enabled", () => {
  withEnv({ RELIAI_DEV_AUTH_ENABLED: undefined, NODE_ENV: "development" }, () => {
    assert.equal(devAuthEnabled(), false);
  });

  withEnv({ RELIAI_DEV_AUTH_ENABLED: "true", NODE_ENV: "development" }, () => {
    assert.equal(devAuthEnabled(), true);
  });

  withEnv({ RELIAI_DEV_AUTH_ENABLED: "false", NODE_ENV: "development" }, () => {
    assert.equal(devAuthEnabled(), false);
  });
});

test("auth runtime config fails safely for missing/invalid production API settings", () => {
  withEnv({ NODE_ENV: "production", API_URL: undefined, NEXT_PUBLIC_API_URL: undefined }, () => {
    assert.equal(getAuthRuntimeConfigError(), "missing_api_url");
  });

  withEnv({ NODE_ENV: "production", API_URL: "http://localhost:8000", NEXT_PUBLIC_API_URL: undefined }, () => {
    assert.equal(getAuthRuntimeConfigError(), "invalid_production_api_url");
  });

  withEnv({ NODE_ENV: "production", API_URL: "https://api.reliai.dev", NEXT_PUBLIC_API_URL: undefined }, () => {
    assert.equal(getAuthRuntimeConfigError(), null);
  });
});

test("dev sign-in endpoint is unreachable when dev auth is disabled", () => {
  const route = read("app/api/auth/dev-sign-in/route.ts");
  assert.match(route, /if \(!devAuthEnabled\(\)\) \{/);
  assert.match(route, /return NextResponse\.json\(\{ detail: "not_found" \}, \{ status: 404 \}\)/);
});

test("sign-in page does not unconditionally render seed credentials", () => {
  const signIn = read("app/sign-in/page.tsx");
  assert.match(signIn, /const devAuth = devAuthEnabled\(\)/);
  assert.match(signIn, /const formAction = devAuth \? "\/api\/auth\/dev-sign-in" : "\/api\/auth\/sign-in"/);
  assert.match(signIn, /\{!configError \? \(/);
  assert.match(signIn, /Sign-in is disabled because auth runtime configuration is invalid for this environment\./);
});

test("on-call tenancy scope requires explicit valid project scope", () => {
  const onCallPage = read("app/\(app\)/on-call/page.tsx");
  const responseTeam = read("app/api/oncall/response-team/route.ts");

  assert.match(onCallPage, /resolveStrictScopedProjectId\(projects, projectIdParam\)/);
  assert.match(onCallPage, /redirect\("\/on-call\?error=project_scope_required"\)/);
  assert.match(responseTeam, /resolveStrictScopedProjectId\(projects, projectIdParam\)/);
  assert.match(responseTeam, /project_scope_required/);
});
