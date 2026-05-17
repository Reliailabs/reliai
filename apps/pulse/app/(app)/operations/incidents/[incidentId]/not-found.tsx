import Link from "next/link";

export default function IncidentOperationsNotFound() {
  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Incident operations record not found.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No incident snapshot, timeline evidence, or proposal lifecycle records were found for this incident ID.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/incidents" className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            Back to incidents
          </Link>
          <Link href="/operations" className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            Open operations center
          </Link>
        </div>
      </div>
    </div>
  );
}
