export default function IncidentOperationsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-72 rounded bg-muted" />
        <div className="h-4 w-96 rounded bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
