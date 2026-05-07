import Link from "next/link";

type LinkItem = {
  href: string;
  label: string;
};

type Group = {
  title: string;
  items: LinkItem[];
};

const groups: Group[] = [
  {
    title: "Platform Health",
    items: [
      { href: "/system/platform", label: "Platform" },
      { href: "/system/pipeline", label: "Pipeline" },
      { href: "/system/extensions", label: "Extensions" },
    ],
  },
  {
    title: "Customers & Growth",
    items: [
      { href: "/system/customers", label: "Customers" },
      { href: "/system/growth", label: "Growth" },
      { href: "/system/expansion", label: "Expansion" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/system/reliability-patterns", label: "Reliability" },
      { href: "/system/intelligence", label: "Reliability Intelligence" },
    ],
  },
];

export function SystemGroupNav() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-foreground">System Surfaces</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Route spine is live. Data parity wiring is deferred by plan.
      </p>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {group.title}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {group.items.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/40"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
