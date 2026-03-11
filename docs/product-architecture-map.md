# Reliai Product Architecture Map

Last updated: March 11, 2026

Maintenance rule:
- Update this document whenever the platform’s architecture, event flow, SDK behavior, storage layers, or operator control surfaces materially change.
- Keep it factual and implementation-oriented.

## Platform Overview

Reliai provides the reliability control plane for production AI systems.

Core loop:

Application runtime  
↓  
Reliai SDK  
↓  
Telemetry ingestion  
↓  
Reliability analysis  
↓  
Incident detection  
↓  
Mitigation

## Layer 1 — Application Runtime

Customer AI systems.

Examples:
- AI assistants
- copilots
- RAG pipelines
- AI support agents

Responsibilities:
- serving end-user requests
- calling model providers and tools
- emitting trace and guardrail context through the SDK

## Layer 2 — Reliai SDK

Language SDKs:
- Python
- Node

Capabilities:
- auto instrumentation
- trace spans
- guardrails
- policy enforcement
- distributed tracing
- replay helpers

Supported span types include:
- retrieval
- prompt_build
- llm_call
- tool_call
- postprocess

## Layer 3 — Telemetry Pipeline

Events produced:
- `trace_ingested`
- `trace_evaluated`
- `guardrail_triggered`
- `policy_violation`
- `deployment_created`

Events are stored in:
- `event_log`

Pipeline properties:
- append-only
- immutable
- replayable

## Layer 4 — Processing Engine

Processor system:
- core processors
- organization processors
- platform extensions
- external processors

Responsibilities:
- incident detection
- pattern mining
- risk scoring
- automation triggers
- downstream event fanout

## Layer 5 — Reliability Intelligence

Systems:
- pattern mining
- reliability graph
- global reliability intelligence
- deployment risk engine

Inputs:
- trace warehouse
- incident history
- deployment events
- event pipeline outputs

Outputs:
- guardrail recommendations
- graph-backed risk signals
- deployment safety explanations
- operator-facing investigation hints

## Layer 6 — Operator Control Plane

Primary product surfaces:
- control panel
- incidents
- incident command center
- trace graph
- deployment safety gate
- guardrails dashboard

Purpose:
- show current reliability state
- explain failures
- recommend mitigation
- support rollout decisions

## Layer 7 — Warehouse

Storage systems:
- Postgres for operational state
- ClickHouse for analytics and rollups

Used for:
- trace storage
- rollups
- customer metrics
- reliability analysis
- pattern mining inputs

## Platform Capabilities

Reliai currently supports:
- incident detection
- guardrail enforcement
- deployment safety gates
- trace replay
- reliability pattern mining
- global reliability intelligence
- runtime policy enforcement
- event replay
- processor observability
- customer reliability operations

## Developer Experience

Public surfaces:
- interactive demo
- failure playground
- SDK install section
- trace replay snippets

Developer workflows:
- SDK install
- trace replay
- trace debugging
- guardrail configuration
- deployment safety checks
- failure simulation in public marketing flows

## Why This Document Matters

The architecture map explains:
- how the system works
- where reliability decisions happen
- how telemetry flows through the platform

This is useful during:
- enterprise sales
- engineering onboarding
- investor discussions
- platform partnerships

## Related Documents

- [docs/sales-product-update.md](/Users/robert/Documents/Reliai/docs/sales-product-update.md)
- [docs/product-capabilities.md](/Users/robert/Documents/Reliai/docs/product-capabilities.md)
