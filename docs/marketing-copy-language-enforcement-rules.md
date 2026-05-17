# Marketing Copy Language Enforcement Rules

Applies to all changes touching `apps/pulse/app/(marketing)/`, `apps/pulse/components/marketing-linear/`, and any copy surfaced on public-facing Reliai pages.

---

## Prohibited Generic SaaS Nouns

These words are banned from headlines, body copy, CTAs, and alt text on marketing surfaces:

| Banned term | Why banned |
|---|---|
| dashboard | Describes a format, not an outcome. Weakens reliability positioning. |
| solution | Enterprise vagueness. Does not describe what Reliai does. |
| tool | Understates what Reliai is. |
| software | Commodity framing. |
| platform (as standalone vague noun) | Acceptable only when qualified: "operational platform", never "the platform does X" |
| visibility | Overused SaaS word with no weight. Use "signal", "trace", "evidence", "record". |
| insights | Meaningless in technical contexts. Use "findings", "regressions", "failure patterns". |
| real-time | Overused. Use "live", "continuous", or describe the actual latency. |

**Exception:** Strategic contrast copy is allowed. Example: "not just a dashboard" is acceptable when it frames the contrast between commodity tools and a reliability control room. The rule prohibits dashboard as a positive descriptor, not as a contrast anchor.

---

## Approved Operational Language

Prefer language that names what Reliai actually does in production:

**Outcome verbs (preferred):**
- traces, scores, detects, surfaces, groups, correlates, routes, monitors, evaluates

**Evidence nouns (preferred):**
- trace, incident, regression, guardrail, deployment signal, failure pattern, reliability record, audit log, exposure score

**Positioning language (approved):**
- control room (not dashboard)
- reliability operations (not monitoring)
- production AI reliability (not AI observability)
- on-call signal (not alert)
- reliability evidence (not insights)
- exposure score / AREI (not risk meter)

---

## Pulse vs Reliai Naming Rules

**Use "Reliai" for:**
- Outcomes and value statements ("Reliai catches regressions before users do")
- Platform behavior descriptions ("Reliai groups signals into incidents")
- Trust and reliability claims
- Marketing headlines and body copy
- Any sentence that describes what the product does

**Use "Pulse" only for:**
- Concrete application surface references: the nav item, the footer link, the module name
- UI-specific component names when necessary for clarity (e.g., "the Pulse operations view")
- Internal engineering docs referring to the `apps/pulse` application

**Never write:**
- "Pulse dashboard"
- "Pulse platform"
- "Pulse monitors your AI"
- "View Pulse capabilities"

**Correct:**
- "Reliai monitors your AI"
- "Explore operational workflows"
- "Reliai turns production reliability signals into action"

---

## "Dashboard" Usage Restrictions

Dashboard is **prohibited** as a positive descriptor in marketing copy.

**Prohibited:**
- "View dashboard"
- "Explore the dashboard"
- "Pulse dashboard"
- "your reliability dashboard"
- "the operations dashboard"

**Acceptable (contrast only):**
- "not just a dashboard"
- "more than a dashboard — a control room"

**If the page is the actual operator system panel:** "operator panel" or "control panel" are acceptable. Never "dashboard" for marketing framing.

---

## CTA Enforcement Rules

CTAs must describe the action or outcome the user gets, not the format they are viewing.

**Prohibited CTA patterns:**
- "View dashboard" — describes format
- "View Pulse capabilities" — describes format
- "Explore the platform" — generic, no outcome
- "See how it works" — vague

**Approved CTA patterns:**
- "Run reliability audit" — clear action
- "Start with Evaluate" — tier-specific, concrete
- "Explore operational workflows" — acceptable (minimally generic)
- "Review an incident investigation" — outcome-anchored (preferred future state)
- "Replay a production failure" — outcome-anchored (preferred future state)
- "Walk through mitigation response" — outcome-anchored (preferred future state)

The strongest CTAs name buyer anxiety, not product features. Ideal CTAs should make a buyer feel they are about to see evidence of something they are afraid of missing in production.

---

## PR Review Checklist

For any PR touching marketing surfaces, reviewers must confirm:

- [ ] No prohibited generic SaaS nouns in headlines or body copy
- [ ] No "dashboard" as a positive descriptor
- [ ] "Pulse" only appears for concrete surface/module references
- [ ] "Reliai" is used for all outcome and value statements
- [ ] CTAs describe an action or outcome, not a format
- [ ] No new uses of "solution", "tool", "software", "visibility", "insights", "real-time" (unqualified)
- [ ] Hero headline anchors on a production problem or reliability outcome
- [ ] Copy does not describe internal tooling; it describes buyer-facing consequences

---

## Rejection Triggers

A PR touching marketing copy must be rejected if it introduces any of the following:

1. A headline using "dashboard", "solution", "tool", or "software"
2. A CTA that describes format instead of action (e.g., "View dashboard", "Explore the platform")
3. "Pulse dashboard" or "Pulse platform" anywhere in copy
4. A new occurrence of "visibility" or "insights" as outcome nouns
5. "Reliai" replaced with "Pulse" in a value statement
6. A hero section that describes what the product is instead of what production problem it solves

---

## Canonical Positioning Statements

These are approved and should be the source of truth for any positioning claims:

| Statement | Context |
|---|---|
| "Catch AI regressions before users do." | Tagline / homepage hero |
| "Upgrade when reliability becomes a job, not a side project." | Pricing page hero |
| "The moment Reliai becomes your control room." | Upgrade narrative headline |
| "Upgrade when the signal would otherwise break." | Trigger guide headline |
| "AI reliability operations for teams shipping AI changes." | One-liner product description |
| "AREI is a 0–100 reliability exposure score." | Technical copy / AREI explanation |

Do not paraphrase these in ways that reintroduce generic SaaS language.

---

## Future Copy Refinement Direction

Current approved copy that should be improved in future iterations:

| Current (acceptable) | Future target |
|---|---|
| "Operational demo preview" | "Review a live incident investigation" |
| "Explore operational workflows" | "Walk through a production failure response" |
| "Explore the platform" | "Run the reliability audit" or "Review reliability evidence" |

These are not current blockers. They are the direction copy should move toward as the demo and audit surfaces mature.

---

## Scope

This document applies to:
- `apps/pulse/app/(marketing)/` — all public marketing routes
- `apps/pulse/components/marketing-linear/` — all marketing components
- `apps/pulse/app/demo/` — demo route and any demo scenario surfaces
- Any product description copy in docs, sales materials, or onboarding flows

It does not apply to:
- Internal operator UI (`apps/pulse/app/(app)/`) — describe what the UI does, not what buyers fear
- Engineering docs — use precise technical language regardless of marketing rules
- Test files or fixtures
