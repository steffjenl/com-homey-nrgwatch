---
title: ADR Index
status: Stable
last_updated: 2026-03-20
---

# Architectural Decision Records

ADR index for the NRGWatch Homey app. All decisions that affect the architecture, integration contract, or SDK usage are recorded here.

---

## Index

| ID | Date | Title | Status |
|----|------|-------|--------|
| [ADR-000](ADR-000-initial-refactoring.md) | 2026-02-09 | Initial Codebase Refactoring | Accepted |
| [ADR-001](ADR-001-connection-strategy.md) | 2026-03-20 | Connection Strategy: Polling vs WebSocket | Proposed |
| [ADR-002](ADR-002-error-handling.md) | 2026-03-20 | Error Handling & Retry Policy | Proposed |
| [ADR-003](ADR-003-capability-registration.md) | 2026-03-20 | Capability Registration: Static vs Dynamic | Proposed |

---

## Conventions

- **File name**: `ADR-<nnn>-<slug>.md` (e.g. `ADR-001-connection-strategy.md`)
- **Status lifecycle**: `Proposed` → `Accepted` / `Rejected` → `Superseded`
- **Superseded**: add `superseded_by: ADR-NNN` to front matter and link in the body
- **Template**: [ADR-TEMPLATE.md](ADR-TEMPLATE.md)

---

## Proposed Decisions Requiring Action

| ADR | Blocking issue | Next step |
|-----|---------------|-----------|
| ADR-001 | IC-1, IC-2 (WS protocol + payload schema) | Test against live device |
| ADR-002 | None | Ready to implement |
| ADR-003 | None — low-risk cleanup | Fix typo + remove duplicate declarations |

