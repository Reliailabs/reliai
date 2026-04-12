import Link from "next/link";
import { requireOperatorSession } from "@/lib/auth";

export default async function BillingSuccessPage() {
  await requireOperatorSession();

  return (
    <div className="min-h-full p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[28px] px-6 py-8 text-center shadow-lg">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-semibold text-zinc-100">Upgrade successful</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          You’re now on Production. Full visibility is active and trace loss is avoided during incidents.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-4 py-2 text-sm font-medium transition-colors"
        >
          Go to dashboard →
        </Link>
      </div>
    </div>
  );
}