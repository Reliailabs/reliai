"use client"

import { ShieldCheck } from "lucide-react"

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-[#09090B]/80 backdrop-blur-md">
      <div className="w-full flex justify-center px-6 py-4">
        <div className="w-full max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">Reliai</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="/demo" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Product
            </a>
            <a href="/docs" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Docs
            </a>
            <a href="/pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Pricing
            </a>
            <a href="/ai-reliability-audit" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Audit
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/sign-in?return_to=%2Fpulse" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Sign in
            </a>
            <a
              href="/ai-reliability-audit"
              className="text-sm text-white bg-zinc-800 hover:bg-zinc-700 px-3.5 py-1.5 rounded-md border border-zinc-700 transition-colors"
            >
              Run audit
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
