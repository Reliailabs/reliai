import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto mt-20 max-w-md rounded-[28px] border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm">
      <div className="text-3xl">✅</div>
      <h1 className="mt-4 text-2xl font-semibold text-ink">Upgrade successful</h1>
      <p className="mt-3 text-sm leading-6 text-steel">
        You’re now on Production. Full visibility is active and trace loss is avoided during incidents.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
      >
        Go to dashboard →
      </Link>
    </div>
  );
}
