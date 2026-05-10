# Linear Marketing Redesign Decisions (Condensed)

## Intent
Use the Linear/Sprint template as a **presentation reference** for public marketing while keeping Reliai product truth anchored to implemented capabilities.

## Approved Design Influence
- Use Linear for:
  - section rhythm and pacing
  - motion/reveal cadence
  - visual polish
  - layout composition
- Do not use Linear for:
  - domain model
  - product claims
  - platform semantics
  - placeholder PM copy

## Scope Boundary
- Marketing surface remains in `apps/web`.
- Dashboard/product behavior remains in `apps/pulse`.
- Template usage is styling/motion influence only.

## Copy and Claims Rules
- Remove PM/productivity language entirely.
- Remove infra-first labels unless mapped to AI reliability semantics.
- Claims must map to implemented Reliai surfaces only:
  - AREI
  - incidents
  - traces
  - regressions
  - timeline
  - guardrails
  - audit readiness

## CTA Rules
- Primary CTA: `Run reliability audit` -> `/ai-reliability-audit`
- Secondary CTA label: `View Pulse dashboard` -> `/demo`
- Hero visual label must be explicit: `Pulse dashboard preview`

## Public Narrative Positioning
Homepage framing must communicate:
1. What Reliai monitors
2. What failure looks like
3. Why AREI matters
4. How Pulse turns signals into action
5. Where to start (audit or demo)

## Guardrails
- No fake logos or testimonials.
- No template mock data presented as product truth.
- No marketing copy that implies capabilities not implemented.

## Current Enforcement References
- `docs/template-migration-mapping.md`
- `docs/pulse-functional-migration-plan.md`
- `apps/web/app/(marketing)/page.tsx`

## Review Checklist for Future Marketing Edits
- Is this change style/rhythm only, not domain/capability drift?
- Do CTA labels and targets match approved mapping?
- Does copy map to actual product behavior in Pulse?
- Does any section introduce PM/infra template leakage?
- Are visual previews clearly labeled as previews?
