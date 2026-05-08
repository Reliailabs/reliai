"use client"

import { X, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export interface FilterOption {
  key: string
  label: string
  value: string
}

interface Props {
  initial?: FilterOption[]
  filters?: FilterOption[]
  onRemove?: (key: string) => void
  onClear?: () => void
  onAdd?: () => void
  className?: string
}

export function FilterChips({
  initial = [],
  filters,
  onRemove,
  onClear,
  onAdd,
  className,
}: Props) {
  const [active, setActive] = useState<FilterOption[]>(initial)

  const remove = (key: string) => {
    setActive((prev) => prev.filter((f) => f.key !== key))
  }

  const clearAll = () => setActive([])
  const current = filters ?? active
  const handleRemove = onRemove ?? remove
  const handleClear = onClear ?? clearAll
  const handleAdd = onAdd

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-6 py-2.5 border-b border-zinc-800/60 flex-wrap min-h-[42px]",
        className
      )}
    >
      <SlidersHorizontal className="w-3 h-3 text-zinc-600 shrink-0" />

      {current.length === 0 && (
        <span className="text-xs text-zinc-600">No active filters</span>
      )}

      {current.map((filter) => (
        <button
          key={filter.key}
          onClick={() => handleRemove(filter.key)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded border border-zinc-700 transition-colors"
        >
          <span className="text-zinc-500 font-normal">{filter.label}:</span>
          <span>{filter.value}</span>
          <X className="w-2.5 h-2.5 text-zinc-500 ml-0.5" />
        </button>
      ))}

      {current.length > 0 && (
        <button
          onClick={handleClear}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Clear
        </button>
      )}

      <button
        onClick={handleAdd}
        className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-zinc-600 hover:text-zinc-400 text-xs rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
      >
        + Filter
      </button>
    </div>
  )
}
