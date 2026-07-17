# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This file is the engineering changelog maintained in `./specs/`. The user-facing changelog is at the root [`../CHANGELOG.md`](../CHANGELOG.md).

---

## [Unreleased]

### Planned
- Full WebSocket support for real-time capability updates
- Flow card implementation (triggers, conditions, actions)
- Automated unit and integration tests
- Retry/backoff strategy for HTTP failures
- Device `setUnavailable()` on consecutive network errors
- Advanced scheduling capabilities
- WTW device additional capabilities (temperature, humidity)
- `fan_speed` unit fix (0–100% instead of 0–2.55)
- `fan_speed` / `fan_setpoint` field mapping verification

### Open Issues
- See [`10-open-questions.md`](10-open-questions.md) for all unresolved items
- See [`09-risk-register.md`](09-risk-register.md) for all tracked risks

---

## [1.2.0] — 2026-07-11

### Changed
- `specs/openapi.json` updated to IthoWifi firmware spec **3.2.0** (was 3.0.0-beta1). Only new endpoint: `GET/POST /api/v2/ota`.
- `setFanSpeed()` documented as mode-aware since firmware 3.1.4 (`percentage`/`fandemand` work in both directions on RF/auto units).

### Added
- `NRGWatchApi.getSpeedInfo()` — v2 speed incl. `timer_remaining_ms` / `timer_speed` (firmware 3.1.4+).
- `NRGWatchApi.getOtaInfo()` — firmware version info + OTA state (firmware 3.1.0+).
- `NRGWatchApi.setOutsideTemp(temp)` — `POST /api/v2/wpu/outside_temp` for WPU units.
- WTW driver: `fan_speed` slider capability + `wtw_set_fan_speed` flow action.
- CVE driver: `measure_number.timer_remaining` capability (add-on tracked timer, minutes).
- CVE/WTW/WPU drivers: `measure_string.firmware_version` capability + `*_firmware_update_available` flow trigger (hourly OTA poll, fires once per new version).
- New **`itho-wpu-wifi`** driver (experimental, class `heatpump`): 9 temperature sensors, CV pressure, pump percentages, heat demand, flow, compressor current, status/sub-status/error codes; flow action `wpu_set_outside_temp`, triggers for offline/online/room-temperature/error-code changes. Status label mapping sourced from ithowifi firmware `devices/wpu.h`.

---

## [1.0.20] — app.json version

### Notes
- Version bump only — no code changes documented in this entry.

---

## [1.0.0] — 2026-02-09

### Added
- Initial release of NRGWatch for Homey
- Support for **Itho CVE WiFi** devices (exhaust ventilation)
- Support for **Itho WTW WiFi** devices (heat recovery ventilation)
- Auto-discovery of devices via mDNS-SD (`nrg-itho-XXXX.local`)
- Manual device pairing via IP address
- Authentication support for password-protected devices
- Virtual remote functionality for CVE devices (9 remote types)
- RF remote support for WTW devices
- Device monitoring capabilities:
  - Temperature (`measure_temperature`)
  - Humidity (`measure_humidity`)
  - CO2 level (`measure_co2`) — CVE only
  - Fan speed (`fan_speed`) — CVE, non-virtual-remote mode
  - Speed status (`measure_speed.speed_status`)
  - Fan speed RPM (`measure_speed.fan_speed`)
  - Fan setpoint RPM (`measure_speed.fan_setpoint`)
  - Ventilation setpoint (`measure_speed.ventilation_setpoint`)
  - Operating hours counter (`measure_number.total_operating_hours`)
  - Startup counter (`measure_number.startup_counter`)
- Fan mode control (`fan_mode`): away, low, medium, high, auto, autonight, timer1–3, cook30, cook60, motion_on/off
- Virtual remote join/leave maintenance actions (`button.join`, `button.leave`)
- Configurable refresh intervals (default: 15 s)
- Multi-language support: EN, NL, DE, FR, IT, SV, NO, ES, DA, RU, PL, KO
- WebSocket client infrastructure (connection management, heartbeat) — *handler stub, not yet operational*

### Changed
- Refactored codebase from earlier prototype to clean architecture
- Removed leftover UniFi Access template code from `web-socket.js`
- Converted raw Promise constructors to `async/await` throughout
- Improved error handling with descriptive messages
- Standardized code style with `eslint-config-athom`

### Documentation
- `README.md` — user installation and configuration guide
- `ARCHITECTURE.md` → `specs/00-architecture.md`
- `API.md` → `specs/api-reference.md`
- `QUICK_REFERENCE.md` → `specs/07-coding-standards.md`
- Full `specs/` suite (this document)

### Known Issues at Release
- WebSocket message handler not implemented (R-1)
- `wss://` URL scheme likely incorrect for firmware's `ws://` server (R-2)
- No automated tests (R-13)
- Flow cards mentioned in docs but not implemented (R-4)
- `fan_speed` capability unit mismatch (R-5)

