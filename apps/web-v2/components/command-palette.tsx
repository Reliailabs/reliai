"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  LayoutDashboard,
  ShieldAlert,
  ScanLine,
  FolderKanban,
  TrendingDown,
  Rocket,
  Settings2,
} from "lucide-react"

interface CommandItem {
  id: string
  label: string
  description: string
  category: string
  icon: React.ReactNode
  href: string
}

const allItems: CommandItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Triage console and incident overview",
    category: "Navigate",
    icon: <LayoutDashboard className="w-4 h-4" />,
    href: "/dashboard",
  },
  {
    id: "incidents",
    label: "Incidents",
    description: "Active and resolved incidents",
    category: "Navigate",
    icon: <ShieldAlert className="w-4 h-4" />,
    href: "/incidents",
  },
  {
    id: "traces",
    label: "Traces",
    description: "Request trace explorer",
    category: "Navigate",
    icon: <ScanLine className="w-4 h-4" />,
    href: "/traces",
  },
  {
    id: "projects",
    label: "Projects",
    description: "Project settings and environments",
    category: "Navigate",
    icon: <FolderKanban className="w-4 h-4" />,
    href: "/projects",
  },
  {
    id: "regressions",
    label: "Regressions",
    description: "Regression analysis and snapshots",
    category: "Navigate",
    icon: <TrendingDown className="w-4 h-4" />,
    href: "/regressions",
  },
  {
    id: "deployments",
    label: "Deployments",
    description: "Deployment tracking and gates",
    category: "Navigate",
    icon: <Rocket className="w-4 h-4" />,
    href: "/deployments",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Account and organization settings",
    category: "Navigate",
    icon: <Settings2 className="w-4 h-4" />,
    href: "/settings",
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = allItems.filter(
    (item) =>
      query === "" ||
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelected(0)
      const t = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, filtered.length - 1))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      }
      if (e.key === "Enter" && filtered[selected]) {
        router.push(filtered[selected].href)
        onClose()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, filtered, selected, onClose, router])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            placeholder="Jump to anything..."
            className="flex-1 bg-transparent text-zinc-100 text-sm placeholder:text-zinc-600 outline-none"
          />
          <kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  router.push(item.href)
                  onClose()
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                  i === selected
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-800/40"
                }`}
              >
                <span
                  className={
                    i === selected ? "text-zinc-300" : "text-zinc-600"
                  }
                >
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={
                      i === selected ? "text-zinc-50" : "text-zinc-300"
                    }
                  >
                    {item.label}
                  </div>
                  <div className="text-xs text-zinc-600 truncate">
                    {item.description}
                  </div>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-4">
          <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
            <kbd className="border border-zinc-700 rounded px-1 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
            <kbd className="border border-zinc-700 rounded px-1 font-mono">↵</kbd>
            open
          </span>
          <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
            <kbd className="border border-zinc-700 rounded px-1 font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
