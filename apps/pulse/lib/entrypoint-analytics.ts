export const ENTRYPOINT_ROUTES = ["/", "/demo", "/ai-reliability-audit", "/signup"] as const;
export type EntrypointRoute = (typeof ENTRYPOINT_ROUTES)[number];

export type EntrypointSourceAttribution = {
  source_route?: EntrypointRoute | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

export type EntrypointPageViewedEvent = {
  event: "entrypoint_page_viewed";
  route: EntrypointRoute;
  source_attribution?: EntrypointSourceAttribution;
};

export type EntrypointPrimaryCtaClickedEvent = {
  event: "entrypoint_primary_cta_clicked";
  route: EntrypointRoute;
  cta_id: string;
  destination: string;
  source_attribution?: EntrypointSourceAttribution;
};

export type EntrypointContinuityTransitionExecutedEvent = {
  event: "entrypoint_continuity_transition_executed";
  from_route: EntrypointRoute;
  to_route: EntrypointRoute;
  trigger: "cta_click";
  source_attribution?: EntrypointSourceAttribution;
};

export type EntrypointAnalyticsEvent =
  | EntrypointPageViewedEvent
  | EntrypointPrimaryCtaClickedEvent
  | EntrypointContinuityTransitionExecutedEvent;

export interface EntrypointAnalyticsAdapter {
  track(event: EntrypointAnalyticsEvent): void;
}

const ALLOWED_TRANSITIONS: Record<EntrypointRoute, EntrypointRoute[]> = {
  "/": ["/demo", "/ai-reliability-audit", "/signup"],
  "/demo": ["/", "/ai-reliability-audit", "/signup"],
  "/ai-reliability-audit": ["/", "/demo", "/signup"],
  "/signup": ["/", "/demo", "/ai-reliability-audit"],
};

const noopAdapter: EntrypointAnalyticsAdapter = {
  track: () => {},
};

const localAdapter: EntrypointAnalyticsAdapter = {
  track: (event) => {
    if (typeof window === "undefined") return;
    console.info("[pulse-entrypoint-analytics]", event);
    void fetch("/api/analytics/entrypoint-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event,
        event_time_utc: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {
      // Persistence failures are non-fatal for user flows.
    });
  },
};

let adapter: EntrypointAnalyticsAdapter = typeof window === "undefined" ? noopAdapter : localAdapter;
const seenPageViews = new Set<string>();

function safeTrack(event: EntrypointAnalyticsEvent) {
  try {
    adapter.track(event);
  } catch {
    // Analytics failures must never break navigation or UI flows.
  }
}

export function setEntrypointAnalyticsAdapter(nextAdapter: EntrypointAnalyticsAdapter) {
  adapter = nextAdapter;
}

export function isEntrypointRoute(path: string): path is EntrypointRoute {
  return (ENTRYPOINT_ROUTES as readonly string[]).includes(path);
}

export function isAllowedEntrypointTransition(from: EntrypointRoute, to: EntrypointRoute): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getEntrypointPathname(href: string): string | null {
  if (!href) return null;
  if (href.startsWith("/")) {
    return href.split("?")[0] ?? null;
  }
  try {
    return new URL(href).pathname;
  } catch {
    return null;
  }
}

export function extractEntrypointAttribution(searchParams?: URLSearchParams): EntrypointSourceAttribution | undefined {
  if (!searchParams) return undefined;
  const take = (key: string) => searchParams.get(key) ?? undefined;
  const attribution: EntrypointSourceAttribution = {
    utm_source: take("utm_source"),
    utm_medium: take("utm_medium"),
    utm_campaign: take("utm_campaign"),
  };
  return attribution.utm_source || attribution.utm_medium || attribution.utm_campaign ? attribution : undefined;
}

export function trackEntrypointPageViewed(route: EntrypointRoute, sourceAttribution?: EntrypointSourceAttribution) {
  const key = JSON.stringify({
    route,
    source_route: sourceAttribution?.source_route ?? null,
    utm_source: sourceAttribution?.utm_source ?? null,
    utm_medium: sourceAttribution?.utm_medium ?? null,
    utm_campaign: sourceAttribution?.utm_campaign ?? null,
  });
  if (seenPageViews.has(key)) return;
  seenPageViews.add(key);
  safeTrack({ event: "entrypoint_page_viewed", route, source_attribution: sourceAttribution });
}

export function trackEntrypointPrimaryCtaClicked(input: {
  route: EntrypointRoute;
  ctaId: string;
  destination: string;
  sourceAttribution?: EntrypointSourceAttribution;
}) {
  safeTrack({
    event: "entrypoint_primary_cta_clicked",
    route: input.route,
    cta_id: input.ctaId,
    destination: input.destination,
    source_attribution: input.sourceAttribution,
  });
}

export function trackEntrypointContinuityTransitionExecuted(input: {
  fromRoute: EntrypointRoute;
  toRoute: EntrypointRoute;
  sourceAttribution?: EntrypointSourceAttribution;
}) {
  if (!isAllowedEntrypointTransition(input.fromRoute, input.toRoute)) return;
  safeTrack({
    event: "entrypoint_continuity_transition_executed",
    from_route: input.fromRoute,
    to_route: input.toRoute,
    trigger: "cta_click",
    source_attribution: input.sourceAttribution,
  });
}

export function resetEntrypointAnalyticsStateForTests() {
  seenPageViews.clear();
}
