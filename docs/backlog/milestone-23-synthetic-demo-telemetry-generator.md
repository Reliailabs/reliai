# Reliai Backlog

# Milestone 23 — Synthetic Demo Telemetry Generator

Priority: **Later Demo Infrastructure**

Purpose:

Introduce a dedicated synthetic telemetry generator for Reliai that continuously produces realistic AI-system signals without depending on customer traffic.

Primary outputs:

- AI traces
- tool spans
- guardrail failures
- deployment regressions

Primary uses:

- demos
- CI testing
- marketing screenshots

---

# Why This Matters

Reliai’s product story depends on rich, believable operational signals.

A synthetic telemetry generator would make it possible to:

- keep demo and screenshot states realistic
- exercise operator workflows continuously
- validate trace-graph depth and guardrail paths in CI
- avoid relying on customer environments for product proof

---

# Desired Capabilities

The generator should eventually produce:

- multi-span AI request traces
- nested tool execution spans
- retrieval and prompt-build spans
- runtime guardrail triggers
- prompt or deployment regression windows
- realistic throughput and service-activity signals

It should support both:

- deterministic scenario generation for CI
- steady-state mixed activity for demos and screenshots

---

# Example Synthetic Failure Patterns

- hallucination spike after prompt rollout
- retrieval latency regression
- tool failure cascade
- guardrail retry spike
- deployment safety regression

These patterns should map cleanly to existing Reliai surfaces:

- control panel
- incident command center
- trace graph
- deployment safety
- growth/demo telemetry surfaces

---

# Non-Goals For This Milestone

This backlog item is not part of the current frontend screenshot stability milestone.

It should not be used to justify:

- random screenshot data generation
- replacing deterministic frontend demo fixtures immediately
- broad backend demo-system work without a scoped follow-up sprint

---

# Likely Deliverables In A Future Sprint

- a standalone `reliai-synthetic-telemetry` package or service
- scenario definitions for AI reliability failures
- deterministic CI mode
- continuous demo mode
- integration path for screenshot generation and demo validation
