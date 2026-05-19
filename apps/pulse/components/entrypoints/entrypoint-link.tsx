"use client";

import type { ReactNode } from "react";

import {
  getEntrypointPathname,
  isEntrypointRoute,
  type EntrypointRoute,
  type EntrypointSourceAttribution,
  trackEntrypointContinuityTransitionExecuted,
  trackEntrypointPrimaryCtaClicked,
} from "@/lib/entrypoint-analytics";

type EntrypointLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  currentRoute: EntrypointRoute;
  ctaId?: string;
  sourceAttribution?: EntrypointSourceAttribution;
};

export function EntrypointLink({
  href,
  className,
  children,
  currentRoute,
  ctaId,
  sourceAttribution,
}: EntrypointLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        if (ctaId) {
          trackEntrypointPrimaryCtaClicked({
            route: currentRoute,
            ctaId,
            destination: href,
            sourceAttribution,
          });
        }
        const path = getEntrypointPathname(href);
        if (!path || !isEntrypointRoute(path) || path === currentRoute) return;
        trackEntrypointContinuityTransitionExecuted({
          fromRoute: currentRoute,
          toRoute: path,
          sourceAttribution,
        });
      }}
    >
      {children}
    </a>
  );
}
