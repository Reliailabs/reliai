import { cn } from "@/lib/utils"

interface Props {
  title: string
  description?: string
  right?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, right, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-800",
        className
      )}
    >
      <div>
        <h1 className="text-[15px] font-semibold text-zinc-50 tracking-tight leading-none">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {right && (
        <div className="flex items-center gap-2 shrink-0 pt-0.5">{right}</div>
      )}
    </div>
  )
}
