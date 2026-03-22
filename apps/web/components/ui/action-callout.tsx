import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ActionCta = {
  label: string;
  href: string;
};

type ActionConfidence = "high" | "medium";

export function ActionCallout({
  label = "Action",
  directive,
  supporting,
  cta,
  confidence,
  source,
  className,
}: {
  label?: string;
  directive: ReactNode;
  supporting?: ReactNode;
  cta?: ActionCta;
  confidence?: ActionConfidence;
  source?: string;
  className?: string;
}) {
  const meta =
    confidence || source
      ? [confidence ? `confidence: ${confidence}` : null, source ? `source: ${source}` : null]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-actionBorder bg-actionSurface px-4 py-4 text-actionText",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-actionLabel">{label}</p>
        {meta ? <p className="text-[11px] uppercase tracking-[0.18em] text-actionLabel">{meta}</p> : null}
      </div>
      <p className="mt-2 text-sm font-semibold text-actionText">{directive}</p>
      {supporting ? <div className="mt-2 text-sm text-actionText">{supporting}</div> : null}
      {cta ? (
        <div className="mt-3">
          <Link
            href={cta.href}
            className="inline-flex items-center text-sm font-semibold text-actionAccent underline underline-offset-4 hover:text-actionText"
          >
            {cta.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
