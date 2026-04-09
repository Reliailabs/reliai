"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  ScanLine,
  ShieldAlert,
  TrendingDown,
  Rocket,
  Bell,
  Target,
  History,
  Zap,
  ClipboardCheck,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  // ── Primary triage surfaces ──
  { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/incidents",    icon: ShieldAlert,     label: "Incidents"    },
  { href: "/traces",       icon: ScanLine,        label: "Traces"       },
  { href: "/regressions",  icon: TrendingDown,    label: "Regressions"  },
  { href: "/deployments",  icon: Rocket,          label: "Deployments"  },
  // ── Observability config ──
  { href: "/alerts",       icon: Bell,            label: "Alerts"       },
  { href: "/slos",         icon: Target,          label: "SLOs"         },
  { href: "/projects",     icon: FolderKanban,    label: "Projects"     },
  // ── Record-keeping ──
  { href: "/post-mortem",  icon: ClipboardCheck,  label: "Post-Mortem"  },
  { href: "/audit",        icon: History,         label: "Audit Log"    },
  { href: "/prompt-diff",  icon: Zap,             label: "Prompt Diff"  },
]

export function NavRail() {
  const pathname = usePathname()

  return (
    <nav className="w-12 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col items-center py-2 gap-0.5">
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <div key={href} className="relative group">
            <Link
              href={href}
              className={cn(
                "relative w-9 h-9 flex items-center justify-center rounded-md transition-all",
                active
                  ? "text-zinc-50 bg-zinc-800"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
              )}
            >
              {/* Active left-border indicator */}
              {active && (
                <span className="absolute -left-[9px] top-2 bottom-2 w-0.5 rounded-r-full bg-zinc-200" />
              )}
              <Icon className="w-4 h-4" />
            </Link>

            {/* Tooltip */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              {label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-700" />
            </div>
          </div>
        )
      })}

      <div className="flex-1" />

      {/* Settings at bottom */}
      <div className="relative group">
        <Link
          href="/settings"
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-md transition-all",
            pathname.startsWith("/settings")
              ? "text-zinc-50 bg-zinc-800"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
          )}
        >
          <Settings2 className="w-4 h-4" />
        </Link>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          Settings
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-700" />
        </div>
      </div>
    </nav>
  )
}
