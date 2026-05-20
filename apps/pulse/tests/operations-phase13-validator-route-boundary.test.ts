import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "app/api/actions/operations");

const VALIDATOR_ROUTES = [
  "ingest/validate/route.ts",
  "lifecycle/create/validate/route.ts",
  "lifecycle/transition/validate/route.ts",
  "verification/write/validate/route.ts",
];

for (const relPath of VALIDATOR_ROUTES) {
  test(`phase13 validator route boundary: ${relPath}`, () => {
    const file = readFileSync(path.join(ROOT, relPath), "utf8");

    assert.match(file, /from\s+["'].*_response["']/);
    assert.match(file, /phase13ErrorResponse/);
    assert.match(file, /phase13ValidationRejectionResponse/);
    assert.match(file, /phase13AcceptedValidationResponse/);

    // All response payload/status shaping must remain helper-owned.
    assert.doesNotMatch(file, /NextResponse\.json\(/);
    assert.doesNotMatch(file, /new NextResponse\(/);
  });
}
