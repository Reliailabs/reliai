# Changelog

All notable changes to Reliai will be documented in this file.

---

## [Unreleased]

### Added

- AI root-cause explanation panel that interprets deterministic evidence beneath the root-cause block.
- AI ticket draft modal that generates editable incident tickets from deterministic evidence.

### Fixed

- AI Summary no longer reuses cached output when the provider changes, and failures now surface as a safe error state instead of breaking the command route.
- Increased AI Summary body text contrast for readability.
- AI ticket drafts now include deterministic root-cause confidence, omit generic impact filler, and improve copy + staleness UX.

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
