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
        isDemo ? "border-line bg-bg/95 text-textPrimary" : "border-default bg-page/90 text-primary"
      )}
    >
      <div className={`${marketingContainerClass} flex items-center justify-between py-4`}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold",
              isDemo ? "border-line bg-surface text-textPrimary" : "border-default bg-surface text-primary shadow-sm"
            )}
          >
            R
          </div>
          <div>
            <p className={cn("text-sm font-semibold tracking-tight", isDemo ? "text-textPrimary" : "text-primary")}>
              Reliai
            </p>
            <p
              className={cn(
                "text-xs uppercase tracking-[0.24em]",
                isDemo ? "text-textSecondary" : "text-secondary"
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
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-secondary hover:text-primary"
            )}
          >
            Product
          </Link>
          <Link
            href="/docs"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-secondary hover:text-primary"
            )}
          >
            Docs
          </Link>
          <Link
            href="/demo"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textPrimary" : "text-secondary hover:text-primary"
            )}
          >
            Demo
          </Link>
          <Link
            href="/pricing"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-secondary hover:text-primary"
            )}
          >
            Pricing
          </Link>
          <Link
            href="/ai-reliability-audit"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-secondary hover:text-primary"
            )}
          >
            Audit
          </Link>
          <Link
            href="/login"
            className={cn(
              "text-sm font-medium transition",
              isDemo ? "text-textSecondary hover:text-textPrimary" : "text-secondary hover:text-primary"
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
