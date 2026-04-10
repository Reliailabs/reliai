"use client"

import { useEffect } from "react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
        <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Operator Console</div>
        <h2 className="mt-3 text-lg font-semibold text-zinc-100">Unable to load data</h2>
        <p className="mt-2 text-sm text-zinc-500">
          The server returned an error while fetching this view. Try again or return later.
        </p>
        <button
          onClick={reset}
          className="mt-6 w-full rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
