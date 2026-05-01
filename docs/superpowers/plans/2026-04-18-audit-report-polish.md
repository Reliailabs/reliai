# Audit Report Polish + Traceability + Run History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve audit trust and operational clarity via (1) inspectable threshold logic, (2) decision-grade report narrative shared between UI and artifacts, (3) evidence-to-finding traceability, and (4) a compact previous-runs panel (last 6) on `/audits/[id]`.

**Architecture:** Add a small internal thresholds module (no UI) + a small report narrative builder used by audit results and artifacts. Extend audit detail response with `recent_runs` and render a compact panel on the audit detail page. Keep changes incremental inside existing audit services and pages.

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic (backend), Next.js app router + server actions (frontend), shared TS types in `packages/types`.

---

## File map (units + responsibilities)

**Backend**

- Create: `apps/api/app/services/audit_thresholds.py`
  - Centralizes certification-at-risk threshold values + deterministic context resolution + explainable reasons.
- Modify: `apps/api/app/services/audit_production_bridge.py`
  - Replace `_compute_certification_at_risk(...)` with threshold helper usage.
- Modify: `apps/api/app/services/audits.py`
  - Improve `AuditResultsRead.summary` / recommended actions narrative.
  - Add structured metadata to `executive_report`, `certification_report`, `evidence_bundle`.
  - Include recent runs in `AuditDetailResponse`.
- Modify: `apps/api/app/schemas/audit.py`
  - Extend `AuditDetailResponse` (add `recent_runs: list[AuditRunRead]`).
- Modify: `apps/api/tests/test_audits_closed_loop.py`
  - Add coverage for recent runs + threshold reason behavior + artifact metadata structure (tight tests).

**Shared types**

- Modify: `packages/types/src/index.ts`
  - Add `recent_runs` to `AuditDetailResponse` type.

**Frontend**

- Modify: `apps/web/lib/api.ts`
  - Types already include `AuditDetailResponse`; ensure compile after `packages/types` update.
- Modify: `apps/web/app/(app)/audits/[id]/page.tsx`
  - Render compact previous-runs panel (limit 6, newest first) with badges.
- Modify: `apps/web/app/(app)/audits/[id]/results/page.tsx`
  - Improve results hierarchy and finding traceability (evidence chips + affected surface, keep concise).

---

### Task 1: Branch + commit spec/plan docs

**Files:**

- Modify: `docs/superpowers/specs/2026-04-18-audit-report-polish-design.md`
- Create: `docs/superpowers/plans/2026-04-18-audit-report-polish.md`
- **Step 1: Create task branch**

Run:

```bash
git switch main
git pull --ff-only
git switch -c chore/audit-report-polish
```

- **Step 2: Stage and commit the spec + plan**

Run:

```bash
git add docs/superpowers/specs/2026-04-18-audit-report-polish-design.md docs/superpowers/plans/2026-04-18-audit-report-polish.md
git commit -m "docs: plan audit report polish pass"
```

---

### Task 2: Threshold helper module (inspectable thresholds + explainable reasons)

**Files:**

- Create: `apps/api/app/services/audit_thresholds.py`
- Modify: `apps/api/app/services/audit_production_bridge.py`
- Test: `apps/api/tests/test_audits_closed_loop.py`
- **Step 1: Add failing test for explainable threshold reasons**

Add a unit-style test that asserts the reason string changes when counts cross thresholds (keep deterministic).

Append to `apps/api/tests/test_audits_closed_loop.py`:

```python
def test_certification_at_risk_threshold_reasons_are_explainable(client, db_session):
    # Reuse existing fixture helpers from this file.
    operator = create_operator(db_session, email="threshold-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Threshold Org", slug="threshold-org")
    project = create_project(client, session, organization["id"], name="Threshold Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    # Inject incidents after certification effective time to trigger at-risk.
    env = db_session.scalar(select(Environment).where(Environment.project_id == UUID(project["id"])))
    assert env is not None
    # Add two critical incidents to cross the default threshold (>=2).
    for i in range(2):
        db_session.add(
            Incident(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=env.id,
                deployment_id=None,
                incident_type="reliability_drop",
                severity="critical",
                title=f"Critical post-cert incident {i}",
                status="open",
                fingerprint=f"threshold-critical-{i}-{run_id}",
                summary_json={"detail": "post-cert threshold"},
                started_at=datetime.now(timezone.utc) + timedelta(minutes=1 + i),
                updated_at=datetime.now(timezone.utc) + timedelta(minutes=1 + i),
                resolved_at=None,
                acknowledged_at=None,
                acknowledged_by_operator_user_id=None,
                owner_operator_user_id=None,
            )
        )
    db_session.commit()

    at_risk = client.get(f"/api/v1/projects/{project['id']}/audit-summary", headers=headers)
    assert at_risk.status_code == 200
    payload = at_risk.json()
    assert payload["certification_at_risk"] is True
    assert payload["certification_risk_reason"] is not None
    # Ensure the reason stays human-readable and not a raw ID dump.
    assert "incident" in payload["certification_risk_reason"].lower()
```

- **Step 2: Run test to verify it fails (until helper is implemented)**

Run:

```bash
pytest apps/api/tests/test_audits_closed_loop.py::test_certification_at_risk_threshold_reasons_are_explainable -q
```

Expected: FAIL (reason may still be None or logic not applied consistently).

- **Step 3: Implement threshold helper module**

Create `apps/api/app/services/audit_thresholds.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable


@dataclass(frozen=True)
class ThresholdContext:
    audit_type: str | None = None
    policy_profile: str | None = None
    environment: str | None = None
    project_criticality: str | None = None


@dataclass(frozen=True)
class CertificationAtRiskThresholds:
    critical_incidents_unresolved: int
    regressions: int
    guardrail_blocks: int


@dataclass(frozen=True)
class CertificationAtRiskEvaluation:
    at_risk: bool
    reason: str | None
    reasons: list[str]


DEFAULT_THRESHOLDS = CertificationAtRiskThresholds(
    critical_incidents_unresolved=2,
    regressions=5,
    guardrail_blocks=20,
)


def resolve_thresholds(context: ThresholdContext) -> CertificationAtRiskThresholds:
    # Deterministic resolution order (shallow in this pass):
    # global defaults -> audit_type -> policy_profile -> environment -> project_criticality.
    # Currently returns defaults; structure exists for future refinement.
    _ = context
    return DEFAULT_THRESHOLDS


def evaluate_certification_at_risk(
    *,
    certification_effective_at: datetime | None,
    thresholds: CertificationAtRiskThresholds,
    critical_incident_count: int,
    regression_count: int,
    guardrail_block_count: int,
) -> CertificationAtRiskEvaluation:
    if certification_effective_at is None:
        return CertificationAtRiskEvaluation(at_risk=False, reason=None, reasons=[])

    reasons: list[str] = []
    if critical_incident_count >= thresholds.critical_incidents_unresolved:
        reasons.append("Multiple unresolved critical incidents were detected after certification.")
    if regression_count >= thresholds.regressions:
        reasons.append("Repeated regression events exceeded the post-certification threshold.")
    if guardrail_block_count >= thresholds.guardrail_blocks:
        reasons.append("Guardrail block/reject events spiked above the post-certification threshold.")

    if not reasons:
        return CertificationAtRiskEvaluation(at_risk=False, reason=None, reasons=[])
    return CertificationAtRiskEvaluation(at_risk=True, reason=reasons[0], reasons=reasons)
```

- **Step 4: Wire helper into `audit_production_bridge.py`**

In `apps/api/app/services/audit_production_bridge.py`, replace `_compute_certification_at_risk(...)` internals with:

```python
from app.services.audit_thresholds import ThresholdContext, resolve_thresholds, evaluate_certification_at_risk
```

and inside `_compute_certification_at_risk(...)`:

```python
thresholds = resolve_thresholds(ThresholdContext())
evaluation = evaluate_certification_at_risk(
    certification_effective_at=certification_effective_at,
    thresholds=thresholds,
    critical_incident_count=critical_incident_count,
    regression_count=regression_count,
    guardrail_block_count=guardrail_spike,
)
return evaluation.at_risk, evaluation.reason
```

Keep the DB query logic the same; only move thresholds + reasoning into the helper.

- **Step 5: Run test to verify it passes**

Run:

```bash
pytest apps/api/tests/test_audits_closed_loop.py::test_certification_at_risk_threshold_reasons_are_explainable -q
```

Expected: PASS.

- **Step 6: Commit**

```bash
git add apps/api/app/services/audit_thresholds.py apps/api/app/services/audit_production_bridge.py apps/api/tests/test_audits_closed_loop.py
git commit -m "chore(audits): centralize certification risk thresholds"
```

---

### Task 3: Recent runs in audit detail response (limit 6)

**Files:**

- Modify: `apps/api/app/services/audits.py`
- Modify: `apps/api/app/schemas/audit.py`
- Modify: `packages/types/src/index.ts`
- Test: `apps/api/tests/test_audits_closed_loop.py`
- **Step 1: Add failing backend test for recent runs**

Append to `apps/api/tests/test_audits_closed_loop.py`:

```python
def test_audit_detail_includes_recent_runs(client, db_session):
    operator = create_operator(db_session, email="runs-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Runs Org", slug="runs-org")
    project = create_project(client, session, organization["id"], name="Runs Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]

    # Create a few additional runs.
    run_ids = [created["run"]["id"]]
    for _ in range(3):
        resp = client.post(f"/api/v1/audits/{audit_id}/runs", headers=headers)
        assert resp.status_code == 201
        run_ids.append(resp.json()["run"]["id"])

    detail = client.get(f"/api/v1/audits/{audit_id}", headers=headers)
    assert detail.status_code == 200
    payload = detail.json()
    assert "recent_runs" in payload
    assert len(payload["recent_runs"]) == 4
    assert payload["recent_runs"][0]["id"] == run_ids[-1]
```

- **Step 2: Run test to verify it fails**

```bash
pytest apps/api/tests/test_audits_closed_loop.py::test_audit_detail_includes_recent_runs -q
```

Expected: FAIL (`recent_runs` missing).

- **Step 3: Extend backend schema**

In `apps/api/app/schemas/audit.py`, update `AuditDetailResponse`:

```python
class AuditDetailResponse(APIModel):
    audit: AuditRead
    latest_run: AuditRunRead | None
    stages: list[AuditStageRead]
    findings_summary: FindingsSummaryRead
    artifacts: list[AuditArtifactRead]
    linked_production_context: ProductionSnapshotMetadata | None
    recent_runs: list[AuditRunRead] = []
```

- **Step 4: Populate `recent_runs` in service**

In `apps/api/app/services/audits.py` inside `get_audit_detail(...)`:

```python
recent_runs = list(
    db.scalars(
        select(AuditRun)
        .where(AuditRun.audit_id == audit.id)
        .order_by(desc(AuditRun.created_at), desc(AuditRun.id))
        .limit(6)
    ).all()
)
```

and include in return payload:

```python
return AuditDetailResponse(
    ...,
    recent_runs=recent_runs,
)
```

- **Step 5: Update shared TS types**

In `packages/types/src/index.ts`, extend `AuditDetailResponse`:

```ts
export interface AuditDetailResponse {
  audit: AuditRead;
  latest_run: AuditRunRead | null;
  stages: AuditStageRead[];
  findings_summary: AuditFindingsSummary;
  artifacts: AuditArtifactRead[];
  linked_production_context: ProductionSnapshotMetadata | null;
  recent_runs: AuditRunRead[];
}
```

- **Step 6: Run backend test again**

```bash
pytest apps/api/tests/test_audits_closed_loop.py::test_audit_detail_includes_recent_runs -q
```

Expected: PASS.

- **Step 7: Commit**

```bash
git add apps/api/app/services/audits.py apps/api/app/schemas/audit.py packages/types/src/index.ts apps/api/tests/test_audits_closed_loop.py
git commit -m "feat(audits): include recent runs in audit detail"
```

---

### Task 4: Report narrative + artifact metadata polish (concise, shared)

**Files:**

- Modify: `apps/api/app/services/audits.py`
- Test: `apps/api/tests/test_audits_closed_loop.py`
- **Step 1: Add failing test asserting artifact metadata keys**

Append:

```python
def test_audit_completion_writes_structured_report_metadata(client, db_session):
    operator = create_operator(db_session, email="report-owner@acme.test")
    session = sign_in(client, email=operator.email)
    headers = auth_headers(session)
    organization = create_organization(client, session, name="Report Org", slug="report-org")
    project = create_project(client, session, organization["id"], name="Report Project")

    created = _create_audit(client, headers, _default_payload(project_id=project["id"]))
    audit_id = created["audit"]["id"]
    run_id = created["run"]["id"]
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/start", headers=headers).status_code == 200
    assert client.post(f"/api/v1/audits/{audit_id}/runs/{run_id}/continue-review", headers=headers).status_code == 200

    # Verify executive_report artifact metadata has expected structure.
    artifacts = db_session.scalars(select(AuditArtifact).where(AuditArtifact.audit_run_id == UUID(run_id))).all()
    exec_rows = [a for a in artifacts if a.artifact_type == "executive_report" and not a.is_stale]
    assert exec_rows
    metadata = exec_rows[0].metadata_json or {}
    assert "decision" in metadata
    assert "blockers" in metadata
    assert "evidence_impact" in metadata
    assert "next_action" in metadata
```

- **Step 2: Run test and confirm it fails**

```bash
pytest apps/api/tests/test_audits_closed_loop.py::test_audit_completion_writes_structured_report_metadata -q
```

- **Step 3: Implement a small narrative builder inside `audits.py`**

Add helper functions near `_build_results(...)`:

```python
def _risk_level_label(score: float | None) -> str:
    if score is None:
        return "pending"
    if score >= 80:
        return "low"
    if score >= 60:
        return "moderate"
    if score >= 40:
        return "high"
    return "critical"


def _evidence_impact(snapshot: dict | None) -> dict:
    if not snapshot:
        return {"included": False, "summary": "No linked production snapshot was included in the decision."}
    incident_count = snapshot.get("incidentSummary", {}).get("count", 0)
    guardrail_count = snapshot.get("guardrailViolationSummary", {}).get("count", 0)
    regression_count = snapshot.get("regressionSummary", {}).get("count", 0)
    trace_count = snapshot.get("traceSampleSummary", {}).get("sampleCount", 0)
    surfaces = snapshot.get("topRiskySurfaces") or []
    return {
        "included": True,
        "classes": {
            "incidents": incident_count,
            "guardrail_violations": guardrail_count,
            "regressions": regression_count,
            "trace_samples": trace_count,
        },
        "top_surfaces": surfaces[:3],
        "summary": "Production evidence was included to confirm or adjust certification posture.",
    }
```

Then make `_build_results(...)` summary concise and decision-led:

- first line: `Decision: <status>. Risk: <level> (<score>). Blockers: <n>.`
- second line: `Required next action: ...`
- short evidence impact line (included/not included, top surfaces)
- **Step 4: Update artifact creation in `continue_audit_review(...)`**

When creating `executive_report`, `certification_report`, and `evidence_bundle`, set `metadata_json` to include:

```python
{
  "generated_at": ...,
  "decision": {"certification_status": run.certification_status, "risk_score": run.risk_score, "risk_level": _risk_level_label(run.risk_score)},
  "blockers": [{"title": f.title, "severity": f.severity, "surface": (f.recommended_scope or f.evidence_ref or f.category)} for f in blocking_findings[:3]],
  "required_remediation": [...],
  "recommended_improvements": [...],
  "evidence_impact": _evidence_impact(run.production_snapshot_metadata),
  "next_action": "Re-run certification after blocker remediation is complete." (or equivalent),
}
```

Keep the strings short and operational.

- **Step 5: Re-run the test**

```bash
pytest apps/api/tests/test_audits_closed_loop.py::test_audit_completion_writes_structured_report_metadata -q
```

Expected: PASS.

- **Step 6: Commit**

```bash
git add apps/api/app/services/audits.py apps/api/tests/test_audits_closed_loop.py
git commit -m "feat(audits): polish report narrative and artifact metadata"
```

---

### Task 5: Frontend — previous runs panel (compact list, badges)

**Files:**

- Modify: `apps/web/app/(app)/audits/[id]/page.tsx`
- **Step 1: Implement small presentational helpers**

Add local helpers in `apps/web/app/(app)/audits/[id]/page.tsx`:

```ts
function runBadge(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "running") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "queued") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-zinc-50 text-zinc-600 border-zinc-200";
}
```

- **Step 2: Render the “Previous runs” panel**

Under the existing summary column, add a `Card` that maps `detail.recent_runs` (already newest-first) and displays:

- created date (always)
- completed date (if set)
- run status badge
- certification badge (plain small pill)
- risk score (or `—`)
- label chips:
  - `Current run` if `run.id === detail.latest_run?.id`
  - `Latest completed` if `run.id === firstCompletedRunId`
  - `Pending / in progress` if status is `queued|running|needs_review` or certification is `pending`

Keep it visually compact (list rows, not a full table).

- **Step 3: Commit**

```bash
git add apps/web/app/(app)/audits/[id]/page.tsx
git commit -m "feat(web): add audit previous runs panel"
```

---

### Task 6: Frontend — results narrative + finding traceability (no raw IDs)

**Files:**

- Modify: `apps/web/app/(app)/audits/[id]/results/page.tsx`
- **Step 1: Implement evidence label derivation (client-side)**

Add helpers:

```ts
function evidenceLabels(f: { evidence_ref: string | null; recommended_scope: string | null }, snapshot: any) {
  const labels: string[] = [];
  if (snapshot?.incidentSummary?.count) labels.push("Incident history");
  if (snapshot?.traceSampleSummary?.sampleCount) labels.push("Trace samples");
  if (snapshot?.guardrailViolationSummary?.count) labels.push("Guardrail violations");
  if (snapshot?.regressionSummary?.count) labels.push("Regression signals");
  const surface = f.recommended_scope || (typeof f.evidence_ref === "string" ? f.evidence_ref : null);
  if (surface && surface.length < 64) labels.push(`Surface: ${surface}`);
  return labels.slice(0, 4);
}
```

Ensure these are human-readable labels and do not output raw IDs.

- **Step 2: Replace the findings table with compact cards**

For each finding:

- title + severity + blocker badge
- 1-line “why it matters” = existing `finding.summary`
- evidence chips = derived labels
- small footer row = validated, confidence, source stage (human-ish)

Keep page scannable; do not create large blocks of text.

- **Step 3: Commit**

```bash
git add apps/web/app/(app)/audits/[id]/results/page.tsx
git commit -m "feat(web): improve audit results narrative and evidence traceability"
```

---

### Task 7: Validation

- **Step 1: Run backend tests (focused)**

```bash
pytest apps/api/tests/test_audits_closed_loop.py -q
```

Expected: PASS.

- **Step 2: Web lint**

```bash
pnpm --filter web lint
```

Expected: PASS.

- **Step 3: Web build**

```bash
pnpm --filter web build
```

Expected: PASS.

---

