---
title: Risk Register
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/web-socket.js
  - path: ./lib/web-client.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./app.js
  - path: ./app.json
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
---

# Risk Register

**Legend:**  
Impact: 🔴 High / 🟡 Medium / 🟢 Low  
Likelihood: 🔴 High / 🟡 Medium / 🟢 Low  
Priority = Impact × Likelihood

---

## Active Risks

| ID | Risk | Impact | Likelihood | Priority | Mitigation |
|----|------|--------|-----------|---------|-----------|
| R-1 | WebSocket handler is a TODO stub | 🔴 High | 🔴 High | **Critical** | Implement or document as not-yet-available |
| R-2 | WSS vs WS protocol mismatch | 🔴 High | 🔴 High | **Critical** | Fix URL scheme to `ws://` or confirm TLS is used |
| R-3 | Credentials in HTTP query string | 🟡 Medium | 🔴 High | **High** | Remove from query string; use Authorization header only |
| R-4 | Flow cards documented but not implemented | 🟡 Medium | 🔴 High | **High** | Implement flow cards or remove from docs/CHANGELOG |
| R-5 | `fan_speed` unit mismatch (0–2.55 vs 0–100) | 🟡 Medium | 🟡 Medium | **Medium** | Fix `capabilitiesOptions.fan_speed` to `min:0, max:100` |
| R-6 | `fan_speed`/`fan_setpoint` field mapping swapped | 🔴 High | 🟡 Medium | **High** | Verify against firmware, swap if incorrect |
| R-7 | No retry/backoff on HTTP failure | 🟡 Medium | 🟡 Medium | **Medium** | Add exponential backoff — see ADR-002 |
| R-8 | Device not set unavailable on network errors | 🟡 Medium | 🟡 Medium | **Medium** | Call `setUnavailable()` after N consecutive failures |
| R-9 | Dynamic capability add/remove causes state drift | 🟡 Medium | 🟢 Low | **Medium** | Move to static declarations — see ADR-003 |
| R-10 | `measure_string` capability declared but unused | 🟢 Low | 🔴 High | **Low** | Remove definition or implement usage |
| R-11 | No minimum poll interval enforced | 🟡 Medium | 🟢 Low | **Low** | Add validation: minimum 5 s |
| R-12 | `_apiToken` referenced in WebSocket but not on WebClient | 🔴 High | 🟡 Medium | **High** | Remove reference or implement token support |
| R-13 | No automated tests | 🔴 High | 🟡 Medium | **High** | Implement unit tests — see 06-test-plan.md |
| R-14 | Two sequential HTTP requests per poll (no parallelism) | 🟢 Low | 🔴 High | **Low** | Parallelize with `Promise.all` |
| R-15 | `Selection` → `fan_mode` mapping incomplete | 🟡 Medium | 🟡 Medium | **Medium** | Map all known selection values; log unknown ones |
| R-16 | Typo in method name `createAndRemoveCabapilities` | 🟢 Low | 🔴 High | **Low** | Rename on next refactor (breaking change) |

---

## Risk Details

### R-1 — WebSocket Handler Stub

**Description**: `web-socket.js:248` contains a `TODO: Add NRGWatch-specific event handling here` comment. The `launchNotificationsListener()` and `configureNotificationsListener()` methods are never called from any driver or device. Real-time capability updates are completely non-functional.

**Evidence**: `web-socket.js:248`, `device.js` — no call to `api.websocket.launchNotificationsListener()`

**Mitigation**: Either implement WebSocket event handling (see ADR-001) or explicitly document real-time updates as a future feature and remove the non-functional code to avoid confusion.

---

### R-2 — WSS vs WS Protocol Mismatch

**Description**: The plugin constructs WebSocket URLs with `wss://` (`web-socket.js:87`) but the NRG.Watch firmware exposes a plain `ws://` WebSocket server on port 8000. While `rejectUnauthorized: false` disables TLS verification, a `wss://` connection to a non-TLS server will likely fail at the protocol level.

**Evidence**: `web-socket.js:87` — `wss://${host}:${PORT}`, firmware `websocket.h` — plain WebSocket server

**Mitigation**: Change URL scheme to `ws://` or confirm that newer firmware versions support TLS WebSocket. See [ADR-001](decisions/ADR-001-connection-strategy.md).

---

### R-3 — Credentials in HTTP Query String

**Description**: `WebClient._buildHeaders()` appends `username` and `password` as query parameters to every authenticated request in addition to the `Authorization` header. Credentials appear in plaintext in server access logs, HTTP request logs, and any network capture.

**Evidence**: `web-client.js:184–186`

**Mitigation**: Remove `params.username = ...` and `params.password = ...` from `_buildHeaders`. Use only the `Authorization: Basic ...` header, which is the standard mechanism. Verify firmware accepts header-only auth.

---

### R-4 — Flow Cards Not Implemented

**Description**: The README, CHANGELOG, and `app.js:_registerFlowCards()` all mention flow card support, but no flow cards are declared in `app.json` and `_registerFlowCards()` only logs a message. Users expecting automation capabilities via flows will find none.

**Evidence**: `app.js:28–33`, `app.json` (no `flow` section), `README.md` "Flow card support for automation"

**Mitigation**: Either implement at least basic flow cards (trigger on CO2 threshold, action to set fan mode) or clearly document that flow cards are planned for a future release.

---

### R-6 — Fan Speed / Fan Setpoint Field Mapping Swapped

**Description**: In `device.js:240–243`, `Fan setpoint (rpm)` is mapped to `measure_speed.fan_speed` and `Fan speed (rpm)` is mapped to `measure_speed.fan_setpoint`. Based on the field names, these appear to be swapped.

**Evidence**: `device.js:240–243`
```javascript
this.setCapabilityValue('measure_speed.fan_speed', status['Fan setpoint (rpm)'] ...)  // ← setpoint
this.setCapabilityValue('measure_speed.fan_setpoint', status['Fan speed (rpm)'] ...)  // ← speed
```

**Mitigation**: Verify against firmware source `devices/cve14.h` which field is "current rpm" vs "target rpm", then correct the mapping.

---

### R-12 — `_apiToken` Reference in WebSocket

**Description**: The WebSocket connection attempt uses `this.homey.app.api.webclient._apiToken` for the Bearer token in the auth header. This property does not exist on `WebClient` — only `_userName` and `_passWord` are defined. When WebSocket is eventually activated, the token will be `undefined`.

**Evidence**: `web-socket.js:106`

**Mitigation**: Either remove the `Authorization` header from the WebSocket connection (firmware likely uses different auth), or implement `_apiToken` on `WebClient` if firmware supports JWT/Bearer tokens for WS.

---

### R-13 — No Automated Tests

**Description**: There are zero automated tests in the codebase. Regressions can only be caught by manual testing. The fan mode logic, command builder, response parser, and authentication handler are all untested.

**Mitigation**: Implement unit tests following [06-test-plan.md](06-test-plan.md). Priority: `WebClient._validateResponse`, `NRGWatchApi._buildFanModeCommand`, `NRGWatchApi._isSuccessResponse`.

