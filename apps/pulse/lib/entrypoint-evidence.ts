import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { EntrypointAnalyticsEvent } from "@/lib/entrypoint-analytics";

export const ENTRYPOINT_EVENT_NAMES = [
  "entrypoint_page_viewed",
  "entrypoint_primary_cta_clicked",
  "entrypoint_continuity_transition_executed",
] as const;

export type EntrypointEventName = (typeof ENTRYPOINT_EVENT_NAMES)[number];

export const ENTRYPOINT_ALLOWED_ROUTES = ["/", "/demo", "/ai-reliability-audit", "/signup"] as const;

export type AllowedEntrypointRoute = (typeof ENTRYPOINT_ALLOWED_ROUTES)[number];

export type EntrypointEvidenceRecord = {
  event_name: EntrypointEventName;
  event_time_utc: string;
  route: AllowedEntrypointRoute | null;
  from_route: AllowedEntrypointRoute | null;
  to_route: AllowedEntrypointRoute | null;
  cta_id: string | null;
  destination: string | null;
  source_route: AllowedEntrypointRoute | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export function isAllowedEntrypointEventName(value: string): value is EntrypointEventName {
  return (ENTRYPOINT_EVENT_NAMES as readonly string[]).includes(value);
}

export function isAllowedEntrypointRoute(value: string): value is AllowedEntrypointRoute {
  return (ENTRYPOINT_ALLOWED_ROUTES as readonly string[]).includes(value);
}

function toAllowedRoute(value: string | null | undefined): AllowedEntrypointRoute | null {
  if (!value) return null;
  if (!isAllowedEntrypointRoute(value)) {
    throw new Error(`unknown_route:${value}`);
  }
  return value;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value;
}

export function normalizeEntrypointEvent(event: EntrypointAnalyticsEvent, eventTimeUTC: string): EntrypointEvidenceRecord {
  if (!isAllowedEntrypointEventName(event.event)) {
    throw new Error(`unknown_event:${String((event as { event?: unknown }).event)}`);
  }

  if (Number.isNaN(Date.parse(eventTimeUTC))) {
    throw new Error("invalid_event_time_utc");
  }

  const sourceRoute = toAllowedRoute(event.source_attribution?.source_route ?? null);

  if (event.event === "entrypoint_page_viewed") {
    return {
      event_name: event.event,
      event_time_utc: eventTimeUTC,
      route: toAllowedRoute(event.route),
      from_route: null,
      to_route: null,
      cta_id: null,
      destination: null,
      source_route: sourceRoute,
      utm_source: toOptionalString(event.source_attribution?.utm_source),
      utm_medium: toOptionalString(event.source_attribution?.utm_medium),
      utm_campaign: toOptionalString(event.source_attribution?.utm_campaign),
    };
  }

  if (event.event === "entrypoint_primary_cta_clicked") {
    return {
      event_name: event.event,
      event_time_utc: eventTimeUTC,
      route: toAllowedRoute(event.route),
      from_route: null,
      to_route: null,
      cta_id: event.cta_id,
      destination: event.destination,
      source_route: sourceRoute,
      utm_source: toOptionalString(event.source_attribution?.utm_source),
      utm_medium: toOptionalString(event.source_attribution?.utm_medium),
      utm_campaign: toOptionalString(event.source_attribution?.utm_campaign),
    };
  }

  return {
    event_name: event.event,
    event_time_utc: eventTimeUTC,
    route: null,
    from_route: toAllowedRoute(event.from_route),
    to_route: toAllowedRoute(event.to_route),
    cta_id: null,
    destination: null,
    source_route: sourceRoute,
    utm_source: toOptionalString(event.source_attribution?.utm_source),
    utm_medium: toOptionalString(event.source_attribution?.utm_medium),
    utm_campaign: toOptionalString(event.source_attribution?.utm_campaign),
  };
}

export function getEntrypointEvidenceStorePath(): string {
  return path.resolve(process.cwd(), "artifacts/phase16/entrypoint-events.raw.jsonl");
}

export function appendEntrypointEvidenceRecord(record: EntrypointEvidenceRecord, storePath = getEntrypointEvidenceStorePath()) {
  mkdirSync(path.dirname(storePath), { recursive: true });
  const previous = (() => {
    try {
      return readFileSync(storePath, "utf8");
    } catch {
      return "";
    }
  })();
  const nextLine = `${JSON.stringify(record)}\n`;
  writeFileSync(storePath, previous ? `${previous}${nextLine}` : nextLine, "utf8");
}

export function parseEntrypointEvidenceLine(line: string): EntrypointEvidenceRecord {
  const value = JSON.parse(line) as Partial<EntrypointEvidenceRecord>;
  if (!value || typeof value !== "object") throw new Error("invalid_record");
  if (!value.event_name || !isAllowedEntrypointEventName(value.event_name)) {
    throw new Error("unknown_event");
  }
  if (!value.event_time_utc || Number.isNaN(Date.parse(value.event_time_utc))) {
    throw new Error("invalid_event_time_utc");
  }

  const normalizeRoute = (route: unknown): AllowedEntrypointRoute | null => {
    if (route == null) return null;
    if (typeof route !== "string" || !isAllowedEntrypointRoute(route)) {
      throw new Error("unknown_route");
    }
    return route;
  };

  return {
    event_name: value.event_name,
    event_time_utc: value.event_time_utc,
    route: normalizeRoute(value.route),
    from_route: normalizeRoute(value.from_route),
    to_route: normalizeRoute(value.to_route),
    cta_id: typeof value.cta_id === "string" ? value.cta_id : null,
    destination: typeof value.destination === "string" ? value.destination : null,
    source_route: normalizeRoute(value.source_route),
    utm_source: typeof value.utm_source === "string" ? value.utm_source : null,
    utm_medium: typeof value.utm_medium === "string" ? value.utm_medium : null,
    utm_campaign: typeof value.utm_campaign === "string" ? value.utm_campaign : null,
  };
}

export function filterEntrypointEvidenceByDays(records: EntrypointEvidenceRecord[], days: number, now = new Date()): EntrypointEvidenceRecord[] {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("invalid_days");
  }
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return records.filter((record) => new Date(record.event_time_utc) >= cutoff);
}

export function toJSONL(records: EntrypointEvidenceRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
}

export function toCSV(records: EntrypointEvidenceRecord[]): string {
  const headers = [
    "event_name",
    "event_time_utc",
    "route",
    "from_route",
    "to_route",
    "cta_id",
    "destination",
    "source_route",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ];
  const escape = (value: string | null): string => {
    if (value == null) return "";
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
      return `\"${value.replaceAll("\"", "\"\"")}\"`;
    }
    return value;
  };

  const lines = [headers.join(",")];
  for (const record of records) {
    lines.push(
      [
        record.event_name,
        record.event_time_utc,
        record.route,
        record.from_route,
        record.to_route,
        record.cta_id,
        record.destination,
        record.source_route,
        record.utm_source,
        record.utm_medium,
        record.utm_campaign,
      ]
        .map((value) => escape(value))
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
