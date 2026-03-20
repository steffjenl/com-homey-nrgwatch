---
title: Source Inventory
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./ (all root files)
  - path: ./lib/
  - path: ./drivers/
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/
  - path: ./.homeycompose/
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
  - name: Homey Developer
    url: https://apps.developer.homey.app/
---

# Source Inventory

Complete file inventory of all sources analysed to produce the `./specs/` documentation suite.

---

## Plugin Sources

### Root

| File | Lines | Role | Migrated to |
|------|-------|------|-------------|
| `app.js` | 46 | App entry point; `Homey.App` subclass, flow card stub, timezone util | `00-architecture.md` |
| `app.json` | 1826 | Generated manifest; all drivers, capabilities, flow cards | `03-homey-sdk-mapping.md` |
| `package.json` | 19 | npm metadata, deps (`ws`, `homey-log`), devDeps | `04-configuration.md` |
| `.eslintrc.json` | — | ESLint config (`eslint-config-athom`) | `07-coding-standards.md` |
| `tsconfig.json` | — | TypeScript config (types only, source is plain JS) | `07-coding-standards.md` |
| `ARCHITECTURE.md` | 440 | Technical architecture (migrated) | `specs/00-architecture.md` |
| `API.md` | 673 | API reference for lib classes (migrated) | `specs/api-reference.md` |
| `CHANGELOG.md` | 84 | Version history (migrated) | `specs/CHANGELOG.md` |
| `QUICK_REFERENCE.md` | 328 | Developer quick reference (migrated) | `specs/07-coding-standards.md` |
| `REFACTORING_SUMMARY.md` | 315 | Historical refactoring record (migrated) | `specs/decisions/ADR-000-initial-refactoring.md` |
| `README.md` | 192 | User-facing guide — **stays at root** | `specs/README.md` (summary only) |
| `CONTRIBUTING.md` | 50 | Generic Athom contribution guide — **stays at root** | referenced from `specs/README.md` |
| `CODE_OF_CONDUCT.md` | — | Generic code of conduct — **stays at root** | — |
| `README.txt` | — | Plain-text copy of README — **candidate for removal** | `10-open-questions.md` |

### `lib/`

| File | Lines | Role | Key Exports |
|------|-------|------|-------------|
| `lib/base-class.js` | 33 | Base class extending `Homey.SimpleClass`; holds `homey` ref | `BaseClass` |
| `lib/nrgwatch-api.js` | 279 | High-level API client; `getStatus`, `getCurrentSpeed`, `setFanMode`, `setFanSpeed`, `setRFFanMode` | `NRGWatchApi` |
| `lib/web-client.js` | 297 | Raw HTTP (`node:http`); port 80, 10 s timeout, Basic Auth, query-string params, `testConnection` | `WebClient` |
| `lib/web-socket.js` | 258 | WebSocket client (`ws`); port 8000, WSS, 30 s ping, connect/disconnect/reconnect; **message handler is TODO stub** | `NRGWatchWebSocket` |
| `lib/virtual-remote-modus.js` | 358 | Enum-like static class; all fan mode definitions with multilingual titles | `VirtualRemoteModes` |

### `drivers/itho-cve-wifi/`

| File | Lines | Role |
|------|-------|------|
| `driver.js` | 164 | `IthoCveWifiDriver`; pairing, mDNS discovery, device array building, `waitForResults` polling |
| `device.js` | 358 | `IthoCveWifi`; init, polling, capability listeners (`fan_mode`, `fan_speed`, `button.join`, `button.leave`), dynamic capability add/remove, `updateStatus`, `onSettings`, discovery callbacks |
| `driver.compose.json` | 392 | Driver manifest; capabilities list, pairing views, `capabilitiesOptions` |
| `driver.settings.compose.json` | 490 | Settings schema; host, auth group, virtual remote group, refresh interval |
| `pair/set_ip.html` | — | Pairing view for manual IP entry |
| `pair/set_settings.html` | 101 | Pairing view for auth + virtual remote config |

### `drivers/itho-wtw-wifi/`

| File | Lines | Role |
|------|-------|------|
| `driver.js` | 163 | `IthoWtwWifiDriver`; identical structure to CVE driver, uses `itho-wtw-wifi` discovery strategy |
| `device.js` | 267 | `IthoWTWWifi`; similar to CVE device but uses RF remote (`setFanMode(value, true)`), no `fan_speed` listener |
| `driver.compose.json` | 382 | Driver manifest; only `fan_mode` capability declared |
| `driver.settings.compose.json` | 445 | Settings schema; host, auth, RF device type/index, refresh interval |
| `pair/set_settings.html` | — | RF device type/index selection |

### `.homeycompose/`

| File | Role |
|------|------|
| `app.json` | Base manifest (52 lines); ID, version, metadata — **source of truth** |
| `capabilities/measure_number.json` | Custom capability: `type:number`, getable, insights |
| `capabilities/measure_string.json` | Custom capability: `type:string` — **declared but not used in any driver** |
| `discovery/itho-cve-wifi.json` | mDNS-SD discovery: `_http._tcp`, regex `nrg-itho-[a-z0-9]{4}.local` |
| `discovery/itho-wtw-wifi.json` | mDNS-SD discovery for WTW variant |

### `locales/`

| Files | Languages |
|-------|-----------|
| `en.json`, `nl.json`, `de.json`, `fr.json`, `it.json`, `sv.json`, `no.json`, `es.json`, `da.json`, `ru.json`, `pl.json`, `ko.json` | 12 languages |

---

## External Interface Sources (`.ai/ithowifi/`)

| File / Path | Lines | Role |
|-------------|-------|------|
| `software/NRG_itho_wifi/main/ApiResponse.h` | 35 | HTTP + MQTT response helper; status enum `SUCCESS/FAIL/ERROR/CONTINUE` |
| `software/NRG_itho_wifi/main/ApiResponse.cpp` | — | Implementation of `sendSuccess`, `sendFail`, `sendError` |
| `software/NRG_itho_wifi/main/IthoSystem.h` | 165 | Core structs: `ithoDeviceStatus`, `ithoDeviceMeasurements`, `ithoCounters`, `lastCommand` |
| `software/NRG_itho_wifi/main/globals.h` | 54 | Platform includes, CC1101, WiFi, task headers |
| `software/NRG_itho_wifi/main/websocket.h` | 28 | `websocketInit()`, `jsonWsSend()` declarations |
| `software/NRG_itho_wifi/main/notifyClients.h` | 54 | `notifyClients()`, `wsSendAll()`, `logtype` enum |
| `software/NRG_itho_wifi/main/enum.h` | 11 | `cmdOrigin` enum: `UNKNOWN/HTMLAPI/MQTTAPI/REMOTE/WEB` |
| `software/NRG_itho_wifi/main/System.h` | 52 | System uptime, RAM, MAC address helpers |
| `software/NRG_itho_wifi/main/config/IthoRemote.h` | 133 | `IthoRemote` class; max 12 remotes, `RemoteFunctions` enum (`RECEIVE/VREMOTE/MONITOR/SEND`) |
| `software/NRG_itho_wifi/main/config/SystemConfig.h` | — | System-level configuration |
| `software/NRG_itho_wifi/main/config/WifiConfig.h` | — | WiFi configuration |
| `software/NRG_itho_wifi/main/devices/cve14.h` | — | CVE14 device-specific status fields |
| `software/NRG_itho_wifi/main/devices/hru200.h` | — | HRU200 (WTW) status fields |
| `software/NRG_itho_wifi/main/NRG_itho_wifi.ino` | — | Arduino sketch entry point |
| `software/NRG_itho_wifi/main/main.cpp` | — | ESP32-IDF main entry |
| `software/NRG_itho_wifi/version.txt` | — | Firmware version |
| `remotes/README.md` | — | RF remote documentation |

---

## Module Dependency Graph

```
app.js
  └── (no lib imports; drivers self-register)

drivers/itho-cve-wifi/driver.js
  └── lib/web-client.js
        └── lib/base-class.js

drivers/itho-cve-wifi/device.js
  ├── lib/nrgwatch-api.js
  │     ├── lib/base-class.js
  │     ├── lib/web-client.js
  │     │     └── lib/base-class.js
  │     └── lib/web-socket.js
  │           └── lib/base-class.js
  └── lib/virtual-remote-modus.js
        └── lib/base-class.js

drivers/itho-wtw-wifi/driver.js
  └── lib/web-client.js  (same as CVE)

drivers/itho-wtw-wifi/device.js
  ├── lib/nrgwatch-api.js  (same as CVE)
  └── lib/virtual-remote-modus.js  (same as CVE)
```

---

## File Count Summary

| Category | Count |
|----------|-------|
| Plugin JS source files | 9 |
| Driver compose / settings JSON | 4 |
| Pairing HTML views | 4 |
| Homeycompose JSON | 5 |
| Locale JSON files | 12 |
| Firmware C/C++ headers | 14+ |
| Root documentation (migrated) | 5 |
| Root documentation (stays) | 3 |

