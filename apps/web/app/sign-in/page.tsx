import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getOperatorSession, signIn } from "@/lib/auth";

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
        <p className="mt-3 text-sm leading-6 text-steel">
          Use the seeded operator account for local development. This is a lean first-party auth
          scaffold intended to be replaceable with Clerk or WorkOS later.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-steel">
          Local seed credentials: `owner@acme.test` / `reliai-dev-password`
        </div>
        {hasError ? (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            Invalid credentials.
          </div>
        ) : null}
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
          <button className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white transition hover:bg-black">
            Sign in
          </button>
        </form>
      </Card>
    </main>
  );
}
