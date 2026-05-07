import Link from "next/link";

type SystemStubProps = {
  title: string;
  description: string;
};

const links = [
  { href: "/system/platform", label: "Platform" },
  { href: "/system/pipeline", label: "Pipeline" },
  { href: "/system/extensions", label: "Extensions" },
  { href: "/system/customers", label: "Customers" },
  { href: "/system/growth", label: "Growth" },
  { href: "/system/expansion", label: "Expansion" },
  { href: "/system/reliability-patterns", label: "Reliability" },
  { href: "/system/intelligence", label: "Reliability Intelligence" },
];

export function SystemStub({ title, description }: SystemStubProps) {
  return (
    <main className="min-h-screen bg-background px-8 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">System Admin</p>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        </header>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">System Surfaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Route spine is live. Data parity wiring is deferred by plan.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/40"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
