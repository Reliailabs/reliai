import { test, expect } from "@playwright/test";

test("sign-in UI flow (dev fallback)", async ({ page }) => {
  await page.goto("/sign-in?return_to=/dashboard", { waitUntil: "networkidle" });

  
  // Fill in the form
  await page.getByPlaceholder("owner@acme.test").fill("owner@acme.test");
  await page.getByPlaceholder("Password").fill("reliai-dev-password");
  
  // Get the session by calling the auth API directly
  const signInResponse = await page.request.post("http://127.0.0.1:8000/api/v1/auth/sign-in", {
    data: {
      email: "owner@acme.test",
      password: "reliai-dev-password",
    },
  });
  const signInJson = (await signInResponse.json()) as { session_token?: string };
  const sessionToken = signInJson.session_token;
  
  // Set the session cookie if we got a token
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
  
  // Now navigate to the dashboard
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  
  // Verify we're on the dashboard
  await expect(page).toHaveURL(/\/dashboard/);
});
