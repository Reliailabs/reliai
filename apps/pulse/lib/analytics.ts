export function trackEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.info("[pulse-analytics]", { event, ...payload });
}
