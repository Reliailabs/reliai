import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getOperatorSession, getWorkosSignInUrl } from "@/lib/auth";
import { devAuthEnabled, workosConfigured } from "@/lib/constants";

const sanitizeReturnTo = (value?: string) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";
  const workosEnabled = workosConfigured();
  const rawReturnTo = Array.isArray(params.return_to) ? params.return_to[0] : params.return_to;
  const safeReturnTo = sanitizeReturnTo(rawReturnTo);
  const session = await getOperatorSession();
  if (session) {
    redirect(safeReturnTo);
  }
  const workosSignInUrl = await getWorkosSignInUrl(safeReturnTo);
  const showDevFallback = devAuthEnabled();
  const authModeLabel = workosEnabled
    ? showDevFallback
      ? "WorkOS + dev fallback"
      : "WorkOS only"
    : showDevFallback
      ? "Dev fallback only"
      : "Authentication unavailable";

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <Card className="w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">Operator access</p>
        <h1 className="mt-3 text-2xl font-semibold">Operator sign-in</h1>
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-secondary">
          Auth mode: <span className="font-medium text-primary">{authModeLabel}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-secondary">
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
          <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-secondary">
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
          <form method="post" action="/api/auth/dev-sign-in" className="mt-6 space-y-4">
            <input type="hidden" name="return_to" value={safeReturnTo} />
            <input
              name="email"
              type="email"
              placeholder="owner@acme.test"
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-primary outline-none"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-primary outline-none"
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
