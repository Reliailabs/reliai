"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { marketingContainerClass } from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo");

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b backdrop-blur",
        isDemo ? "border-line bg-bg/95 text-textPrimary" : "border-zinc-200/80 bg-[#f7f8fa]/90 text-ink"
      )}
    >
      <div className={`${marketingContainerClass} flex items-center justify-between py-4`}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold",
              isDemo ? "border-line bg-surface text-textPrimary" : "border-zinc-300 bg-white text-ink shadow-sm"
            )}
          >
            R
          </div>
          <div>
            <p className={cn("text-sm font-semibold tracking-tight", isDemo ? "text-textPrimary" : "text-ink")}>
              Reliai
            </p>
            <p
              className={cn(
                "text-xs uppercase tracking-[0.24em]",
                isDemo ? "text-textSecondary" : "text-steel"
              )}
            >
              Production AI reliability
            </p>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/#product"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-steel hover:text-ink"
            )}
          >
            Product
          </Link>
          <Link
            href="/docs"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-steel hover:text-ink"
            )}
          >
            Docs
          </Link>
          <Link
            href="/demo"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textPrimary" : "text-steel hover:text-ink"
            )}
          >
            Demo
          </Link>
          <Link
            href="/pricing"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-steel hover:text-ink"
            )}
          >
            Pricing
          </Link>
          <Link
            href="/ai-reliability-audit"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-steel hover:text-ink"
            )}
          >
            Audit
          </Link>
          <Link
            href="/login"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-steel hover:text-ink"
            )}
          >
            Sign In
          </Link>
          <Button asChild size="sm" variant={isDemo ? "subtle" : "default"}>
            <Link href="/signup">Get Started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
