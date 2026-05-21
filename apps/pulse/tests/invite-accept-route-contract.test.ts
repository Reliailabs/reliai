import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { POST } from "@/app/api/invitations/[token]/accept/route";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

function buildRequest(form: Record<string, string>): Request {
  const data = new URLSearchParams(form);
  return new Request("http://localhost:3005/api/invitations/test-token/accept", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "http://localhost:3005",
    },
    body: data.toString(),
  });
}

test("accept route sanitizes unsafe return_to and redirects to settings team", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ session_token: "session-token" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    const response = await POST(buildRequest({ return_to: "https://evil.test/path" }), {
      params: Promise.resolve({ token: "test-token" }),
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "http://localhost:3005/settings#team");
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  } finally {
    fetchMock.mock.restore();
  }
});

test("accept route maps not-found backend response to join error state", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  try {
    const response = await POST(buildRequest({ return_to: "/settings#team" }), {
      params: Promise.resolve({ token: "missing-token" }),
    });
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "http://localhost:3005/join?token=missing-token&error=not_found",
    );
  } finally {
    fetchMock.mock.restore();
  }
});

test("accept route maps successful accept without session token to unavailable", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    const response = await POST(buildRequest({ return_to: "/settings#team" }), {
      params: Promise.resolve({ token: "no-session-token" }),
    });
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "http://localhost:3005/join?token=no-session-token&error=unavailable",
    );
  } finally {
    fetchMock.mock.restore();
  }
});
