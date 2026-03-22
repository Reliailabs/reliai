import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, KeyRound, ScanSearch, Settings2, ShieldAlert } from "lucide-react";

import { signOut } from "@/lib/auth";
import { OrgSwitcher } from "@/components/org-switcher";
import { DensityToggle } from "@/components/density-toggle";
import { WarRoomToggle } from "@/components/war-room-toggle";
import { AppShellTransition } from "@/components/app-shell-transition";

const navItems = [
  { href: "/dashboard" as Route, label: "Overview", icon: Activity },
  { href: "/traces" as Route, label: "Traces", icon: ScanSearch },
  { href: "/onboarding" as Route, label: "Onboarding", icon: KeyRound },
  { href: "/incidents" as Route, label: "Incidents", icon: ShieldAlert },
  { href: "/settings" as Route, label: "Settings", icon: Settings2 }
];

export async function AppShell({
  children,
  operatorEmail,
  memberships,
  activeOrganizationId
}: {
  children: ReactNode;
  operatorEmail: string;
  memberships: Array<{ organization_id: string; organization_name?: string | null; role: string }>;
  activeOrganizationId?: string | null;
}) {
  async function signOutAction() {
    "use server";
    await signOut();
    redirect("/sign-in");
  }

  return (
    <div className="app-shell min-h-screen bg-bg text-textPrimary">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-r border-line bg-surface px-5 py-6">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliai</p>
            <h1 className="mt-2 text-xl font-semibold">AI reliability operations</h1>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-steel transition-colors hover:bg-surface hover:text-ink"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg border border-line bg-surface px-3 py-3 text-sm text-steel">
            <p className="font-medium text-ink">{operatorEmail}</p>
            <OrgSwitcher memberships={memberships} activeOrganizationId={activeOrganizationId} />
            <div className="mt-3">
              <DensityToggle />
            </div>
            <div className="mt-2">
              <WarRoomToggle />
            </div>
            <form action={signOutAction} className="mt-3">
              <button className="text-sm text-steel underline-offset-4 hover:text-ink hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <main className="px-4 py-4 lg:px-8 lg:py-6">
          <AppShellTransition>{children}</AppShellTransition>
        </main>
      </div>
    </div>
  );
}
