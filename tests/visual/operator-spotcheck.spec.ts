import { test } from "@playwright/test";

test("operator workflow spot-check: dashboard, incident detail, command center", async ({ page }) => {
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

    await page.goto(`/incidents/${incidentId}/command`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/Users/robert/Documents/Reliai/visual-qa-command.png", fullPage: true });
  }
});
