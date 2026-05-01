"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardCheck,
  ScanLine,
  Shield,
  Rocket,
  BarChart3,
  Settings2,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/pulse", icon: Activity, label: "Pulse" },
  { href: "/audits", icon: ClipboardCheck, label: "Audits" },
  { href: "/traces", icon: ScanLine, label: "Traces" },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/guardrails", icon: Shield, label: "Guardrails" },
  { href: "/deployments", icon: Rocket, label: "Deployments" },
  { href: "/metrics", icon: BarChart3, label: "Metrics" },
  { href: "/settings", icon: Settings2, label: "Settings" },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav className="w-12 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col items-center py-2 gap-0.5">
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <div key={href} className="relative group">
            <Link
              href={href}
              className={cn(
                "relative w-9 h-9 flex items-center justify-center rounded-md transition-all",
                active
                  ? "text-zinc-50 bg-zinc-800"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60",
              )}
            >
              {active ? (
                <span className="absolute -left-[9px] top-2 bottom-2 w-0.5 rounded-r-full bg-zinc-200" />
              ) : null}
              <Icon className="w-4 h-4" />
            </Link>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              {label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-700" />
            </div>
          </div>
        );
      })}

      <div className="flex-1" />

      <div className="relative group">
        <form action="/api/auth/sign-out" method="post">
          <button
            type="submit"
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          Sign out
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-700" />
        </div>
      </div>
    </nav>
  );
}
