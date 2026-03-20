---
title: Initial Codebase Refactoring
status: Accepted
date: 2026-02-09
deciders: [Stèphan Eizinga]
reviewers: []
tags: [architecture, code-quality, documentation]
---

# ADR-000 — Initial Codebase Refactoring

> This ADR documents a **completed decision** based on the refactoring described in the root `REFACTORING_SUMMARY.md` (now archived here).

---

## Context

The NRGWatch Homey app was initially built as a working prototype. Prior to the 1.0.0 release, the codebase contained:

- Leftover template code from a UniFi Access integration (`web-socket.js` contained non-NRG code)
- Raw `new Promise(...)` constructors throughout the library code
- No JSDoc documentation
- No constants (magic numbers for HTTP status, timeouts, ports)
- No input validation
- Mixed error handling patterns
- No architectural documentation

The goal was to bring the code to a publishable standard before the initial Homey App Store submission.

## Options

1. **Incremental improvement** — fix issues one by one in separate PRs
   - ✅ Smaller, reviewable changes
   - ❌ Slower; code stays inconsistent during the process

2. **Full refactor in one pass** — address all quality issues simultaneously
   - ✅ Consistent end-state; all docs updated together
   - ❌ Large diff; harder to review; risk of introducing bugs

## Decision

**Option 2 — Full refactor in one pass** was chosen for the 1.0.0 release.

## Consequences

### Positive
- Clean, documented codebase ready for public release
- `async/await` patterns throughout `lib/`
- Typed constants (`WebClient.HTTP_STATUS`, `WebClient.DEFAULTS`, `NRGWatchWebSocket.CONFIG`)
- JSDoc on all public methods and properties
- Extracted private helpers (`_buildHeaders`, `_buildRequestOptions`, `_validateResponse`, `_buildFanModeCommand`, `_isSuccessResponse`)
- Removed UniFi template artefacts

### Negative / Residual Issues
- WebSocket message handler was cleaned up but the TODO stub was left in place (Risk R-1)
- `wss://` URL scheme issue was not addressed (Risk R-2)
- Flow card stub was created but not implemented (Risk R-4)
- No automated tests were added (Risk R-13)

## Implementation Notes

Changes made (as documented in `REFACTORING_SUMMARY.md`):

| File | Changes |
|------|---------|
| `lib/base-class.js` | Added JSDoc, improved structure, type annotations |
| `lib/nrgwatch-api.js` | async/await, static constants, error handling, JSDoc, command builder, input validation |
| `lib/web-client.js` | HTTP status constants, timeout constants, error validation, extracted helpers, timeout handling, JSDoc |
| `lib/web-socket.js` | Removed UniFi code, config constants, connection management, error handling, JSDoc |
| `lib/virtual-remote-modus.js` | JSDoc for all mode definitions |
| `app.js` | Enhanced documentation, flow card structure preparation |

## References

- Code: `lib/web-client.js:17–32` (static constants)
- Code: `lib/nrgwatch-api.js:18–32` (endpoints + commands)
- Code: `lib/web-socket.js:16–19` (config constants)
- Historical: root `REFACTORING_SUMMARY.md` (archived — content migrated here)

