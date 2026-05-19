import assert from "node:assert/strict";
import test from "node:test";

import {
  filterEntrypointEvidenceByDays,
  normalizeEntrypointEvent,
  parseEntrypointEvidenceLine,
  toCSV,
  toJSONL,
  type EntrypointEvidenceRecord,
} from "@/lib/entrypoint-evidence";

test("normalizes allowed entrypoint events into canonical export shape", () => {
  const record = normalizeEntrypointEvent(
    {
      event: "entrypoint_primary_cta_clicked",
      route: "/demo",
      cta_id: "demo_primary",
      destination: "/signup",
      source_attribution: {
        source_route: "/",
        utm_source: "newsletter",
      },
    },
    "2026-05-19T00:00:00.000Z",
  );

  assert.deepEqual(record, {
    event_name: "entrypoint_primary_cta_clicked",
    event_time_utc: "2026-05-19T00:00:00.000Z",
    route: "/demo",
    from_route: null,
    to_route: null,
    cta_id: "demo_primary",
    destination: "/signup",
    source_route: "/",
    utm_source: "newsletter",
    utm_medium: null,
    utm_campaign: null,
  });
});

test("fails closed on unknown route", () => {
  assert.throws(
    () =>
      normalizeEntrypointEvent(
        {
          event: "entrypoint_page_viewed",
          route: "/unknown" as never,
        },
        "2026-05-19T00:00:00.000Z",
      ),
    /unknown_route/,
  );
});

test("fails closed when parsing unknown event name from persisted line", () => {
  const line = JSON.stringify({
    event_name: "unknown_event",
    event_time_utc: "2026-05-19T00:00:00.000Z",
    route: "/",
  });

  assert.throws(() => parseEntrypointEvidenceLine(line), /unknown_event/);
});

test("filters records by requested day window and emits reproducible csv/jsonl", () => {
  const records: EntrypointEvidenceRecord[] = [
    {
      event_name: "entrypoint_page_viewed",
      event_time_utc: "2026-05-18T00:00:00.000Z",
      route: "/",
      from_route: null,
      to_route: null,
      cta_id: null,
      destination: null,
      source_route: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    },
    {
      event_name: "entrypoint_page_viewed",
      event_time_utc: "2026-04-01T00:00:00.000Z",
      route: "/demo",
      from_route: null,
      to_route: null,
      cta_id: null,
      destination: null,
      source_route: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    },
  ];

  const filtered = filterEntrypointEvidenceByDays(records, 14, new Date("2026-05-19T00:00:00.000Z"));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.route, "/");

  const jsonl = toJSONL(filtered);
  assert.equal(jsonl.endsWith("\n"), true);
  assert.match(jsonl, /entrypoint_page_viewed/);

  const csv = toCSV(filtered);
  assert.equal(csv.endsWith("\n"), true);
  assert.match(csv.split("\n")[0] ?? "", /event_name,event_time_utc/);
});
