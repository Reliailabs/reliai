import Link from "next/link";

type RegressionOperationsNotFoundProps = {
  searchParams?: Promise<{ project_id?: string }>;
};

export default async function RegressionOperationsNotFound({ searchParams }: RegressionOperationsNotFoundProps) {
  const { project_id: projectIdParam } = (await searchParams) ?? {};
  const withScopedProject = (path: string) => {
    if (!projectIdParam) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}project_id=${encodeURIComponent(projectIdParam)}`;
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Regression operations record not found.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No regression snapshot, timeline evidence, incidents, or proposals were found for this regression ID.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href={withScopedProject("/traces")} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            Back to traces
          </Link>
          <Link href={withScopedProject("/operations")} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            Open operations center
          </Link>
        </div>
      </div>
    </div>
  );
}
