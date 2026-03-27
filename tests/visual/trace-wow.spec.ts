import crypto from "crypto";
import { test, expect } from "@playwright/test";

test("trace wow flow auto-selects retrieval failure trace", async ({ page }) => {
  const traceId = crypto.randomUUID();
  const rootSpanId = crypto.randomUUID();
  const attemptOneSpanId = crypto.randomUUID();
  const attemptTwoSpanId = crypto.randomUUID();
  const now = new Date().toISOString();

  const waitForApi = async () => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const health = await page.request.get("http://127.0.0.1:8000/health");
        if (health.ok()) {
          return;
        }
      } catch {
        // keep waiting
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("API did not become healthy in time");
  };

  await waitForApi();

  const signInResponse = await page.request.post("http://127.0.0.1:8000/api/v1/auth/sign-in", {
    data: {
      email: "owner@acme.test",
      password: "reliai-dev-password",
    },
  });
  const signInJson = (await signInResponse.json()) as {
    session_token?: string;
    memberships?: Array<{ organization_id: string }>;
  };
  const sessionToken = signInJson.session_token;
  const organizationId = signInJson.memberships?.[0]?.organization_id;

  if (sessionToken) {
    await page.context().addCookies([
      {
        name: "reliai_session",
        value: sessionToken,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }

  let apiKey = "reliai_demo_key";
  let projectId: string | null = null;
  if (sessionToken && organizationId) {
    const projectsResponse = await page.request.get("http://127.0.0.1:8000/api/v1/projects?limit=1", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    if (projectsResponse.ok()) {
      const projectsJson = (await projectsResponse.json()) as { items?: Array<{ id: string }> };
      projectId = projectsJson.items?.[0]?.id ?? null;
    }
    if (projectId) {
      const keyResponse = await page.request.post(
        `http://127.0.0.1:8000/api/v1/projects/${projectId}/api-keys`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          data: {
            label: `wow-trace-${traceId}`,
          },
        }
      );
      if (keyResponse.ok()) {
        const keyJson = (await keyResponse.json()) as { api_key?: string };
        if (keyJson.api_key) {
          apiKey = keyJson.api_key;
        }
      }
    }
  }

  const ingest = (payload: Record<string, unknown>) =>
    page.request.post("http://127.0.0.1:8000/api/v1/ingest/traces", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      data: payload,
    });

  await ingest({
    timestamp: now,
    request_id: "wow-trace",
    trace_id: traceId,
    span_id: rootSpanId,
    span_name: "retrieval.request",
    model_name: "retriever",
    success: true,
    metadata_json: {
      otel: {
        attributes: {
          span_type: "retrieval",
        },
      },
    },
    latency_ms: 120,
  });

  await ingest({
    timestamp: now,
    request_id: "wow-trace",
    trace_id: traceId,
    span_id: attemptOneSpanId,
    parent_span_id: rootSpanId,
    span_name: "retrieval.attempt",
    model_name: "retriever",
    success: false,
    error_type: "retrieval_failed",
    metadata_json: {
      otel: {
        attributes: {
          span_type: "retrieval",
          failure_reason: "stale_context",
          retry_attempt: 1,
          documents_found: 0,
          explanation: "Retriever returned no relevant documents",
        },
      },
    },
    latency_ms: 180,
  });

  await ingest({
    timestamp: now,
    request_id: "wow-trace",
    trace_id: traceId,
    span_id: attemptTwoSpanId,
    parent_span_id: rootSpanId,
    span_name: "retrieval.attempt",
    model_name: "retriever",
    success: true,
    metadata_json: {
      otel: {
        attributes: {
          span_type: "retrieval",
          retry_attempt: 2,
          documents_found: 3,
          explanation: "Retry returned relevant documents",
        },
      },
    },
    latency_ms: 140,
  });

  let wowTraceId: string | null = null;
  let wowTraceGraphId: string | null = null;
  if (sessionToken) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !wowTraceId) {
      const traceListResponse = await page.request.get("http://127.0.0.1:8000/api/v1/traces?limit=1", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (traceListResponse.ok()) {
        const traceListJson = (await traceListResponse.json()) as { items?: Array<{ id: string }> };
        wowTraceId = traceListJson.items?.[0]?.id ?? null;
      }
      if (!wowTraceId) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (wowTraceId) {
      const traceDetailResponse = await page.request.get(
        `http://127.0.0.1:8000/api/v1/traces/${wowTraceId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );
      if (traceDetailResponse.ok()) {
        const traceDetailJson = (await traceDetailResponse.json()) as { trace_id?: string };
        wowTraceGraphId = traceDetailJson.trace_id ?? null;
      }
    }
  }

  const bannerUrl = wowTraceId
    ? `/traces?autoselect=0&wow_trace_id=${wowTraceId}`
    : "/traces?autoselect=0";
  await page.goto(bannerUrl, { waitUntil: "networkidle" });
  await expect(page.getByTestId("wow-trace-banner")).toBeVisible({ timeout: 15000 });

  const autoSelectUrl = wowTraceId ? `/traces?wow_trace_id=${wowTraceId}` : "/traces";
  await page.goto(autoSelectUrl, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/traces\/.+/);

  const targetGraphUrl = wowTraceGraphId
    ? `/traces/${wowTraceGraphId}/graph`
    : wowTraceId
      ? `/traces/${wowTraceId}/graph`
      : `${page.url()}/graph`;
  await page.goto(targetGraphUrl, { waitUntil: "networkidle" });

  await expect(page.getByText("retrieval.request").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("retrieval.attempt").nth(1)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Retrieval failed").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Recovered after retry").first()).toBeVisible({ timeout: 15000 });
});
