import { test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const latencyIncidentId = "a27ae19b-51f1-4d12-984a-b587bd40c0d1";
const recommendationIncidentId = "d2e61da3-3778-4487-bc66-f4ba3bbcdbab";

test("operator contract spot-check: latency metric and low-confidence recommendation", async ({ page }) => {
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

  const outputDir = path.join(process.cwd(), "test-results", "visual-qa");
  await mkdir(outputDir, { recursive: true });

  await page.goto(`/incidents/${latencyIncidentId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "visual-qa-latency-incident.png"), fullPage: true });

  await page.goto(`/incidents/${latencyIncidentId}/command`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "visual-qa-latency-command.png"), fullPage: true });

  await page.goto(`/incidents/${recommendationIncidentId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "visual-qa-recommend-incident.png"), fullPage: true });

  await page.goto(`/incidents/${recommendationIncidentId}/command`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "visual-qa-recommend-command.png"), fullPage: true });
});
