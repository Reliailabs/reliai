export function trackEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }
  // Replace with first-party analytics sink when available.
  console.info("[reliai-analytics]", { event, ...payload });
}
