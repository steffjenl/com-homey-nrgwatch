---
title: Open Questions
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/web-socket.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./app.js
  - path: ./.homeycompose/capabilities/measure_string.json
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/websocket.h
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
---

# Open Questions

Unresolved items requiring investigation or a decision before they can be closed. Each item references the risk or spec where it was raised.

---

## Integration Contract

### IC-1 — WSS vs WS: Does firmware support TLS WebSocket?

**Question**: The plugin connects with `wss://` (`web-socket.js:87`) but the firmware's `websocket.h` declares a plain WebSocket server. Does any version of the NRG.Watch firmware support TLS WebSocket on port 8000?

**Why it matters**: If the firmware only supports `ws://`, the connection will fail silently when WebSocket is eventually activated. Risk R-2.

**Proposed next step**: Check firmware changelog / `platformio.ini` TLS config, or test a live connection with `ws://` vs `wss://`.

**Related**: [ADR-001](decisions/ADR-001-connection-strategy.md), [09-risk-register.md](09-risk-register.md#r-2)

---

### IC-2 — WebSocket payload schema from firmware

**Question**: What is the exact JSON structure broadcast by `notifyClients(message)` / `jsonWsSend(rootName)` (firmware `notifyClients.h:49`, `websocket.h:27`)? What root names / event types exist?

**Why it matters**: Without knowing the payload schema, it is impossible to implement the WebSocket message handler in `web-socket.js:248`.

**Proposed next step**: Either run a WebSocket listener against a live device and capture packets, or trace `jsonWsSend` calls in `websocket.cpp` to find all root names and payload structures.

**Related**: [02-integration-contract.md §5](02-integration-contract.md#5-websocket-channel-⚠-stub), [09-risk-register.md](09-risk-register.md#r-1)

---

### IC-3 — Does firmware accept Bearer token for WebSocket auth?

**Question**: `web-socket.js:106` sends `Authorization: Bearer <_apiToken>` when connecting to the WebSocket. `_apiToken` does not exist on `WebClient`. Does the firmware require any authentication for the WebSocket connection, and if so, what mechanism?

**Why it matters**: Risk R-12 — when WebSocket is activated, auth will be `undefined`.

**Proposed next step**: Check firmware `websocket.cpp` / auth middleware for WS endpoint.

---

## Domain Model

### DM-1 — Are `fan_speed` and `fan_setpoint` capabilities swapped?

**Question**: In `device.js:240–243`, `Fan setpoint (rpm)` maps to capability `measure_speed.fan_speed` and `Fan speed (rpm)` maps to `measure_speed.fan_setpoint`. This appears backwards.

**Why it matters**: Users see wrong values for "Fan Speed" vs "Fan Setpoint" in Homey. Risk R-6.

**Proposed next step**: Check firmware source `devices/cve14.h` for which field name corresponds to current vs target RPM, then correct mapping if necessary.

---

### DM-2 — What `Selection` values correspond to `away`, `autonight`, `timer2`, `timer3`, etc.?

**Question**: `device.js:253–263` maps `Selection` integers 2, 3, 4, 5, 7 to modes. Values for `away`, `autonight`, `timer2`, `timer3`, `cook*`, `motion_*` are missing.

**Why it matters**: The plugin cannot reflect these modes back from device status; `fan_mode` in Homey will not update when the device is in one of these modes.

**Proposed next step**: Check firmware enum or documentation for all `Selection` values (likely in `devices/cve14.h` or `IthoSystem.h`).

---

## Homey SDK Mapping

### SDK-1 — What was `measure_string` intended for?

**Question**: `.homeycompose/capabilities/measure_string.json` defines a string-type custom capability, but it is never declared in any driver compose file or added in any device.

**Why it matters**: Dead configuration adds confusion. If it was planned for e.g. displaying firmware version or last command, it should be implemented; otherwise it should be removed.

**Proposed next step**: Determine original intent (git history may have context), then implement or delete.

---

### SDK-2 — What should `fan_speed` capability min/max/unit be?

**Question**: `capabilitiesOptions.fan_speed` in `driver.compose.json` declares `min:0, max:2.55, units:'0-255'` but the actual API uses percentages (0–100) and the listener multiplies by 100.

**Why it matters**: The Homey UI slider shows 0–2.55 but the value is 0–100. This is a confusing user experience.

**Proposed next step**: Change to `min:0, max:100, units:'%'` to match actual API semantics, or confirm if the max 255 is the raw firmware value.

---

### SDK-3 — Which flow cards should be implemented first?

**Question**: Flow cards are documented in README and CHANGELOG as a v1.0.0 feature but are completely absent. What is the intended set of triggers, conditions, and actions?

**Why it matters**: Risk R-4 — users expecting automation capabilities will find none.

**Proposed next step**: Define a minimal flow card set (e.g. trigger: CO2 exceeds threshold; action: set fan mode) and create an ADR or issue for implementation.

---

## Codebase

### CODE-1 — What should happen to `README.txt`?

**Question**: A `README.txt` file exists at root but its role is unclear (possibly an older plain-text version). Should it be deleted?

**Proposed next step**: Inspect content, delete if duplicate.

---

### CODE-2 — Should WTW device have more capabilities?

**Question**: `drivers/itho-wtw-wifi/driver.compose.json` only declares `fan_mode`. A WTW heat-recovery unit also measures temperature (supply/extract), humidity, and potentially CO2. Should these be added?

**Why it matters**: Users of WTW devices get far less monitoring value than CVE users.

**Proposed next step**: Check WTW firmware status fields in `devices/hru200.h` (or similar) and add matching capabilities.

---

### CODE-3 — Should `pollingInterval` be cleared before restarting in `onSettings`?

**Question**: In `device.js:onSettings`, `clearInterval` is called before starting a new interval. But the initial `pollingInterval` set in `onInit` uses the settings value at init time. If `onSettings` fires quickly after `onInit` before the first interval fires, is there a race condition?

**Why it matters**: Minor — could cause one extra poll immediately after settings change.

**Proposed next step**: Verify Homey SDK guarantees sequential lifecycle calls or add a small guard.

