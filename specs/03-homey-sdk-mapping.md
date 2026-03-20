---
title: Homey SDK v3 Mapping
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./app.js
  - path: ./app.json
  - path: ./.homeycompose/app.json
  - path: ./.homeycompose/capabilities/
  - path: ./.homeycompose/discovery/
  - path: ./drivers/itho-cve-wifi/driver.compose.json
  - path: ./drivers/itho-cve-wifi/driver.settings.compose.json
  - path: ./drivers/itho-cve-wifi/driver.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-wtw-wifi/driver.compose.json
  - path: ./drivers/itho-wtw-wifi/driver.settings.compose.json
  - path: ./drivers/itho-wtw-wifi/driver.js
  - path: ./drivers/itho-wtw-wifi/device.js
references:
  - name: Homey SDK v3 App Manifest
    url: https://apps.developer.homey.app/the-basics/app/manifest
  - name: Homey SDK v3 Drivers
    url: https://apps.developer.homey.app/the-basics/drivers
  - name: Homey SDK v3 Capabilities
    url: https://apps.developer.homey.app/the-basics/devices/capabilities
  - name: Homey SDK v3 Discovery
    url: https://apps.developer.homey.app/the-basics/discovery
  - name: Homey SDK v3 Pairing
    url: https://apps.developer.homey.app/the-basics/pairing
---

# Homey SDK v3 Mapping

---

## 1. App Manifest (`app.json`)

Generated from `.homeycompose/app.json` + driver compose files. Source of truth: `.homeycompose/app.json`.

| Field | Value | Notes |
|-------|-------|-------|
| `id` | `nl.monkeysoft.nrgwatch` | Homey app store ID |
| `sdk` | `3` | Homey SDK v3 |
| `version` | `1.0.20` | Current version |
| `compatibility` | `>=12.4.0` | Minimum Homey firmware |
| `platforms` | `["local"]` | Local-only, no Homey Cloud support |
| `category` | `["climate"]` | App store category |
| `permissions` | `[]` | No special permissions required |
| `brandColor` | `#159EDA` | NRG.Watch brand blue |

---

## 2. Drivers

| Driver ID | Class | File | Description |
|-----------|-------|------|-------------|
| `itho-cve-wifi` | `IthoCveWifiDriver` | `drivers/itho-cve-wifi/driver.js` | CVE exhaust ventilation fan with WiFi module |
| `itho-wtw-wifi` | `IthoWtwWifiDriver` | `drivers/itho-wtw-wifi/driver.js` | WTW heat-recovery ventilation unit with WiFi module |

Both drivers extend `Homey.Driver` and implement `onPair(session)`.

---

## 3. Devices

| Device Class | File | Homey device class | Description |
|-------------|------|-------------------|-------------|
| `IthoCveWifi` | `drivers/itho-cve-wifi/device.js` | `fan` | Full-featured CVE device |
| `IthoWTWWifi` | `drivers/itho-wtw-wifi/device.js` | `fan` | WTW device with RF remote only |

Both extend `Homey.Device`.

---

## 4. Capabilities

### 4.1 Standard Homey Capabilities

| Capability ID | Type | Direction | CVE | WTW | Polling / Push | Source field |
|--------------|------|-----------|-----|-----|----------------|-------------|
| `measure_temperature` | number | get | ✅ | ✅ | Poll | `status.temp` |
| `measure_humidity` | number | get | ✅ | ✅ | Poll | `status.hum` |
| `measure_co2` | number | get | ✅ | ❌ | Poll | `status['CO2level (ppm)']` etc. |
| `fan_mode` | enum | get + set | ✅ | ✅ | Poll (get) / Listener (set) | `status.Selection` |
| `fan_speed` | number | get + set | ✅* | ❌ | Poll (get) / Listener (set) | `currentspeed` |
| `button.join` | button | set | ✅* | ❌ | Listener only | maintenance action |
| `button.leave` | button | set | ✅* | ❌ | Listener only | maintenance action |

> ✅* = only present when `enableVirtualRemote=true` (`button.*`) or `enableVirtualRemote=false` (`fan_speed`)

### 4.2 Custom Capabilities (`.homeycompose/capabilities/`)

| Capability ID | Base type | getable | setable | insights | Unit | CVE | WTW |
|--------------|-----------|---------|---------|---------|------|-----|-----|
| `measure_number.startup_counter` | number | ✅ | ❌ | ✅ | starts | ✅ | ❌ |
| `measure_number.total_operating_hours` | number | ✅ | ❌ | ✅ | hours | ✅ | ❌ |
| `measure_speed.speed_status` | number | ✅ | ❌ | ✅ | % | ✅ | ❌ |
| `measure_speed.fan_speed` | number | ✅ | ❌ | ✅ | rpm | ✅ | ❌ |
| `measure_speed.fan_setpoint` | number | ✅ | ❌ | ✅ | rpm | ✅ | ❌ |
| `measure_speed.ventilation_setpoint` | number | ✅ | ❌ | ✅ | % | ✅ | ❌ |
| `measure_string` | string | ✅ | ❌ | ❌ | — | ❌ | ❌ |

> ⚠ `measure_string` is defined in `.homeycompose/capabilities/measure_string.json` but is **never registered or used** in any driver or device. See [10-open-questions.md](10-open-questions.md#sdk-1).

### 4.3 `fan_speed` Range Discrepancy

The `fan_speed` capability in `driver.compose.json` declares:
```json
"fan_speed": { "min": 0, "max": 2.55, "units": "0-255" }
```
But the API sends `speed` as a **percentage (0–100)**, and the capability listener multiplies by 100:
```javascript
// device.js:33
return this.api.setFanSpeed(Math.round(value * 100));
```
And polling sets it as an integer from `currentspeed`:
```javascript
// device.js:221
this.setCapabilityValue('fan_speed', parseInt(currentSpeed))
```
This creates a **unit mismatch**: the Homey capability slider goes 0–2.55 but the value stored/displayed is 0–100. See [10-open-questions.md](10-open-questions.md#sdk-2).

### 4.4 Dynamic Capability Management

The plugin adds and removes capabilities at runtime based on settings (`device.js:createAndRemoveCabapilities()`):

```
enableVirtualRemote=false  →  fan_speed PRESENT,  button.join/leave ABSENT
enableVirtualRemote=true   →  fan_speed ABSENT,   button.join/leave PRESENT
```

This diverges from the Homey SDK best practice of declaring all capabilities statically. See [ADR-003](decisions/ADR-003-capability-registration.md).

---

## 5. Flow Cards

| Type | Declared | Implemented | Notes |
|------|----------|-------------|-------|
| Triggers | ❌ | ❌ | Not in `app.json`, not in `app.js` |
| Conditions | ❌ | ❌ | — |
| Actions | ❌ | ❌ | `_registerFlowCards()` in `app.js:28` is a stub |

> ⚠ Flow cards are completely absent. The CHANGELOG and README both mention "Flow card support for automation" as a v1.0.0 feature. This is inaccurate. See [10-open-questions.md](10-open-questions.md#sdk-3).

---

## 6. Settings & Pairing

### 6.1 Pairing Flow (both drivers)

```
loading
  ├─ [mDNS results found] → get_data (loading + auto-connect)
  └─ [no results]         → set_ip   (manual IP form)
            ↓
      set_settings (auth + remote type config)
            ↓
      list_devices  (template: list_devices)
            ↓
      add_devices   (template: add_devices)
            ↓
      done          (template: done)
```

Pairing views: `pair/set_ip.html`, `pair/set_settings.html`.

### 6.2 Device Settings Schema (CVE)

Defined in `drivers/itho-cve-wifi/driver.settings.compose.json`:

| Setting ID | Type | Default | Required | Description |
|-----------|------|---------|---------|-------------|
| `host` | text | — | ✅ | IP address or hostname |
| `isAuthenticated` | checkbox | `false` | ✅ | Enable HTTP Basic Auth |
| `username` | text | `''` | — | Auth username |
| `password` | password | `''` | — | Auth password |
| `enableVirtualRemote` | checkbox | `false` | ✅ | Use virtual remote commands |
| `virtualRemoteType` | select | `'rft-auto'` | — | Remote type |
| `virtualRemoteIndex` | select | `'0'` | — | Remote slot (0–7) |
| `refreshInterval` | number | `15` | ✅ | Poll interval in seconds |

### 6.3 Device Settings Schema (WTW)

Defined in `drivers/itho-wtw-wifi/driver.settings.compose.json`:

| Setting ID | Type | Default | Required | Description |
|-----------|------|---------|---------|-------------|
| `host` | text | — | ✅ | IP address or hostname |
| `isAuthenticated` | checkbox | `false` | ✅ | Enable HTTP Basic Auth |
| `username` | text | `''` | — | Auth username |
| `password` | password | `''` | — | Auth password |
| `rfDeviceType` | select | — | ✅ | RF device type |
| `rfDeviceIndex` | select | `'0'` | — | RF slot (0–7) |
| `refreshInterval` | number | `15` | ✅ | Poll interval in seconds |

---

## 7. Discovery

| Field | CVE | WTW |
|-------|-----|-----|
| Strategy ID | `itho-cve-wifi` | `itho-wtw-wifi` |
| Type | `mdns-sd` | `mdns-sd` |
| Service | `_http._tcp` | `_http._tcp` |
| Hostname regex | `nrg-itho-[a-z0-9]{4}.local` | (same pattern) |
| Discovery ID | `{{host}}` | `{{host}}` |
| Driver reference | `driver.js:19` | `driver.js:19` |

Discovery callbacks implemented on CVE device (`device.js:315–348`):

| Callback | Implemented | Notes |
|----------|-------------|-------|
| `onDiscoveryResult` | ✅ | Checks `discoveryResult.id === this.getData().id` |
| `onDiscoveryAvailable` | ✅ (empty) | No action on first discovery |
| `onDiscoveryAddressChanged` | ✅ | Updates `host` setting + re-applies API settings |
| `onDiscoveryLastSeenChanged` | ✅ (empty) | No reconnect logic |

> WTW device — discovery callbacks not visible in truncated source; assumed identical to CVE.

---

## 8. Lifecycle Hooks

| Hook | CVE | WTW | Notes |
|------|-----|-----|-------|
| `onInit` | ✅ | ✅ | Setup API, start polling, register capability listeners |
| `onAdded` | ✅ | ✅ | Logs only |
| `onSettings` | ✅ | ✅ | Re-applies API settings, restarts polling interval, updates capabilities |
| `onRenamed` | ✅ | ✅ | Logs only |
| `onDeleted` | ✅ | ✅ | Clears polling interval |
| `onPair` (Driver) | ✅ | ✅ | Full pairing wizard |

---

## 9. Localization

12 languages supported: `en`, `nl`, `de`, `fr`, `it`, `sv`, `no`, `es`, `da`, `ru`, `pl`, `ko`.

Translation keys cover: pairing form labels, settings labels, capability titles (via `capabilitiesOptions`), fan mode names (via `VirtualRemoteModes` static members).

---

## 10. Deviations from SDK Best Practices

| # | Deviation | Impact | Recommendation |
|---|-----------|--------|---------------|
| 1 | Dynamic `addCapability`/`removeCapability` at runtime | State drift, potential race conditions | Declare all statically; use `capabilitiesOptions` to hide — see [ADR-003](decisions/ADR-003-capability-registration.md) |
| 2 | `measure_string` capability declared but unused | Dead config | Remove or implement |
| 3 | Flow cards mentioned in docs but not declared in `app.json` | User expectation mismatch | Implement or remove from docs |
| 4 | `fan_speed` min/max in `capabilitiesOptions` doesn't match actual value range | Incorrect UI slider | Fix to `min:0, max:100, units:'%'` |
| 5 | WebSocket never started | Real-time updates non-functional | Implement or document as future feature |
| 6 | Typo: `createAndRemoveCabapilities` (vs `Capabilities`) | Minor — no functional impact | Fix spelling on next refactor |

