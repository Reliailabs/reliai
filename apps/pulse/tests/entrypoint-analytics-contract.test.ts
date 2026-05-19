import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEntrypointAttribution,
  getEntrypointPathname,
  isAllowedEntrypointTransition,
  isEntrypointRoute,
  resetEntrypointAnalyticsStateForTests,
  setEntrypointAnalyticsAdapter,
  trackEntrypointContinuityTransitionExecuted,
  trackEntrypointPageViewed,
  trackEntrypointPrimaryCtaClicked,
  type EntrypointAnalyticsEvent,
} from "@/lib/entrypoint-analytics";

test("entrypoint route guard accepts only canonical phase14 routes", () => {
  assert.equal(isEntrypointRoute("/"), true);
  assert.equal(isEntrypointRoute("/demo"), true);
  assert.equal(isEntrypointRoute("/ai-reliability-audit"), true);
  assert.equal(isEntrypointRoute("/signup"), true);
  assert.equal(isEntrypointRoute("/pricing"), false);
});

test("entrypoint transition graph allows only configured continuity edges", () => {
  assert.equal(isAllowedEntrypointTransition("/", "/demo"), true);
  assert.equal(isAllowedEntrypointTransition("/demo", "/signup"), true);
  assert.equal(isAllowedEntrypointTransition("/signup", "/ai-reliability-audit"), true);
  assert.equal(isAllowedEntrypointTransition("/", "/"), false);
});

test("entrypoint analytics emits page view, primary CTA, and continuity transition events", () => {
  resetEntrypointAnalyticsStateForTests();
  const events: EntrypointAnalyticsEvent[] = [];
  setEntrypointAnalyticsAdapter({
    track: (event) => events.push(event),
  });

  trackEntrypointPageViewed("/", { utm_source: "test" });
  trackEntrypointPrimaryCtaClicked({
    route: "/",
    ctaId: "home_hero_primary_audit",
    destination: "/ai-reliability-audit",
  });
  trackEntrypointContinuityTransitionExecuted({
    fromRoute: "/",
    toRoute: "/demo",
  });

  assert.equal(events.length, 3);
  assert.equal(events[0]?.event, "entrypoint_page_viewed");
  assert.equal(events[1]?.event, "entrypoint_primary_cta_clicked");
  assert.equal(events[2]?.event, "entrypoint_continuity_transition_executed");
});

test("entrypoint continuity transition ignores disallowed edges", () => {
  resetEntrypointAnalyticsStateForTests();
  const events: EntrypointAnalyticsEvent[] = [];
  setEntrypointAnalyticsAdapter({
    track: (event) => events.push(event),
  });

  trackEntrypointContinuityTransitionExecuted({
    fromRoute: "/",
    toRoute: "/",
  });
  assert.equal(events.length, 0);
});

test("entrypoint page view tracking is idempotent for duplicate route/attribution emits", () => {
  resetEntrypointAnalyticsStateForTests();
  const events: EntrypointAnalyticsEvent[] = [];
  setEntrypointAnalyticsAdapter({
    track: (event) => events.push(event),
  });

  trackEntrypointPageViewed("/", { utm_source: "pulse" });
  trackEntrypointPageViewed("/", { utm_source: "pulse" });
  trackEntrypointPageViewed("/", { utm_source: "pulse", utm_campaign: "x" });

  assert.equal(events.length, 2);
  assert.equal(events[0]?.event, "entrypoint_page_viewed");
  assert.equal(events[1]?.event, "entrypoint_page_viewed");
});

test("entrypoint analytics adapter failures are suppressed and do not throw", () => {
  resetEntrypointAnalyticsStateForTests();
  setEntrypointAnalyticsAdapter({
    track: () => {
      throw new Error("adapter-failure");
    },
  });

  assert.doesNotThrow(() => {
    trackEntrypointPageViewed("/demo");
    trackEntrypointPrimaryCtaClicked({
      route: "/demo",
      ctaId: "demo_header_primary_audit",
      destination: "/ai-reliability-audit",
    });
    trackEntrypointContinuityTransitionExecuted({
      fromRoute: "/demo",
      toRoute: "/signup",
    });
  });
});

test("entrypoint helper parses pathnames and preserves attribution keys", () => {
  assert.equal(getEntrypointPathname("/demo?x=1"), "/demo");
  assert.equal(getEntrypointPathname("https://example.com/signup?utm_source=a"), "/signup");
  assert.equal(getEntrypointPathname("invalid-url"), null);

  const attribution = extractEntrypointAttribution(
    new URLSearchParams("utm_source=pulse&utm_medium=email&utm_campaign=phase14"),
  );
  assert.deepEqual(attribution, {
    utm_source: "pulse",
    utm_medium: "email",
    utm_campaign: "phase14",
  });
});
