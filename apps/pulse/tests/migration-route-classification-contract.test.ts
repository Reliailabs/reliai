import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type RouteKind = "page" | "route";
type Impact = "high" | "medium" | "low";
type Disposition =
  | "migrate_now"
  | "intentionally_externalized"
  | "obsolete"
  | "deferred_blocker";

type ClassificationItem = {
  id: string;
  kind: RouteKind;
  path: string;
  source_file: string;
  disposition: Disposition;
  impact: Impact;
  owner: string;
  target_phase: string;
};

type ClassificationFile = {
  items: ClassificationItem[];
};

const ROOT = path.resolve(process.cwd(), "..", "..");
const WEB_APP = path.join(ROOT, "apps", "web", "app");
const PULSE_APP = path.join(ROOT, "apps", "pulse", "app");
const CLASSIFICATION_FILE = path.join(ROOT, "docs", "pulse-unmatched-route-classification.json");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (entry.name === "page.tsx" || entry.name === "route.ts") {
      out.push(path.relative(dir.startsWith(WEB_APP) ? WEB_APP : PULSE_APP, abs));
    }
  }
  return out;
}

function normalize(relPath: string): { kind: RouteKind; routePath: string } {
  const parts = relPath.split(path.sep);
  const file = parts.pop();
  const kind: RouteKind = file === "route.ts" ? "route" : "page";
  const cleaned = parts.filter((part) => !(part.startsWith("(") && part.endsWith(")")));
  const routePath = `/${cleaned.join("/")}`;
  return { kind, routePath: routePath === "/" ? "/" : routePath };
}

function normalizedSet(base: string): Set<string> {
  const relFiles = walk(base, []);
  const set = new Set<string>();
  for (const rel of relFiles) {
    const normalized = normalize(rel);
    set.add(`${normalized.kind}:${normalized.routePath}`);
  }
  return set;
}

test("F6 contract: every unmatched web route is explicitly classified", () => {
  const web = normalizedSet(WEB_APP);
  const pulse = normalizedSet(PULSE_APP);
  const unmatched = [...web].filter((key) => !pulse.has(key)).sort();

  const classification = JSON.parse(readFileSync(CLASSIFICATION_FILE, "utf8")) as ClassificationFile;
  const classifiedKeys = new Set(
    classification.items.map((item) => `${item.kind}:${item.path}`),
  );

  const missingClassification = unmatched.filter((key) => !classifiedKeys.has(key));
  assert.deepEqual(
    missingClassification,
    [],
    `unmatched routes missing classification: ${missingClassification.join(", ")}`,
  );
});

test("F6 contract: classification entries are owner-complete and high-impact routes are not unowned", () => {
  const classification = JSON.parse(readFileSync(CLASSIFICATION_FILE, "utf8")) as ClassificationFile;

  for (const item of classification.items) {
    assert.ok(item.owner.trim().length > 0, `${item.id} missing owner`);
    assert.ok(item.target_phase.trim().length > 0, `${item.id} missing target_phase`);
  }

  const unresolvedHigh = classification.items.filter(
    (item) => item.impact === "high" && item.disposition !== "obsolete",
  );
  assert.ok(unresolvedHigh.length > 0, "expected high-impact unmatched routes to remain explicit");
  unresolvedHigh.forEach((item) => {
    assert.notEqual(item.disposition, "obsolete", `${item.id} high-impact route cannot be obsolete`);
  });
});
