"use client";

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import type { LimitStatus } from "@reliai/types";

import { cn } from "@/lib/utils";

function severityTone(severity: LimitStatus["severity"]) {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-zinc-200 bg-zinc-50 text-zinc-800";
}

function statusIcon(status: LimitStatus["status"]) {
  if (status === "delayed") return Clock;
  return AlertTriangle;
}

export function LimitStatusInline({ limits }: { limits: LimitStatus[] }) {
  if (!limits.length) return null;

  return (
    <div className="space-y-2">
      {limits.map((limit) => {
        const Icon = statusIcon(limit.status);
        const showCtas = limit.cta_priority !== "none";
        const primaryCta = showCtas ? limit.cta : null;
        const secondaryCta = showCtas ? limit.cta_secondary : null;
        return (
          <div
            key={`${limit.type}-${limit.scope?.feature ?? limit.scope?.project_id ?? "global"}`}
            className={cn("rounded-lg border px-3 py-2 text-xs", severityTone(limit.severity))}
          >
            <div className="flex items-center gap-2 font-medium">
              <Icon className="h-3.5 w-3.5" />
              <span>{limit.message}</span>
            </div>
            {limit.type === "sampling" ? (
              <p className="mt-1 text-[11px] opacity-80">
                Incident evidence may be partial due to sampling.
              </p>
            ) : null}
            {primaryCta || secondaryCta ? (
              <div className="mt-1 text-xs">
                {primaryCta ? (
                  <Link href={{ pathname: primaryCta.href }} className="underline underline-offset-4">
                    {primaryCta.label}
                  </Link>
                ) : null}
                {secondaryCta ? (
                  <>
                    {primaryCta ? <span className="px-1 text-zinc-400">·</span> : null}
                    <Link href={{ pathname: secondaryCta.href }} className="underline underline-offset-4">
                      {secondaryCta.label}
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
