import { cn } from "@/lib/utils"

interface TabItem {
  key: string
  label: string
  href?: string
  disabled?: boolean
}

interface TabBarProps {
  items: TabItem[]
  activeKey: string
  onChange?: (key: string) => void
  className?: string
}

export function TabBar({ items, activeKey, onChange, className }: TabBarProps) {
  return (
    <div className={cn("flex gap-0 border-b border-zinc-800 px-6", className)}>
      {items.map((item) => {
        const isActive = item.key === activeKey
        const sharedClasses = cn(
          "px-4 py-3 text-sm font-medium transition-colors -mb-px",
          isActive
            ? "text-zinc-100 border-b-2 border-zinc-200"
            : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent",
          item.disabled && "cursor-default opacity-40 hover:text-zinc-500",
        )

        if (item.href && !item.disabled) {
          const Link = require("next/link").default
          return (
            <Link
              key={item.key}
              href={item.href}
              className={sharedClasses}
            >
              {item.label}
            </Link>
          )
        }

        return (
          <button
            key={item.key}
            onClick={() => onChange?.(item.key)}
            disabled={item.disabled}
            className={sharedClasses}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}