"use client";

export default function IncidentOperationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8">
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
        <p className="text-sm font-medium text-foreground">Unable to load this panel.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Incident operations data is temporarily unavailable. {error.digest ? `Ref: ${error.digest}` : ""}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
