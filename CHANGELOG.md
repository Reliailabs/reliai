# Changelog

All notable changes to Reliai will be documented in this file.

---

## [Unreleased]

### Added

- Run-first audit workflow with DB-backed `/audits` product routes, run-scoped results, deterministic stage execution, and rerun invalidation semantics.
- Closed-loop Audit↔Production bridge with linked project evidence snapshots, project certification summary APIs, at-risk signaling, and monitoring recommendations.
- Audit schema migration for closed-loop tables (`audits`, `audit_runs`, `audit_stages`, `audit_findings`, `audit_artifacts`, linkage tables, and `project_audit_summaries`) with explicit org+project uniqueness and stale-state fields.
- Public `/ai-reliability-audit` process section updated to customer-facing five-stage audit flow.
- AI root-cause explanation panel that interprets deterministic evidence beneath the root-cause block.
- AI ticket draft modal that generates editable incident tickets from deterministic evidence.
- Limit visibility system with /system/limits endpoint, global banner, and contextual limit states.
- Limit banners now show window-grounded counters, storage impact context, and a recovery confirmation message.
- Projects hub page that lists project controls with direct links to key project surfaces.
- AI Reliability Audit landing page with dedicated conversion flow and homepage audit CTA.
- Global semantic color + typography tokens with shared utility classes for consistent UI hierarchy.
- Organization escalation policies backend with list endpoint and seeded defaults.
- web-v2 Settings page with operator, organization, and member visibility plus API key guidance.
- Project SLO backend with list endpoint and seeded defaults.
- Organization evaluation usage endpoint and dashboard evaluations usage tile.
- Trace analysis panel with summary, compare, and replay insights in web-v2 trace detail page.
- Evaluation replay page now uses real trace data and prompt versions in web-v2.
- Project detail page enhanced with guardrail metrics, cost, timeline, and model versions.
- Model versions tab in project detail showing version history and metadata.
- Reliability intelligence page with high-risk patterns, model reliability, prompt failures, and guardrail recommendations.
  - Advanced project subpages: guardrail configuration, custom-metric dashboards, ingestion-pipeline views, processor management, and project settings (web-v2 Tier-3).
  - Internal system operator pages: customer expansion, reliability intelligence, platform health, event pipeline telemetry, customer reliability dashboard, and system growth analytics (web-v2 Tier-4).
  - Missing incident pages: trace compare and investigation views (web-v2 parity).
- Regression compare page (/regressions/[id]/compare) for full route parity with original web app.
- Bidirectional navigation links between incident command center, trace compare, and investigation pages.
- Back navigation links on regressions detail, deployments detail, model versions, prompt versions, post-mortem, and audit pages.
- Loading skeleton states (loading.tsx) for 10 data-heavy routes.
- Error boundary states (error.tsx) for 10 data-heavy routes.
- Performance test infrastructure (Playwright config + page load metrics) for web-v2.
- Permanent redirect from /incidents/:id/command to /incidents/:id.
- Empty states for regressions list and deployments list.

### Changed

- Hardened project audit freshness logic so project summaries only present fresh certification when the latest relevant run is completed, non-pending, and non-invalidated.
- Settings team invite errors now hand off to `/signup` with preserved invite context instead of leaving a generic dead-end message, and the `/signup` surface now renders team-invite context when launched with `entry=team-invite`.
- Standardized production snapshot metadata contract (`evidenceWindow`, `incidentSummary`, `traceSampleSummary`, `guardrailViolationSummary`, `regressionSummary`, `modelChangeSummary`, `topRiskySurfaces`) across API and web UI.
- Improved deterministic audit executor output realism by varying findings/remediation by audit profile and anchoring evidence refs to production snapshot surfaces.
- Migrated key marketing, onboarding, and core product surfaces to semantic design tokens for higher readability.
- Restored demo/docs CTA styling and removed unintended white surfaces in the dashboard sidebar and docs/demo shells.
- Refined the /demo shell with framed light previews and dark walkthrough overlays to eliminate theme bleed and improve presentation clarity.
- web-v2 escalation policies now load from the organization escalation policies endpoint.
- web-v2 list filters now drive API queries via URL parameters, with traces cursor pagination and list limit controls.
- web-v2 regressions now aggregate project-scoped regressions and resolve project names; deployments resolve project display names.
- web-v2 projects surface now pulls reliability metrics per project for data-backed tiles.
- web-v2 SLOs now load from the new project SLO endpoint instead of derived client-side metrics.
- Updated all ported pages (customer detail, incident compare, incident investigate, project subpages) to match web-v2 dark theme design system.
- Migrated all remaining 17 pages from light theme to dark theme (zinc palette), eliminating all ink/steel/surface/line tokens.
- Fixed responsive breakpoints on dashboard, intelligence tables, and settings members grid for mobile stacking.
- Fixed conflicting gap utilities in dashboard layout.
- All ported pages now use rounded-lg consistently (replacing rounded-[28px]/[24px]/[30px]).

### Fixed

- Audit detail/results now exclude stale artifacts from current executive decision surfaces after rerun invalidation.
- Audit results and project control surfaces now correctly show pending/non-fresh posture when newer runs invalidate prior completed certification.
- Escalation policy seeding now succeeds by enforcing the organization foreign key.
- AI Summary no longer reuses cached output when the provider changes, and failures now surface as a safe error state instead of breaking the command route.
- Increased AI Summary body text contrast for readability.
- Refined AI root-cause explanation card hierarchy and readability to stay clearly subordinate to deterministic root-cause evidence.
- Improved AI Ticket Draft modal clarity and readability, plus contrast fixes for AI Summary and Explanation cards.
- AI ticket drafts now include deterministic root-cause confidence, omit generic impact filler, and improve copy + staleness UX.
- Fixed invalid CSS class bg-zinc-9000/10 in investigate page severityTone (should be bg-zinc-900/50).
- Fixed dead link to /incidents/:id/command in investigate page (now links to /incidents/:id).
- Fixed visible flash-of-white by adding loading skeletons to data-heavy routes.
- Incident reopen now deterministically reuses the most recently updated incident for a given fingerprint.
- AI root-cause explanation staleness now compares UTC-aware timestamps to avoid naive datetime drift.
- Trace detail now surfaces payload truncation when metadata limits are applied.
- Limit CTAs now respect settings-first hierarchy and remove upgrade prompts for operational limits.

---

## [2026-03-26] - Demo-ready simulation flow and command center proof

## Summary

- This release hardens the simulation-first onboarding flow and ensures the founder demo shows real prompt diffs and numeric root-cause confidence.

### Added

- PR template for consistent merge summaries and validation reporting.

### Changed

- Simulation prompt seeding now writes deterministic, distinct prompt content for baseline vs. failing windows.
- Onboarding simulation persists prompt content into incident summaries for prompt diff rendering.
- Root-cause confidence now renders as a numeric percentage in the command center.

### Fixed

- Dev fallback sign-in now preserves return-to routing for the simulation onboarding path.

### Validation

- `pytest apps/api/tests/test_onboarding_and_prompt_diff.py`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- Browser verification: canonical simulation flow, command center confidence, prompt diff content.

---

## [2026-03-25] - Onboarding -> Incident -> Prompt Diff Reliability Slice

## Summary

- This release completes the onboarding simulation to incident compare to Prompt Diff reliability slice and resolves the remaining merge blockers found during ship check.

### Added

- Completed the onboarding simulation to incident compare to Prompt Diff slice.
- Incident compare now returns prompt version contexts for onboarding-generated incidents when sufficient evidence exists.
- Prompt Diff now opens directly from compare-derived prompt version IDs.

### Changed

- Onboarding simulation flow remains deterministic through incident creation and redirect into Incident Command Center.
- Prompt Diff empty states are now evidence-aware:
  - Single prompt context: diff unavailable yet.
  - No prompt contexts: no prompt evidence yet.

### Fixed

- Resolved onboarding UI production build failures caused by invalid Button variant usage.
- Fixed simulation runner timer typing so Next.js production build succeeds.

### Validation

- Backend relevant suites passed.
- Web lint passed.
- Web production build passed.
- Browser sanity flow passed end-to-end:
  - `/onboarding?path=simulation`
  - simulation starts
  - redirect to `/incidents/{id}/command`
  - Prompt Diff tab renders

### Notes

- No API contract redesign introduced.
- No unrelated refactors added.
- Prompt Diff remains evidence-driven and falls back to a no-data state when evidence is insufficient.

### Commit Range

- Compare: https://github.com/Reliailabs/reliai/compare/c0f2278...090a7d7
