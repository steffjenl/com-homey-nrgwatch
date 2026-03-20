---
title: Assumptions
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/web-socket.js
  - path: ./lib/web-client.js
  - path: ./lib/nrgwatch-api.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
---

# Assumptions

All assumptions made during codebase analysis and spec generation. Each entry includes reasoning and a confidence level.

**Confidence**: 🟢 High (≥80%) / 🟡 Medium (50–80%) / 🔴 Low (<50%)

---

## Communication

| ID | Assumption | Reasoning | Confidence | Verify by |
|----|-----------|-----------|-----------|-----------|
| A-1 | The NRG.Watch firmware WebSocket server runs plain `ws://`, not `wss://` | Firmware source shows standard `AsyncWebSocket` / Mongoose WebSocket without TLS config; ESP32 TLS would require explicit certificate setup | 🟡 Medium | Check firmware `platformio.ini` or live device |
| A-2 | The firmware's single HTTP endpoint is `/api.html` for all operations | All API calls in the plugin use `NRGWatchApi.ENDPOINTS.API = 'api.html'`; firmware source confirms API routes | 🟢 High | Confirmed via code + firmware `ApiResponse.h` |
| A-3 | Both Format A (flat) and Format B (wrapped) status responses are valid, depending on firmware version | Plugin handles both with `??` chaining; this is intentional dual-format support | 🟢 High | Observed in `device.js:225–237` |
| A-4 | The firmware requires credentials in query string AND Authorization header for Basic Auth | Plugin sends both (`web-client.js:184–190`); assumed intentional due to firmware quirk | 🟡 Medium | Test header-only auth against live device |
| A-5 | WebSocket port 8000 is fixed in firmware | `NRGWatchWebSocket.CONFIG.PORT = 8000` hardcoded; not configurable via settings | 🟡 Medium | Check firmware config files |

---

## Device Behaviour

| ID | Assumption | Reasoning | Confidence | Verify by |
|----|-----------|-----------|-----------|-----------|
| A-6 | `Selection` integer 7 = auto mode | Mapped in `device.js:259`; consistent with auto being a "special" non-sequential value | 🟡 Medium | Check firmware `enum.h` or device docs |
| A-7 | `fan_speed` capability value represents 0–100% (percentage) | `setFanSpeed` multiplies Homey value by 100 before sending as `speed` param; `parseInt(currentspeed)` stores the raw percentage | 🟡 Medium | Check firmware `currentspeed` units |
| A-8 | `Fan speed (rpm)` and `Fan setpoint (rpm)` are swapped in `device.js:240–243` | Mapping seems reversed based on field names; `setpoint` = target, `speed` = actual | 🔴 Low | Verify against firmware `devices/cve14.h` |
| A-9 | The WTW device has only `fan_mode` as a usable capability | Only `fan_mode` declared in WTW `driver.compose.json` | 🟡 Medium | Check if WTW firmware exposes temperature/humidity |
| A-10 | The `join`/`leave` commands are only functional within 2 minutes of power cycle | Documented in `capabilitiesOptions` in `driver.compose.json`; this is a firmware/hardware constraint | 🟢 High | Confirmed via `driver.compose.json` description |

---

## Codebase & SDK

| ID | Assumption | Reasoning | Confidence | Verify by |
|----|-----------|-----------|-----------|-----------|
| A-11 | `measure_string` capability was planned for future use but never implemented | Defined in `.homeycompose/capabilities/` but absent from all drivers; no git context available | 🟡 Medium | Check git log for context |
| A-12 | The WebSocket code is a copy-paste template artefact (originally from a UniFi integration) | `REFACTORING_SUMMARY.md` states "Removed unused UniFi Access code (leftover from template)" | 🟢 High | Confirmed via REFACTORING_SUMMARY.md |
| A-13 | Flow card support is planned but not yet implemented | `_registerFlowCards()` stub + CHANGELOG/README both mention it | 🟢 High | Confirmed via `app.js:28–33` |
| A-14 | `virtualRemoteType` fallback to `'rft-auto'` in `device.js:140` is backwards-compatibility for older settings | Comment "fallback for old settings" + explicit check for `undefined` or `''` | 🟢 High | Confirmed via `device.js:140–143` |
| A-15 | The `homey-log` package provides remote crash reporting but is not explicitly initialized in `app.js` | Package is listed in `dependencies` but no `HomeyLog` initialization found in `app.js` | 🟡 Medium | Check if Homey platform auto-initializes it |
| A-16 | `driver.compose.json` and `driver.settings.compose.json` are the source-of-truth for `app.json` capabilities | `app.json` has `_comment: "This file is generated"` header | 🟢 High | Confirmed via `app.json:2` |

