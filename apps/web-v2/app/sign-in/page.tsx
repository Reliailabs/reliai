import { redirect } from "next/navigation";

import { getOperatorSession } from "@/lib/auth";

const sanitizeReturnTo = (value?: string) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";

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

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl p-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
            <span className="text-[11px] font-bold text-zinc-950 tracking-tight select-none">
              RL
            </span>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">
              Operator Access
            </div>
            <h1 className="text-xl font-semibold text-zinc-100">Sign in to Reliai</h1>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-500">
          Local seed credentials:{" "}
          <span className="font-mono text-zinc-300">owner@acme.test</span> /{" "}
          <span className="font-mono text-zinc-300">reliai-dev-password</span>
        </div>

        {hasError ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            Invalid credentials. Please try again.
          </div>
        ) : null}

        <form method="post" action="/api/auth/dev-sign-in" className="mt-6 space-y-4">
          <input type="hidden" name="return_to" value={safeReturnTo} />
          <div className="space-y-2">
            <label className="text-xs text-zinc-500">Email</label>
            <input
              name="email"
              type="email"
              placeholder="owner@acme.test"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500">Password</label>
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              required
            />
          </div>
          <button className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
