import assert from "node:assert/strict";
import test from "node:test";

import { resolveScopedProjectId, resolveStrictScopedProjectId, type ProjectScopeOption } from "@/lib/project-scope-utils";

const projects: ProjectScopeOption[] = [
  { id: "proj_old", name: "Old", created_at: "2026-05-01T10:00:00.000Z" },
  { id: "proj_new", name: "New", created_at: "2026-05-10T10:00:00.000Z" },
  { id: "proj_mid", name: "Mid", created_at: "2026-05-05T10:00:00.000Z" },
];

test("resolveScopedProjectId returns explicit scoped project when present", () => {
  const selected = resolveScopedProjectId(projects, "proj_mid");
  assert.equal(selected, "proj_mid");
});

test("resolveScopedProjectId falls back to newest project when explicit scope missing", () => {
  const selected = resolveScopedProjectId(projects, "missing_project");
  assert.equal(selected, "proj_new");
});

test("resolveScopedProjectId falls back to newest project when scope is omitted", () => {
  const selected = resolveScopedProjectId(projects, null);
  assert.equal(selected, "proj_new");
});

test("resolveScopedProjectId returns null when no projects are available", () => {
  const selected = resolveScopedProjectId([], null);
  assert.equal(selected, null);
});

test("resolveStrictScopedProjectId returns explicit scoped project only", () => {
  const selected = resolveStrictScopedProjectId(projects, "proj_mid");
  assert.equal(selected, "proj_mid");
});

test("resolveStrictScopedProjectId fails closed when scope is omitted", () => {
  const selected = resolveStrictScopedProjectId(projects, null);
  assert.equal(selected, null);
});

test("resolveStrictScopedProjectId fails closed when scope is invalid", () => {
  const selected = resolveStrictScopedProjectId(projects, "missing_project");
  assert.equal(selected, null);
});
