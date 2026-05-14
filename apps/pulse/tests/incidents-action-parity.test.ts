import assert from "node:assert/strict";
import test from "node:test";

import { incidentAcknowledgePath, incidentOwnerPath, incidentReopenPath, incidentResolvePath } from "@/lib/incidents-action-contract";
import { optimisticAssigneeFromEmail, patchIncidentList, toSurfaceStatus } from "@/lib/incidents-surface-actions";
import type { IncidentSurfaceItem } from "@/components/dashboard/pulse-types";

function incidentFixture(): IncidentSurfaceItem {
  return {
    id: "INC-1",
    title: "Test incident",
    description: "desc",
    severity: "high",
    status: "investigating",
    duration: "1m",
    assignee: "Unassigned",
    assigneeInitials: "UA",
    impactedServices: ["svc-a"],
    timeline: [],
    intelligence: {
      contributingFactors: ["factor"],
      confidence: "insufficient",
      evidenceLinks: [],
      requiresOperatorReview: true,
    },
  };
}

test("owner assignment contract path uses /owner endpoint", () => {
  assert.equal(incidentOwnerPath("abc"), "/api/v1/incidents/abc/owner");
});

test("lifecycle action contract paths map to acknowledge/resolve/reopen endpoints", () => {
  assert.equal(incidentAcknowledgePath("abc"), "/api/v1/incidents/abc/acknowledge");
  assert.equal(incidentResolvePath("abc"), "/api/v1/incidents/abc/resolve");
  assert.equal(incidentReopenPath("abc"), "/api/v1/incidents/abc/reopen");
});

test("acknowledge maps to mitigating on incident detail/list patch", () => {
  const incidents = [incidentFixture()];
  const updated = patchIncidentList(incidents, "INC-1", { status: toSurfaceStatus("acknowledged") });
  assert.equal(updated[0]?.status, "mitigating");
});

test("resolve maps to resolved on incident detail/list patch", () => {
  const incidents = [incidentFixture()];
  const updated = patchIncidentList(incidents, "INC-1", { status: toSurfaceStatus("resolved") });
  assert.equal(updated[0]?.status, "resolved");
});

test("reopen maps to investigating on incident detail/list patch", () => {
  const incidents = [{ ...incidentFixture(), status: "resolved" as const }];
  const updated = patchIncidentList(incidents, "INC-1", { status: toSurfaceStatus("open") });
  assert.equal(updated[0]?.status, "investigating");
});

test("failed assign proxy can rollback optimistic assignee patch", () => {
  const base = [incidentFixture()];
  const optimistic = optimisticAssigneeFromEmail("owner@acme.test");
  const withOptimistic = patchIncidentList(base, "INC-1", optimistic);
  assert.equal(withOptimistic[0]?.assignee, "owner@acme.test");

  const rolledBack = patchIncidentList(withOptimistic, "INC-1", {
    assignee: "Unassigned",
    assigneeInitials: "UA",
  });
  assert.equal(rolledBack[0]?.assignee, "Unassigned");
  assert.equal(rolledBack[0]?.assigneeInitials, "UA");
});
