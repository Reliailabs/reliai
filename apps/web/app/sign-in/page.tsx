import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getOperatorSession, getWorkosSignInUrl, signIn } from "@/lib/auth";
import { devAuthEnabled, workosConfigured } from "@/lib/constants";

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getOperatorSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";
  const workosEnabled = workosConfigured();
  const workosSignInUrl = await getWorkosSignInUrl();
  const showDevFallback = devAuthEnabled();
  const authModeLabel = workosEnabled
    ? showDevFallback
      ? "WorkOS + dev fallback"
      : "WorkOS only"
    : showDevFallback
      ? "Dev fallback only"
      : "Authentication unavailable";

  async function signInAction(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await signIn(email, password);
    if (!result) {
      redirect("/sign-in?error=1");
    }
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-6">
      <Card className="w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Operator access</p>
        <h1 className="mt-3 text-2xl font-semibold">Operator sign-in</h1>
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-steel">
          Auth mode: <span className="font-medium text-ink">{authModeLabel}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-steel">
          {workosEnabled
            ? "Production authentication is configured through WorkOS."
            : "WorkOS is not configured in the current environment."}{" "}
          {showDevFallback
            ? "The local seeded fallback account is enabled for development."
            : "The local dev fallback is disabled."}
        </p>
        {workosSignInUrl ? (
          <a
            href={workosSignInUrl}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white transition hover:bg-black"
          >
            Continue with WorkOS
          </a>
        ) : null}
        {showDevFallback ? (
          <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-steel">
            Local seed credentials: `owner@acme.test` / `reliai-dev-password`
          </div>
        ) : null}
        {!workosEnabled && !showDevFallback ? (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            Configure the WorkOS env vars or re-enable `RELIAI_DEV_AUTH_ENABLED` to sign in locally.
          </div>
        ) : null}
        {hasError ? (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            Invalid credentials.
          </div>
        ) : null}
        {showDevFallback ? (
          <form action={signInAction} className="mt-6 space-y-4">
            <input
              name="email"
              type="email"
              placeholder="owner@acme.test"
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
            />
            <button className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-black">
              Sign in with dev fallback
            </button>
          </form>
        ) : null}
      </Card>
    </main>
  );
}
