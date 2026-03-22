"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

type TraceWowBannerProps = {
  bestTraceId?: string;
  hasFilters?: boolean;
  disableAutoSelect?: boolean;
  hasCursor?: boolean;
};

const AUTO_SELECT_KEY = "reliai:trace-autoselect";

export function TraceWowBanner({
  bestTraceId,
  hasFilters,
  disableAutoSelect,
  hasCursor,
}: TraceWowBannerProps) {
  const router = useRouter();
  const autoSelectDisabled = Boolean(disableAutoSelect);
  const cursorPresent = Boolean(hasCursor);

  useEffect(() => {
    if (!bestTraceId || hasFilters) {
      return;
    }
    if (autoSelectDisabled) {
      return;
    }
    if (cursorPresent) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    if (window.sessionStorage.getItem(AUTO_SELECT_KEY)) {
      return;
    }
    window.sessionStorage.setItem(AUTO_SELECT_KEY, "1");
    router.replace(`/traces/${bestTraceId}`);
  }, [bestTraceId, autoSelectDisabled, cursorPresent, hasFilters, router]);

  if (!bestTraceId) {
    return null;
  }

  return (
    <div
      data-testid="wow-trace-banner"
      className="rounded-[22px] border border-amber-200 bg-amber-50/60 px-5 py-4 text-sm text-amber-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Example trace
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Retrieval failure with retry and recovery is ready to inspect.
          </p>
        </div>
        <Link
          href={`/traces/${bestTraceId}`}
          className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800 transition hover:border-amber-400 hover:text-amber-950"
        >
          View trace
        </Link>
      </div>
    </div>
  );
}
