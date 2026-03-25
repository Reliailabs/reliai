# Changelog

All notable changes to Reliai will be documented in this file.

---

## [Unreleased]

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
