import { test } from "@playwright/test";

test("focused visual QA for homepage, demo, trace detail", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/Users/robert/Documents/Reliai/visual-qa-home.png", fullPage: true });

  const signInResponse = await page.request.post("http://127.0.0.1:8000/api/v1/auth/sign-in", {
    data: {
      email: "owner@acme.test",
      password: "reliai-dev-password",
    },
  });
  const signInJson = (await signInResponse.json()) as { session_token?: string };
  const sessionToken = signInJson.session_token;
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

  await page.goto("/demo?visual=1", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-demo-container-ready]");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/Users/robert/Documents/Reliai/visual-qa-demo.png", fullPage: true });

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/Users/robert/Documents/Reliai/visual-qa-dashboard.png", fullPage: true });

  const incidentListResponse = await page.request.get("http://127.0.0.1:8000/api/v1/incidents?limit=1", {
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
  });
  const incidentListJson = (await incidentListResponse.json()) as { items?: Array<{ id: string }> };
  const incidentId = incidentListJson.items?.[0]?.id ?? null;
  if (incidentId) {
    await page.goto(`/incidents/${incidentId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/Users/robert/Documents/Reliai/visual-qa-incident.png", fullPage: true });
  }

  const traceListResponse = await page.request.get("http://127.0.0.1:8000/api/v1/traces?limit=1", {
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
  });
  const traceListJson = (await traceListResponse.json()) as { items?: Array<{ id: string }> };
  const traceId = traceListJson.items?.[0]?.id ?? null;
  const traceDetail = traceId ? await page.request.get(`http://127.0.0.1:8000/api/v1/traces/${traceId}`, {
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
  }) : null;
  const traceDetailJson = traceDetail && traceDetail.ok() ? ((await traceDetail.json()) as { trace_id?: string }) : null;
  const traceGraphId = traceDetailJson?.trace_id ?? traceId;

  if (traceGraphId) {
    await page.goto(`/traces/${traceGraphId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/Users/robert/Documents/Reliai/visual-qa-trace.png", fullPage: true });
  }
});
