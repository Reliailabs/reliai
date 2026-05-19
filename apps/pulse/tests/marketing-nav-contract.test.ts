import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("marketing navbar keeps Product and Demo as separate routes", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components/marketing-linear/navbar.tsx"),
    "utf8",
  );

  assert.match(source, /<a href="\/"[^>]*>\s*Product\s*<\/a>/);
  assert.match(source, /<a href="\/demo"[^>]*>\s*Demo\s*<\/a>/);
  assert.doesNotMatch(source, /<a href="\/demo"[^>]*>\s*Product\s*<\/a>/);
});
