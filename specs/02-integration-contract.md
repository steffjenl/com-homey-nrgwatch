---
title: Integration Contract
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
  - path: ./lib/nrgwatch-api.js
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/ApiResponse.h
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/IthoSystem.h
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/websocket.h
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/notifyClients.h
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/enum.h
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
  - name: NRG.Watch Firmware Source
    url: ./.ai/ithowifi/software/NRG_itho_wifi/
---

# Integration Contract

The integration surface between the **NRGWatch Homey plugin** and the **NRG.Watch WiFi module** (ESP32 firmware).

---

## 1. Protocols & Transport

| Channel | Protocol | Port | Direction | Status |
|---------|----------|------|-----------|--------|
| REST API | HTTP/1.1 (plain) | 80 | Plugin → Device (request/response) | ✅ Active |
| Real-time push | WebSocket (WSS) | 8000 | Device → Plugin | ⚠ Stub (not connected) |
| Discovery | mDNS-SD (`_http._tcp`) | — | Device → Network | ✅ Active |

> **⚠ WSS vs WS**: The plugin constructs `wss://` URLs (`web-socket.js:87`) but the firmware exposes a plain `ws://` server. The `rejectUnauthorized: false` option mitigates TLS errors but the protocol mismatch may prevent connection. See [10-open-questions.md](10-open-questions.md#ic-1) and [ADR-001](decisions/ADR-001-connection-strategy.md).

---

## 2. HTTP REST API

### Base URL

```
http://<host>:80
```

Where `<host>` is the device IP or mDNS hostname (e.g. `nrg-itho-ab12.local`).

### Single Endpoint

All interactions go through **one endpoint**:

```
GET /api.html
```

Parameters are passed as query string. See `NRGWatchApi.ENDPOINTS.API = 'api.html'` (`nrgwatch-api.js:19`).

---

### 2.1 Read Endpoints

#### Get Device Status

```
GET /api.html?get=ithostatus
```

| Field | Value |
|-------|-------|
| Method | `GET` |
| Query param | `get=ithostatus` |
| Auth | Optional (see §4) |
| Timeout | 10 000 ms (`web-client.js:32`) |
| Polling cadence | Default 15 s (configurable) |

**Response — Format A (older firmware, flat JSON):**
```json
{
  "temp": 21.5,
  "hum": 55,
  "CO2level (ppm)": 750,
  "Speed status": 3,
  "Fan speed (rpm)": 1200,
  "Fan setpoint (rpm)": 1100,
  "Ventilation setpoint (%)": 70,
  "Startup counter": 42,
  "Total operation (hours)": 1500,
  "Selection": 3
}
```

**Response — Format B (newer firmware, wrapped JSON):**
```json
{
  "data": {
    "ithostatus": {
      "temp": 21.5,
      "hum": 55,
      "co2level_ppm": 750,
      "speed-status": 3,
      "fan-speed_rpm": 1200,
      "fan-setpoint_rpm": 1100,
      "ventilation-setpoint_perc": 70,
      "startup-counter": 42,
      "total-operation_hours": 1500,
      "selection": 3
    }
  }
}
```

Plugin parsing: `nrgwatch-api.js:92–98` — tries `result.data.ithostatus` first, falls back to `result`.

---

#### Get Current Fan Speed

```
GET /api.html?get=currentspeed
```

**Response — Format A:**
```json
75
```

**Response — Format B:**
```json
{ "data": { "currentspeed": 75 } }
```

Plugin parsing: `nrgwatch-api.js:119–125`.

---

### 2.2 Write Endpoints (Commands)

All write operations are `GET` requests (firmware design). Plugin source: `nrgwatch-api.js:137–200`.

#### Direct Fan Mode Command

```
GET /api.html?command=<mode>
```

| Parameter | Values |
|-----------|--------|
| `command` | `low`, `medium`, `high`, `away`, `auto`, `autonight`, `timer1`, `timer2`, `timer3`, `cook30`, `cook60`, `motion_on`, `motion_off`, `join`, `leave` |

Used when `enableVirtualRemote=false` and `useRFRemote=false`.

---

#### Virtual Remote Command (CVE)

```
GET /api.html?vremoteindex=<n>&vremotecmd=<mode>
```

| Parameter | Values |
|-----------|--------|
| `vremoteindex` | `0`–`7` (maps to configured virtual remote slot) |
| `vremotecmd` | Same mode strings as above |

Used when `enableVirtualRemote=true`. Command built in `_buildFanModeCommand()` (`nrgwatch-api.js:214`).

---

#### RF Remote Command (WTW)

```
GET /api.html?rfremoteindex=<n>&rfremotecmd=<mode>
```

| Parameter | Values |
|-----------|--------|
| `rfremoteindex` | Configured `rfDeviceIndex` |
| `rfremotecmd` | Same mode strings |

Used by WTW device: `api.setFanMode(value, true)` (`device.js:29`).

Also available directly via `api.setRFFanMode(mode)` (`nrgwatch-api.js:185`).

---

#### Fan Speed (percentage)

```
GET /api.html?speed=<n>
```

| Parameter | Range | Validation |
|-----------|-------|-----------|
| `speed` | `0`–`100` | Validated client-side (`nrgwatch-api.js:163`); throws on out-of-range |

Used only when `enableVirtualRemote=false` (CVE only). Capability listener: `device.js:33–36`.

---

#### Virtual Remote Pair / Join

```
GET /api.html?command=join
GET /api.html?command=leave
```

Mapped to `button.join` and `button.leave` maintenance capabilities (`device.js:38–45`).
Only available within **2 minutes** after power cycling the Itho unit (firmware limitation).

---

### 2.3 Command Response Formats

| Response body | Meaning | Plugin handling |
|--------------|---------|----------------|
| `"OK"` | Command accepted | `_isSuccessResponse` → `true` (`nrgwatch-api.js:228`) |
| `{"status":"success"}` | Command accepted | Same |
| `{"status":"fail","data":{"failreason":"..."}}` | Command rejected | Throws `'API failure: <reason>'` |
| `{"status":"fail","data":{"code":401}}` | Auth failure | Throws auth error |
| `{"status":"error","message":"..."}` | Server error | Throws `'API error: <message>'` |

---

### 2.4 Connection Test

Used during pairing to probe the device and detect auth requirements:

```
GET /api.html?get=ithostatus[&username=<u>&password=<p>]
```

`WebClient.testConnection()` — `web-client.js:113–172`.

| Response | Interpretation |
|---------|---------------|
| HTTP 401 | Auth required (returns status code `401`) |
| HTTP 403 | Forbidden (returns status code `403`) |
| HTTP 200 | Connected OK (returns response body) |

---

## 3. Authentication & Authorisation

| Aspect | Detail | Source |
|--------|--------|--------|
| Method | HTTP Basic Auth | `web-client.js:183` |
| Header | `Authorization: Basic <base64(user:pass)>` | `web-client.js:190` |
| Query params | `&username=<u>&password=<p>` appended to every request | `web-client.js:184–186` |
| Trigger | `isAuthenticated === true` in device settings | `web-client.js:182` |
| Credentials storage | Homey device settings (platform-encrypted) | `drivers/*/device.js:15` |
| Token | No token/OAuth — only username + password | — |

> ⚠ Credentials appear in plain text in HTTP query strings (URL logs). See [09-risk-register.md](09-risk-register.md#R-3).

---

## 4. Reliability & Resilience

| Concern | Current behaviour | Recommendation |
|---------|------------------|----------------|
| **Timeouts** | 10 000 ms hard timeout per request (`web-client.js:32`) | Consider per-request configurable timeout |
| **Retries** | None — each poll is independent; failure is logged and ignored | Add exponential backoff — see [ADR-002](decisions/ADR-002-error-handling.md) |
| **Backoff** | None | — |
| **Circuit breaking** | None | — |
| **Polling on error** | `pollingInterval` continues regardless of errors | No cumulative back-off |
| **WS reconnect** | `reconnectNotificationsListener()` exists but is never called | Not applicable (WS not started) |
| **Idempotency** | All commands are `GET` — safe to re-send; firmware applies state | Naturally idempotent |

---

## 5. WebSocket Channel (⚠ stub)

### Connection details

| Field | Value | Source |
|-------|-------|--------|
| URL | `wss://<host>:8000` | `web-socket.js:87` |
| Port | 8000 | `NRGWatchWebSocket.CONFIG.PORT` — `web-socket.js:18` |
| Ping interval | 30 000 ms | `NRGWatchWebSocket.CONFIG.PING_INTERVAL` — `web-socket.js:17` |
| TLS verify | `false` (`rejectUnauthorized: false`) | `web-socket.js:108` |
| Per-message deflate | `false` | `web-socket.js:109` |
| Auth header | `Authorization: Bearer <_apiToken>` | `web-socket.js:106` — `_apiToken` property **does not exist** on `WebClient` |

### Firmware side

The firmware broadcasts JSON payloads to all connected WebSocket clients via `notifyClients(message)` and `wsSendAll()` (`notifyClients.h:49–51`). Root name provided to `jsonWsSend(rootName)` (`websocket.h:27`). Exact payload schema is **not yet documented** from firmware sources.

### Plugin side

- `launchNotificationsListener()` — creates `WebSocket` instance (`web-socket.js:92`)
- `configureNotificationsListener()` — attaches `on('message')` handler (`web-socket.js:216`)
- **Neither method is called** from any driver or device
- Message handler body is a `TODO` comment (`web-socket.js:248`)

---

## 6. mDNS Discovery

| Field | Value | Source |
|-------|-------|--------|
| Service type | `_http._tcp` | `.homeycompose/discovery/itho-cve-wifi.json` |
| Hostname pattern | `nrg-itho-[a-z0-9]{4}.local` | regex in discovery config |
| Discovery ID | `{{host}}` (hostname) | discovery config |
| Fallback | Manual IP entry (`pair/set_ip.html`) | `driver.js:44` |

---

## 7. Rate Limits & Quotas

The firmware imposes no documented rate limits. Practical constraints:

| Constraint | Value | Notes |
|-----------|-------|-------|
| Minimum safe poll interval | ~5 s | Below this the ESP32 may drop connections |
| Minimum configurable interval | `1` s (no lower bound enforced) | Settings allow any positive integer |
| Default poll interval | `15` s | `device.js:24` |
| Join/leave window | 2 min after power cycle | Firmware-enforced hardware constraint |

---

## 8. Observability of Requests

| What is logged | Where | Level |
|---------------|-------|-------|
| Every GET URL + params | `webclient.get()` → `homey.log` | info |
| Every fan mode command | `nrgwatch-api.js:141` | info |
| Every fan speed command | `nrgwatch-api.js:169` | info |
| HTTP errors | `web-client.js:reject` → `homey.error` | error |
| Request timeout | `web-client.js:req.setTimeout` | error (via reject) |
| Auth failures | `web-client.js:_validateResponse` | error (via throw) |

> **PII note**: username and password appear in logged query strings. See [09-risk-register.md](09-risk-register.md#R-3).

