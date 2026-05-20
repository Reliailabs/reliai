import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "app/api/actions/operations");

type RouteExpectation = {
  route: string;
  acceptedFlag: "create_accepted" | "transition_accepted" | "verification_write_accepted";
  policyMessage: string;
};

const ROUTES: RouteExpectation[] = [
  {
    route: "lifecycle/create/validate/route.ts",
    acceptedFlag: "create_accepted",
    policyMessage: "lifecycle-create persistence backend unavailable",
  },
  {
    route: "lifecycle/transition/validate/route.ts",
    acceptedFlag: "transition_accepted",
    policyMessage: "lifecycle-transition persistence backend unavailable",
  },
  {
    route: "verification/write/validate/route.ts",
    acceptedFlag: "verification_write_accepted",
    policyMessage: "verification-write persistence backend unavailable",
  },
];

for (const entry of ROUTES) {
  test(`phase13 route envelope consistency: ${entry.route}`, () => {
    const file = readFileSync(path.join(ROOT, entry.route), "utf8");
    assert.match(file, /phase13AcceptedValidationResponse/);
    assert.match(file, /phase13ValidationRejectionResponse/);
    assert.match(file, /phase13RejectedPolicyResponse/);
    assert.match(file, new RegExp(`\\{\\s*${entry.acceptedFlag}:\\s*false\\s*\\}`));
    assert.match(file, new RegExp(entry.policyMessage.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")));

    // Route envelope responses must be helper-owned, not hand-crafted status/json payloads.
    assert.doesNotMatch(file, /NextResponse\.json\(/);
  });
}
