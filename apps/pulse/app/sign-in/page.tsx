import { redirect } from "next/navigation";

import { getOperatorSession, sanitizeReturnTo } from "@/lib/auth";
import { devAuthEnabled, getAuthRuntimeConfigError } from "@/lib/constants";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";
  const rawReturnTo = Array.isArray(params.return_to) ? params.return_to[0] : params.return_to;
  const safeReturnTo = sanitizeReturnTo(rawReturnTo);
  const session = await getOperatorSession();
  if (session) {
    redirect(safeReturnTo);
  }
  const devAuth = devAuthEnabled();
  const configError = getAuthRuntimeConfigError();
  const formAction = devAuth ? "/api/auth/dev-sign-in" : "/api/auth/sign-in";

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 shadow-xl p-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
            <span className="text-[11px] font-bold text-zinc-950 tracking-tight select-none">RL</span>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Operator Access</div>
            <h1 className="text-xl font-semibold text-zinc-100">Sign in to Reliai</h1>
          </div>
        </div>

        {devAuth ? (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-500">
            Local seed credentials: <span className="font-mono text-zinc-300">owner@acme.test</span> /{" "}
            <span className="font-mono text-zinc-300">reliai-dev-password</span>
          </div>
        ) : null}

        {hasError ? (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            Invalid credentials. Please try again.
          </div>
        ) : null}

        {!configError ? (
          <form method="post" action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="return_to" value={safeReturnTo} />
            <div className="space-y-2">
              <label className="text-xs text-zinc-500">Email</label>
              <input
                name="email"
                type="email"
                placeholder="owner@acme.test"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500">Password</label>
              <input
                name="password"
                type="password"
                placeholder="Password"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                required
              />
            </div>
            <button className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white">
              Sign in
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-500">
            Sign-in is disabled because auth runtime configuration is invalid for this environment.
          </div>
        )}
      </div>
    </main>
  );
}
