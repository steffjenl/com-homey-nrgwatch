---
title: Observability
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./app.js
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
  - path: ./lib/nrgwatch-api.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-wtw-wifi/device.js
references:
  - name: Homey SDK v3 Logging
    url: https://apps.developer.homey.app/the-basics/app/logging
  - name: homey-log
    url: https://www.npmjs.com/package/homey-log
---

# Observability

---

## 1. Logging Strategy

The plugin uses the **Homey SDK logging API** exclusively. No structured logging library is used.

### Log Methods

| Method | Class / Context | Severity | When used |
|--------|----------------|----------|-----------|
| `this.log(...)` | Device, Driver, App | INFO | Normal operation events |
| `this.error(...)` | Device, Driver | ERROR | Error conditions |
| `this.homey.log(...)` | Lib classes (via `homey` ref) | INFO | HTTP requests, WS events |
| `this.homey.error(...)` | Lib classes | ERROR | HTTP failures, parse errors |
| `this.homey?.log(...)` | Lib classes (optional chain) | INFO | Guards against `homey` being null |

Logs are visible in:
- **Homey Developer Tools** (live tail during development)
- **Homey app crash log** via `homey-log` package (runtime in production)

### Log Level Coverage

| Level | Supported | Notes |
|-------|-----------|-------|
| DEBUG | ❌ | No debug-level filtering; all `this.log` calls are always emitted |
| INFO | ✅ | Default level for all `this.log` calls |
| WARN | ❌ | No `warn` method used |
| ERROR | ✅ | `this.error` / `this.homey.error` |

---

## 2. Log Events Inventory

### App (`app.js`)

| Event | Message | Code ref |
|-------|---------|---------|
| App init | `'NRGWatch has been initialized'` | `app.js:18` |
| Flow cards registered | `'Flow cards registered'` | `app.js:32` |

### CVE Driver (`drivers/itho-cve-wifi/driver.js`)

| Event | Message | Code ref |
|-------|---------|---------|
| Driver init | `'IthoCveWifiDriver has been initialized'` | `driver.js:15` |
| Pairing started | `'searching for itho-cve-wifi'` | `driver.js:21` |
| View change | `'currentView: {view}'` | `driver.js:25` |
| mDNS results | `Object.values(discoveryResults)` | `driver.js:29` |
| Set IP | `'set_ip', data` | `driver.js:44` |
| Set settings | `'set_settings', data` | `driver.js:57` |
| Connection attempt | `'getDeviceArray - connecting to: <host>'` | `driver.js:100` |
| Connection success | `'getDeviceArray - connected to: <host>'` | `driver.js:102` |
| Find devices | `'findDevices', deviceArray` | `driver.js:115` |
| Retry attempt | `'findDevices - try: N'` | `driver.js:144` |
| Devices found | `'Found devices - ', devices` | `driver.js:85` |

### CVE Device (`drivers/itho-cve-wifi/device.js`)

| Event | Message | Code ref |
|-------|---------|---------|
| Device init | `'IthoCveWifi has been initialized'` | `device.js:51` |
| Fan mode set | `'Setting fan_mode to', value` | `device.js:28` |
| Fan speed set | `'Setting fan_speed to', value` | `device.js:33` |
| Button join/leave | `'Setting fan_mode to', 'join'/'leave'` | `device.js:38,43` |
| Capability added | `'Added <cap> capability'` | various |
| Capability removed | `'Removed <cap> capability'` | various |
| Status fetched | `'Fetched IthoCveWifi status'` | `device.js:220` |
| Current speed | `'Current speed: <n>'` | `device.js:222` |
| Device added | `'IthoCveWifi has been added'` | `device.js:274` |
| Settings changed | `'IthoCveWifi settings where changed'` | `device.js:310` |
| Device renamed | `'IthoCveWifi was renamed'` | `device.js:320` |
| Device deleted | `'IthoCveWifi has been deleted'` | `device.js:327` |
| Status error | `'Error fetching IthoCveWifi status:', error` | `device.js:265` |

### WebClient (`lib/web-client.js`)

| Event | Message | Code ref |
|-------|---------|---------|
| GET request | `'WebClient GET <resource> with params: <json>'` | `web-client.js:68` |
| HTTP error | `'HTTP request error:', error.message` | `web-client.js:89` |
| Connection test error | `'Connection test error:', error.message` | `web-client.js:162` |

### NRGWatchApi (`lib/nrgwatch-api.js`)

| Event | Message | Code ref |
|-------|---------|---------|
| Fan mode command | `'Setting fan mode to <json>'` | `nrgwatch-api.js:141` |
| Fan speed command | `'Setting fan speed to <n>%'` | `nrgwatch-api.js:169` |
| RF fan mode | `'Setting RF fan mode to <json>'` | `nrgwatch-api.js:192` |
| Status error | `'Failed to get device status:', error.message` | `nrgwatch-api.js:99` |
| Speed error | `'Failed to get current speed:', error.message` | `nrgwatch-api.js:131` |
| Fan mode error | `'Failed to set fan mode:', error.message` | `nrgwatch-api.js:154` |
| Fan speed error | `'Failed to set fan speed:', error.message` | `nrgwatch-api.js:180` |
| RF mode error | `'Failed to set RF fan mode:', error.message` | `nrgwatch-api.js:202` |

### WebSocket (`lib/web-socket.js`)

| Event | Message | Code ref |
|-------|---------|---------|
| Heartbeat sent | `'Send heartbeat ping to websocket'` | `web-socket.js:52` |
| Pong received | `'Received pong from websocket'` | `web-socket.js:127` |
| WS URL | `'Update listener: <url>'` | `web-socket.js:97` |
| Connected | `'<host>: Connected to the realtime update events API.'` | `web-socket.js:117` |
| Close | (sets `loggedInStatus = 'Disconnected'`) | `web-socket.js:130` |
| Error | `'<host>: <error>'` | `web-socket.js:142` |
| Reconnect called | `'Called reconnectUpdatesListener'` | `web-socket.js:195` |
| Terminate called | `'Called terminate websocket'` | `web-socket.js:185` |
| WS event received | `'Websocket event received:', json` | `web-socket.js:246` |
| Parse error | `'Error processing websocket message:', error` | `web-socket.js:251` |

---

## 3. Correlation IDs

**There are no correlation IDs.** Each log line is independent. When debugging a sequence:
- Device identity can be inferred from `_serverHost` in WebSocket/WebClient messages
- Time ordering relies on Homey Developer Tools' timestamp

---

## 4. Health Indicators

| Indicator | Where | How accessed |
|-----------|-------|-------------|
| WebSocket connection status | `NRGWatchWebSocket.loggedInStatus` | `web-socket.js:29` — string: `'Unknown'` / `'Connecting'` / `'Connected'` / `'Disconnected'` / `<error message>` |
| WebSocket connected boolean | `NRGWatchWebSocket.isWebsocketConnected()` | `web-socket.js:71` — `true` if `readyState === OPEN` |
| Last WS message timestamp | `NRGWatchWebSocket.lastWebsocketMessage` | `web-socket.js:33` — ISO-format string `YYYY-MM-DDTHH:MM` |
| Polling alive | Implicit — errors appear in Homey log | No explicit health check |

> None of these are currently exposed through Homey device settings or a diagnostic capability.

---

## 5. Metrics

**No custom metrics are collected.** Homey platform provides:
- Capability value history (timeline) for all `insights: true` capabilities
- Automatic charting for: `measure_temperature`, `measure_humidity`, `measure_co2`, all `measure_number.*` and `measure_speed.*` custom capabilities

---

## 6. Failure Modes & Blind Spots

| Failure | Detection | Visibility | Gap |
|---------|-----------|-----------|-----|
| Device unreachable (network) | `req.on('error')` → `this.error` | Log only | No Homey `unavailable` state set |
| Request timeout (10 s) | `req.setTimeout` → `reject` | Log only | No device unavailability signal |
| Authentication failure | `_validateResponse` → throws | Log + thrown | Capability update silently skipped |
| Invalid JSON from firmware | `JSON.parse` throws | Log only | Status update silently skipped |
| Wrong firmware field names | Capability gets `undefined` / fallback `-1` | Silent | No warning logged for missing fields |
| WebSocket never connects | Not started — no error | Completely silent | No observable signal |
| Polling interval drift | `setInterval` at Homey scheduler | Not measured | Actual interval may drift |
| `fan_speed` unit mismatch | Values 0–100 stored in 0–2.55 capability | Silent wrong value | No validation |

---

## 7. Recommendations

1. **Set device unavailable** when HTTP requests consistently fail: call `this.setUnavailable(reason)` after N consecutive errors.
2. **Add structured log prefix** per device: `[${this.getName()}]` prepended to every log message for multi-device disambiguation.
3. **Expose WebSocket status** as a read-only `measure_string` capability (or device setting) to make connection health visible.
4. **Add correlation token** (e.g. UUID per poll cycle) to link request/response logs.
5. **Log firmware field fallback** when status fields are missing to aid debugging firmware version differences.

