---
title: Project Specifications Overview
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./ (all source files)
  - path: ./.ai/ithowifi/
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
  - name: Homey Developer
    url: https://apps.developer.homey.app/
  - name: GitHub Repository
    url: https://github.com/steffjenl/nl-nrgwatch-homey
---

# Project Specifications — NRGWatch for Homey

This folder contains living engineering documentation for the **NRGWatch Homey app** (`nl.monkeysoft.nrgwatch`) and its integration with the **NRG.Watch WiFi module** (Itho Daalderop ESP32 firmware in `.ai/ithowifi/`).

> **User-facing documentation** lives at [`../README.md`](../README.md).  
> **Contribution guidelines** live at [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## Purpose

Control and monitor **Itho Daalderop ventilation systems** (CVE exhaust fans and WTW heat-recovery units) from Homey, using the NRG.Watch WiFi add-on module as the local LAN bridge. The module exposes an HTTP REST API and a WebSocket stream; this Homey app polls the REST API and (partially) subscribes to the WebSocket.

## Key Flows

- **Device discovery** — mDNS-SD (`_http._tcp`, hostname `nrg-itho-XXXX.local`) or manual IP entry
- **Status polling** — `GET /api.html?get=ithostatus` + `GET /api.html?get=currentspeed` every _N_ seconds (default 15 s)
- **Fan mode control** — `GET /api.html?command=<mode>` / `?vremotecmd=<mode>` / `?rfremotecmd=<mode>`
- **Real-time updates** — WebSocket on port 8000 (**handler is a TODO stub** — see [10-open-questions.md](10-open-questions.md))
- **Pairing wizard** — loading → auto-discover or manual IP → settings/auth → list → add

## Current Maturity

**Alpha / Active Development** — Core polling and control are stable; WebSocket event handling and flow cards are stubs.

---

## Contents

| # | File | Description |
|---|------|-------------|
| — | [`source-inventory.md`](source-inventory.md) | Full file inventory + module dependency graph |
| 00 | [`00-architecture.md`](00-architecture.md) | High-level architecture, component diagram, runtime flows |
| 01 | [`01-domain-model.md`](01-domain-model.md) | Entities, DTOs, fan mode taxonomy, error model |
| 02 | [`02-integration-contract.md`](02-integration-contract.md) | HTTP API + WebSocket contract with ESP32 firmware |
| — | [`api-reference.md`](api-reference.md) | Full JS class API reference (migrated from root `API.md`) |
| 03 | [`03-homey-sdk-mapping.md`](03-homey-sdk-mapping.md) | Homey SDK v3 concepts: drivers, capabilities, flows, discovery |
| 04 | [`04-configuration.md`](04-configuration.md) | Device settings, defaults, virtual remote types |
| 05 | [`05-observability.md`](05-observability.md) | Logging strategy, blind spots, health indicators |
| 06 | [`06-test-plan.md`](06-test-plan.md) | Test matrix, fixtures, mocks, runnable commands |
| 07 | [`07-coding-standards.md`](07-coding-standards.md) | Code style, lint rules, naming, patterns (migrated from `QUICK_REFERENCE.md`) |
| 08 | [`08-performance.md`](08-performance.md) | Polling cadence, timeouts, resource usage, tuning |
| 09 | [`09-risk-register.md`](09-risk-register.md) | Risks, impact/likelihood, mitigations |
| 10 | [`10-open-questions.md`](10-open-questions.md) | Unresolved items + proposed next steps |
| — | [`assumptions.md`](assumptions.md) | All assumptions with justification and confidence |
| — | [`glossary.md`](glossary.md) | Project-specific terminology |
| — | [`CHANGELOG.md`](CHANGELOG.md) | Version history (migrated from root `CHANGELOG.md`) |
| — | [`decisions/`](decisions/README.md) | Architectural Decision Records (ADRs) |

---

## ADR Index (quick view)

| ID | Title | Status |
|----|-------|--------|
| [ADR-000](decisions/ADR-000-initial-refactoring.md) | Initial Codebase Refactoring | Accepted |
| [ADR-001](decisions/ADR-001-connection-strategy.md) | Connection Strategy: Polling vs WebSocket | Proposed |
| [ADR-002](decisions/ADR-002-error-handling.md) | Error Handling & Retry Policy | Proposed |
| [ADR-003](decisions/ADR-003-capability-registration.md) | Capability Registration: Static vs Dynamic | Proposed |

