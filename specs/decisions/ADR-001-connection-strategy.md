---
title: Connection Strategy — Polling vs WebSocket
status: Proposed
date: 2026-03-20
deciders: [Engineering Team]
reviewers: []
tags: [architecture, reliability, websocket, polling]
---

# ADR-001 — Connection Strategy: Polling vs WebSocket

---

## Context

The NRGWatch app currently uses **HTTP polling** to retrieve device status every N seconds (default 15 s). A WebSocket infrastructure (`lib/web-socket.js`) exists but is:

1. **Never started** — no driver or device calls `launchNotificationsListener()`
2. **Handler not implemented** — `configureNotificationsListener()` has a `TODO` at line 248
3. **URL scheme mismatch** — plugin uses `wss://` but firmware likely exposes `ws://` (see Assumption A-1, Risk R-2)
4. **Token mismatch** — `_apiToken` referenced in `web-socket.js:106` does not exist on `WebClient` (Risk R-12)

The firmware broadcasts real-time updates to all connected WebSocket clients via `notifyClients()` (`notifyClients.h:49`). If implemented, this would allow capability updates immediately when the device state changes, instead of waiting for the next poll cycle.

**Constraints:**
- The plugin runs on Homey, which limits long-running background connections
- The exact WebSocket payload schema from the firmware is unknown (Open Question IC-2)
- The plugin must still work if the WebSocket connection is unavailable (e.g. older firmware)

---

## Options

### Option A — Polling only (current state, remove WS code)

Remove the non-functional WebSocket code entirely. Keep polling as the only update mechanism.

- ✅ Simple, proven, works with all firmware versions
- ✅ No connection state management needed
- ✅ Eliminates dead code and WSS/WS confusion
- ❌ Updates are delayed by up to `refreshInterval` seconds
- ❌ Constant HTTP traffic even when nothing has changed

### Option B — WebSocket only

Replace polling with a pure WebSocket connection.

- ✅ Immediate updates; no wasted polls
- ❌ Single point of failure — if WS drops, no updates
- ❌ Requires knowing full payload schema (IC-2)
- ❌ WSS/WS issue must be resolved first
- ❌ Older firmware may not support WS

### Option C — Hybrid: polling primary + WebSocket enhancement (recommended)

Keep polling as the reliable fallback. Additionally connect WebSocket when available and process incoming events to update capabilities immediately. If WS drops, polling continues.

- ✅ Resilient — polling guarantees updates even without WS
- ✅ Real-time updates when WS is available
- ✅ Backwards compatible with older firmware (WS simply not connected)
- ❌ More complex connection management
- ❌ Requires resolving IC-1 (WS vs WSS) and IC-2 (payload schema) first

---

## Decision

**Proposed: Option C — Hybrid polling + WebSocket**

Rationale:
- The polling mechanism is working and should remain as the reliability backbone
- WebSocket support is clearly intended (code exists, README mentions "real-time monitoring")
- The hybrid approach lets us ship the WS feature incrementally without breaking existing users

**However**: before implementing Option C, blockers IC-1 and IC-2 must be resolved.  
**Immediate action**: Fix the WSS → WS URL scheme (Risk R-2); remove the dead `_apiToken` reference (Risk R-12).

---

## Consequences

### Positive
- Users get immediate status updates when WS is active
- Reduced polling frequency becomes possible (e.g. 60 s fallback instead of 15 s)
- Real-time flow card triggers become feasible

### Negative
- Connection management complexity increases
- Must handle WS reconnect on disconnect/error
- Payload schema must be reverse-engineered or documented

### Risks
- Firmware WebSocket payload schema unknown until live device is tested (IC-2)
- WS connection may fail silently if URL scheme is wrong

### Follow-ups
1. Confirm `ws://` vs `wss://` via live device test (IC-1)
2. Capture WebSocket payload schema from firmware (IC-2)
3. Fix `wss://` → `ws://` in `web-socket.js:87`
4. Remove `_apiToken` reference; clarify WS auth mechanism (IC-3)
5. Call `launchNotificationsListener()` + `configureNotificationsListener()` from `device.js:onInit`
6. Implement event-to-capability mapping in `configureNotificationsListener`
7. On WS event: update relevant capabilities; reset poll timer to avoid redundant poll

## Implementation Notes

```javascript
// Suggested addition to device.js:onInit (after API setup)
try {
  this.api.websocket.launchNotificationsListener();
  this.api.websocket.configureNotificationsListener();
} catch (err) {
  this.log('WebSocket not available, falling back to polling only:', err.message);
}
```

Success criteria: capability values update within 2 s of a physical remote button press.

## References

- Code: `lib/web-socket.js:87` — WSS URL construction
- Code: `lib/web-socket.js:92–170` — `launchNotificationsListener`
- Code: `lib/web-socket.js:216–258` — `configureNotificationsListener` (TODO stub)
- Code: `drivers/itho-cve-wifi/device.js:13–50` — `onInit` (WS never called)
- Firmware: `.ai/ithowifi/software/NRG_itho_wifi/main/notifyClients.h:49`
- Firmware: `.ai/ithowifi/software/NRG_itho_wifi/main/websocket.h:27`
- Risks: [R-1](../09-risk-register.md#r-1), [R-2](../09-risk-register.md#r-2), [R-12](../09-risk-register.md#r-12)
- Open Questions: [IC-1](../10-open-questions.md#ic-1), [IC-2](../10-open-questions.md#ic-2), [IC-3](../10-open-questions.md#ic-3)

