"use client"

import { useState, useEffect } from "react"
import { Search, ChevronDown } from "lucide-react"
import { CommandPalette } from "./command-palette"

export function TopRail() {
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <>
      <header className="h-12 shrink-0 border-b border-zinc-800 bg-zinc-950 flex items-center px-3 gap-3 z-10">
        {/* Logo mark — same width as nav rail */}
        <div className="w-9 flex items-center justify-center shrink-0">
          <div className="w-6 h-6 rounded-[5px] bg-zinc-100 flex items-center justify-center">
            <span className="text-[9px] font-bold text-zinc-950 tracking-tight select-none">
              RL
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-zinc-800 shrink-0" />

        {/* Wordmark */}
        <span className="text-sm font-semibold text-zinc-200 tracking-tight shrink-0">
          Reliai
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search / command trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2 h-8 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md text-zinc-500 text-sm transition-colors min-w-[200px] max-w-xs"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-xs text-zinc-600">
            Jump to anything...
          </span>
          <div className="flex items-center gap-0.5">
            <kbd className="text-[10px] border border-zinc-700 rounded px-1 py-0.5 text-zinc-600 font-mono leading-none">
              ⌘
            </kbd>
            <kbd className="text-[10px] border border-zinc-700 rounded px-1 py-0.5 text-zinc-600 font-mono leading-none">
              K
            </kbd>
          </div>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Org + User */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
            <div className="w-5 h-5 rounded-[4px] bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white select-none">
              A
            </div>
            <span className="text-xs text-zinc-400">Acme Corp</span>
            <ChevronDown className="w-3 h-3 text-zinc-600" />
          </button>

          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-colors select-none">
            R
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
