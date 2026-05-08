import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubPageHeaderProps {
  label: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  right?: React.ReactNode;
  className?: string;
}

export function SubPageHeader({
  label,
  title,
  description,
  backHref,
  backLabel = "Back",
  right,
  className,
}: SubPageHeaderProps) {
  return (
    <header
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-6 shadow-sm",
        className,
      )}
    >
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className={cn("flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between", backHref && "mt-4")}>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
              {description}
            </p>
          )}
        </div>
        {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
      </div>
    </header>
  );
}