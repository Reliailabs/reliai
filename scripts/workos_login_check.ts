import { chromium } from "@playwright/test";

const baseUrl = process.env.WORKOS_TEST_BASE_URL ?? "http://localhost:3000";
const email = process.env.WORKOS_TEST_EMAIL;
const password = process.env.WORKOS_TEST_PASSWORD;

if (!email || !password) {
  console.error("Missing WORKOS_TEST_EMAIL or WORKOS_TEST_PASSWORD");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Continue with WorkOS" }).click();

    await page.waitForURL(/authkit\.app|workos\.com/, { timeout: 15000 });
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("button", { name: "Continue" }).click();

    const passwordField = page.getByRole("textbox", { name: "Password" });
    const magicLinkNotice = page.getByText(/check your email|magic link/i);

    const passwordVisible = await Promise.race([
      passwordField.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false),
      magicLinkNotice.waitFor({ state: "visible", timeout: 15000 }).then(() => false).catch(() => false),
    ]);

    if (!passwordVisible) {
      console.log("AuthKit flow requested email verification (magic link).");
      console.log(`Current URL: ${page.url()}`);
      return;
    }

    await passwordField.fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(new RegExp(`${baseUrl.replace("http://", "https?://")}/`), {
      timeout: 20000
    });

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
