# Pulse System Surface Classification

Date: 2026-05-21  
Status: Active contract

Source of truth for migration enforcement: `docs/pulse-system-surface-classification.json`.

## Decision Types

- `implement`: requires implementation follow-up in target phase.
- `defer`: intentionally postponed with owner + phase.
- `intentional_exception`: accepted parity shape (for example read-only presenter or redirect shim).

## Current Classification

| Route | Decision | Owner | Target phase | Why |
| --- | --- | --- | --- | --- |
| `/pulse/system` | intentional_exception | pulse-app | n/a | Active command center surface with no deferred parity placeholder copy. |
| `/pulse/system/platform` | intentional_exception | pulse-app | n/a | Read-only telemetry presenter is intentional. |
| `/pulse/system/pipeline` | intentional_exception | pulse-app | n/a | Read-only telemetry presenter is intentional. |
| `/pulse/system/extensions` | intentional_exception | pulse-app | n/a | Read-only telemetry presenter is intentional. |
| `/pulse/system/customers` | intentional_exception | pulse-app | n/a | Customer reliability board is intentional read-only intelligence. |
| `/pulse/system/growth` | intentional_exception | pulse-app | n/a | Growth telemetry is intentional read-only intelligence. |
| `/pulse/system/expansion` | intentional_exception | pulse-app | n/a | Expansion telemetry is intentional read-only intelligence. |
| `/pulse/system/reliability-patterns` | intentional_exception | pulse-app | n/a | Pattern board is advisory and intentionally read-only. |
| `/pulse/system/intelligence` | intentional_exception | pulse-app | n/a | Intelligence feed is advisory and intentionally read-only. |
| `/system` | intentional_exception | pulse-app | n/a | Legacy alias route is an intentional redirect shim to `/pulse/system`. |
