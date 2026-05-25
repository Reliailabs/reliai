"use client";

export default function SettingsError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Unable to load settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The settings view could not be loaded right now.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        Retry
      </button>
    </div>
  );
}
