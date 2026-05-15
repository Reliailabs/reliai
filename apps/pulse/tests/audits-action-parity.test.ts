import assert from "node:assert/strict";
import test from "node:test";

import {
  auditContinueReviewPath,
  auditCreateRunPath,
  auditRerunStagePath,
  auditStartRunPath,
  resolveAuditActionPath,
} from "@/lib/audits-action-contract";
import {
  canContinueReview,
  canRerunStage,
  canStartRun,
  resolveAuditDetailStateAfterAction,
  type AuditDetailState,
} from "@/lib/audits-surface-actions";

test("new_run hits correct contract path", () => {
  assert.equal(auditCreateRunPath("AUD-1"), "/api/v1/audits/AUD-1/runs");
  assert.equal(resolveAuditActionPath({ auditId: "AUD-1", action: "new_run" }), "/api/v1/audits/AUD-1/runs");
});

test("start hits correct contract path", () => {
  assert.equal(auditStartRunPath("AUD-1", "RUN-1"), "/api/v1/audits/AUD-1/runs/RUN-1/start");
  assert.equal(
    resolveAuditActionPath({ auditId: "AUD-1", action: "start", runId: "RUN-1" }),
    "/api/v1/audits/AUD-1/runs/RUN-1/start",
  );
});

test("continue hits correct contract path", () => {
  assert.equal(
    auditContinueReviewPath("AUD-1", "RUN-1"),
    "/api/v1/audits/AUD-1/runs/RUN-1/continue-review",
  );
  assert.equal(
    resolveAuditActionPath({ auditId: "AUD-1", action: "continue", runId: "RUN-1" }),
    "/api/v1/audits/AUD-1/runs/RUN-1/continue-review",
  );
});

test("rerun stage hits correct contract path", () => {
  assert.equal(
    auditRerunStagePath("AUD-1", "RUN-1", "validation"),
    "/api/v1/audits/AUD-1/runs/RUN-1/stages/validation/rerun",
  );
  assert.equal(
    resolveAuditActionPath({ auditId: "AUD-1", action: "rerun", runId: "RUN-1", stageKey: "validation" }),
    "/api/v1/audits/AUD-1/runs/RUN-1/stages/validation/rerun",
  );
});

test("action availability respects audit/run status", () => {
  assert.equal(canStartRun("queued"), true);
  assert.equal(canStartRun("running"), false);
  assert.equal(canContinueReview("needs_review"), true);
  assert.equal(canContinueReview("completed"), false);
  assert.equal(canRerunStage("running"), true);
  assert.equal(canRerunStage("queued"), false);
});

test("failed action does not mutate local audit detail state", () => {
  const current: AuditDetailState = {
    latest_run: { id: "RUN-1", status: "running" },
    stages: [{ id: "STAGE-1", stage_key: "testing", stage_label: "Testing", status: "running" }],
  };
  const refreshed: AuditDetailState = {
    latest_run: { id: "RUN-2", status: "queued" },
    stages: [{ id: "STAGE-2", stage_key: "scoping", stage_label: "Scoping", status: "queued" }],
  };
  const next = resolveAuditDetailStateAfterAction(current, refreshed, false);
  assert.deepEqual(next, current);
});
