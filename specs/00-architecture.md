---
title: Architecture
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./app.js
  - path: ./lib/base-class.js
  - path: ./lib/nrgwatch-api.js
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
  - path: ./lib/virtual-remote-modus.js
  - path: ./drivers/itho-cve-wifi/driver.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-wtw-wifi/driver.js
  - path: ./drivers/itho-wtw-wifi/device.js
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
  - name: Homey Developer
    url: https://apps.developer.homey.app/
---

# Architecture

> Migrated and enriched from root `ARCHITECTURE.md` (440 lines, last updated 2026-02-09).

---

## Overview

The **NRGWatch Homey app** controls and monitors **Itho Daalderop ventilation systems** (CVE exhaust fans, WTW heat-recovery units) through the **NRG.Watch WiFi module** — an ESP32-based add-on fitted to the Itho unit's I²C/CC1101 bus.

- **Protocol layer**: HTTP REST (port 80) for polling + commands; WebSocket (port 8000) for real-time push (*stub — not yet implemented*).
- **Discovery**: mDNS-SD (`_http._tcp`, hostname pattern `nrg-itho-XXXX.local`).
- **Auth**: optional HTTP Basic Auth (credentials in Authorization header **and** query string — firmware requirement).
- **No cloud dependency**: all communication is local LAN only.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Homey Platform                             │
│              (Homey SDK v3 / Homey >= 12.4.0)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Homey.App lifecycle
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NRGWatch App  (app.js)                      │
│  • onInit → _registerFlowCards() [stub]                         │
│  • toLocalTime() utility                                         │
└──────┬──────────────────────────────────────────────────────────┘
       │  Homey.Driver / Homey.Device auto-registration
       │
       ├──────────────────────┐
       ▼                      ▼
┌──────────────┐    ┌──────────────────┐
│  CVE Driver  │    │   WTW Driver     │
│ driver.js    │    │  driver.js       │
│ • onPair()   │    │ • onPair()       │
│ • mDNS/IP    │    │ • mDNS/IP        │
│   discovery  │    │   discovery      │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│  CVE Device  │    │   WTW Device     │
│ device.js    │    │  device.js       │
│ • Polling    │    │ • Polling        │
│ • Capability │    │ • Capability     │
│   listeners  │    │   listeners      │
│ • fan_mode   │    │ • fan_mode (RF)  │
│ • fan_speed  │    │                  │
│ • button.*   │    │                  │
└──────┬───────┘    └────────┬─────────┘
       └──────────┬──────────┘
                  │  shared lib/
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NRGWatchApi  (nrgwatch-api.js)               │
│  • getStatus()          • setFanMode(mode, useRF)               │
│  • getCurrentSpeed()    • setFanSpeed(speed)                    │
│  • setRFFanMode(mode)   • _buildFanModeCommand()                │
└─────────────────┬──────────────────────┬────────────────────────┘
                  │                      │
          ┌───────▼──────┐    ┌──────────▼──────────┐
          │  WebClient   │    │  NRGWatchWebSocket   │
          │ web-client.js│    │  web-socket.js       │
          │ HTTP port 80 │    │  WSS  port 8000      │
          │ 10 s timeout │    │  30 s ping interval  │
          │ Basic Auth   │    │  ⚠ handler = TODO    │
          └───────┬──────┘    └──────────┬────────────┘
                  │                      │
                  └──────────┬───────────┘
                             │  Local LAN
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              NRG.Watch WiFi Module  (ESP32 firmware)             │
│  HTTP /api.html  •  WebSocket :8000  •  mDNS nrg-itho-XXXX     │
│  CC1101 RF  •  I²C bus  •  MQTT (optional)  •  HA Discovery     │
└─────────────────────────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Itho Device    │
                    │ (CVE / WTW)     │
                    └─────────────────┘
```

---

## Layer Descriptions

### 1. Application Layer — `app.js:1–46`

| Concern | Detail |
|---------|--------|
| Class | `NRGWatch extends Homey.App` |
| `onInit` | Logs initialisation; calls `_registerFlowCards()` (stub — `app.js:28–33`) |
| `toLocalTime(date)` | Adjusts `Date` to local timezone offset (`app.js:39–42`) |
| Flow cards | **Not implemented** — `_registerFlowCards` only logs a message |

### 2. Driver Layer — `drivers/*/driver.js`

| Concern | CVE (`itho-cve-wifi`) | WTW (`itho-wtw-wifi`) |
|---------|----------------------|----------------------|
| Class | `IthoCveWifiDriver extends Homey.Driver` | `IthoWtwWifiDriver extends Homey.Driver` (class name reused) |
| Discovery strategy | `itho-cve-wifi` (mDNS) | `itho-wtw-wifi` (mDNS) |
| `onPair` views | loading → set_ip / get_data → set_settings → list → add → done | identical |
| Connection test | `webClient.testConnection(ip)` — `driver.js:107–120` | identical |
| `waitForResults` | Polls `deviceArray` up to 10 × 1 s; resolves after 5+ hits | identical |

### 3. Device Layer — `drivers/*/device.js`

| Concern | CVE | WTW |
|---------|-----|-----|
| `onInit` | `api.setSettings(…, enableVirtualRemote, virtualRemoteIndex)` | `api.setSettings(…, false, rfDeviceIndex)` |
| Polling | `setInterval` at `refreshInterval ?? 15` seconds | identical |
| Fan mode command | virtual remote / direct command | RF remote (`setFanMode(value, true)`) |
| Capability listeners | `fan_mode`, `fan_speed`, `button.join`, `button.leave` | `fan_mode` only |
| Dynamic capabilities | Adds/removes `button.join`, `button.leave`, `fan_speed` based on settings | none |
| `updateStatus` | Maps 11 status fields to capability values | Maps temperature, humidity + fan_mode selection |

### 4. API Layer — `lib/`

| Class | File | Responsibility |
|-------|------|----------------|
| `BaseClass` | `base-class.js:1–33` | `Homey.SimpleClass` subtype; stores `this.homey`; `setHomeyObject()` |
| `NRGWatchApi` | `nrgwatch-api.js:1–279` | Orchestrates HTTP commands; owns `WebClient` + `WebSocket` instances |
| `WebClient` | `web-client.js:1–297` | Raw `node:http` GET; Basic Auth; query-string building; 10 s timeout |
| `NRGWatchWebSocket` | `web-socket.js:1–258` | `ws` WebSocket client; ping/pong heartbeat; **message handler stub** |
| `VirtualRemoteModes` | `virtual-remote-modus.js:1–358` | Static enum of 14 fan modes with multilingual titles |

---

## Runtime Data Flows

### A — Status Polling (primary path)

```
setInterval (every N seconds)
  → device.updateStatus()                        device.js:218
    → api.getStatus()                            nrgwatch-api.js:84
      → webclient.get('api.html', {get:'ithostatus'})  web-client.js:68
        → HTTP GET /api.html?get=ithostatus      port 80
          ← JSON {data: {ithostatus: {...}}}
      → JSON.parse()
    → api.getCurrentSpeed()                      nrgwatch-api.js:110
      → webclient.get('api.html', {get:'currentspeed'})
        → HTTP GET /api.html?get=currentspeed
          ← number or JSON
  → setCapabilityValue('measure_temperature', status.temp)
  → setCapabilityValue('measure_humidity', status.hum)
  → setCapabilityValue('measure_co2', status['CO2level (ppm)'] ?? ...)
  → setCapabilityValue('fan_speed', parseInt(currentSpeed))
  → ... (8 more capabilities)                    device.js:221–257
```

### B — Fan Mode Change (user/flow triggered)

```
Homey capability listener 'fan_mode'             device.js:28–31
  → setCapabilityValue('fan_mode', value)        (optimistic update)
  → api.setFanMode(value)                        nrgwatch-api.js:137
    → _buildFanModeCommand(mode, useRFRemote)    nrgwatch-api.js:214
      → if enableVirtualRemote → {vremoteindex, vremotecmd}
      → if useRFRemote        → {rfremotecmd}
      → else                  → {command: mode}
    → webclient.get('api.html', command)
      → HTTP GET /api.html?<command params>
        ← 'OK'  or  {status:'success'}
    → _isSuccessResponse()                       nrgwatch-api.js:228
```

### C — Device Pairing

```
User opens pairing wizard
  → Driver.onPair(session)                       driver.js:18
    → discoveryStrategy.getDiscoveryResults()
    → [if results] showView('get_data')
    → [else]       showView('set_ip')  ← manual IP form
  → handler('set_ip')  → sets this.results      driver.js:44
  → handler('set_settings')                      driver.js:57
    → getDeviceArray(username, password)         driver.js:95
      → webClient.testConnection(ip, user, pass)  web-client.js:113
    → waitForResults() → findDevices()           driver.js:137
  → handler('list_devices') → returns devices   driver.js:83
  → Homey adds selected devices
```

### D — WebSocket (⚠ stub — not operational)

```
device.api.websocket.launchNotificationsListener()  web-socket.js:92
  → new WebSocket(`wss://${host}:8000`, {...})
  → on('open')  → heartbeat() → setInterval ping every 30 s
  → on('message')  → shouldProcessEvent()
    → configureNotificationsListener()           web-socket.js:216
      → on('message') → JSON.parse()
        → ⚠ TODO: NRGWatch-specific event handling (web-socket.js:248)
```

> **Note**: `launchNotificationsListener` and `configureNotificationsListener` are never called from any driver or device. The WebSocket connection is defined but not started. See [10-open-questions.md](10-open-questions.md#ws-1).

---

## Error Handling Strategy

| Layer | Strategy | Code reference |
|-------|----------|----------------|
| `WebClient` | Throws on HTTP 401/403, non-200, auth failure string; 10 s req timeout | `web-client.js:222–270` |
| `NRGWatchApi` | try/catch → logs `homey.error`, re-throws | `nrgwatch-api.js:98–103` |
| Device | `await api.getStatus().catch(this.error)` — non-fatal per capability | `device.js:219` |
| Capability set | `.catch(this.error)` on each `setCapabilityValue` | `device.js:224–250` |
| WebSocket | `on('error')` logs; `on('close')` cleans up; no auto-reconnect on error | `web-socket.js:152–166` |

---

## Security Considerations

- **Credentials in query string**: `WebClient._buildHeaders` injects `username` and `password` as query params in addition to the `Authorization` header (`web-client.js:183–191`). This is a firmware requirement but exposes credentials in server logs.
- **`rejectUnauthorized: false`**: WebSocket connection disables TLS cert verification (`web-socket.js:107`).
- **Local network only**: no cloud path; credentials never leave the LAN.
- **Credentials at rest**: stored in Homey device settings (encrypted by Homey platform).

---

## Extensibility Points

| What | Where | Notes |
|------|-------|-------|
| New fan modes | `lib/virtual-remote-modus.js` + device `setFanModeOptions()` | Add static member + update options array |
| New capabilities | `device.js:createAndRemoveCabapilities()` | Add `addCapability` + map in `updateStatus()` |
| Flow card actions | `app.js:_registerFlowCards()` | Currently a stub — see [10-open-questions.md](10-open-questions.md) |
| WebSocket events | `web-socket.js:configureNotificationsListener()` | TODO block at line 248 |
| New device type | New driver + device in `drivers/`, new `driver.compose.json` | Follow CVE/WTW pattern |

---

## Future Enhancements (from original ARCHITECTURE.md)

1. **Full WebSocket support** — real-time capability updates, event-driven flow triggers
2. **Flow card implementation** — triggers on CO2 / humidity thresholds, actions for mode changes
3. **Advanced scheduling** — weekly profiles, presence-based automation
4. **Multi-device coordination** — zone-based control
5. **Enhanced diagnostics** — filter replacement reminders, maintenance scheduling

