"use client"

import { useState, useEffect, useRef } from "react"
import { Search, ChevronDown, Check } from "lucide-react"
import { CommandPalette } from "./command-palette"

interface SessionMembership {
  organization_id: string
  organization_name?: string | null
  role: string
}

interface TopRailProps {
  email: string
  memberships: SessionMembership[]
  activeOrganizationId?: string | null
}

export function TopRail({ email, memberships, activeOrganizationId }: TopRailProps) {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentOrg = memberships.find(m => m.organization_id === activeOrganizationId) ?? memberships[0]
  const orgInitial = currentOrg?.organization_name?.[0]?.toUpperCase() ?? "A"

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOrgDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function switchOrganization(organizationId: string) {
    setOrgDropdownOpen(false)
    
    await fetch("/api/v1/auth/switch-organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId })
    }).then(() => {
      window.location.reload()
    }).catch(() => {
      window.location.reload()
    })
  }

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
        <div className="flex items-center gap-2 shrink-0" ref={dropdownRef}>
          {/* Org dropdown */}
          {memberships.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
              >
                <div className="w-5 h-5 rounded-[4px] bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white select-none">
                  {orgInitial}
                </div>
                <span className="text-xs text-zinc-400 max-w-[100px] truncate">
                  {currentOrg?.organization_name ?? "Organization"}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-600" />
              </button>

              {/* Dropdown menu */}
              {orgDropdownOpen && memberships.length > 1 && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl overflow-hidden z-50">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    Switch organization
                  </div>
                  {memberships.map((membership) => (
                    <button
                      key={membership.organization_id}
                      onClick={() => switchOrganization(membership.organization_id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      <div className="w-4 h-4 rounded bg-violet-500/20 flex items-center justify-center text-[8px] font-bold text-violet-400">
                        {membership.organization_name?.[0]?.toUpperCase() ?? "O"}
                      </div>
                      <span className="flex-1 text-left truncate">
                        {membership.organization_name ?? membership.organization_id}
                      </span>
                      <span className="text-xs text-zinc-600">{membership.role}</span>
                      {membership.organization_id === activeOrganizationId && (
                        <Check className="w-3 h-3 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User avatar */}
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-colors select-none">
            {email[0].toUpperCase()}
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}