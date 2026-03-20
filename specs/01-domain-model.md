---
title: Domain Model
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/virtual-remote-modus.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-wtw-wifi/device.js
  - path: ./lib/nrgwatch-api.js
  - path: ./lib/web-client.js
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/IthoSystem.h
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/main/ApiResponse.h
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
  - name: Homey Developer
    url: https://apps.developer.homey.app/
---

# Domain Model

---

## 1. Core Entities

### 1.1 Device

Represents a physical Itho ventilation unit with its NRG.Watch WiFi module attached.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | `string` | Homey | Device ID — set to `device.name` (hostname) at pairing |
| `name` | `string` | Homey | Human-readable name; defaults to mDNS hostname |
| `settings.host` | `string` | User | IP address or mDNS hostname (e.g. `nrg-itho-ab12.local`) |
| `settings.username` | `string` | User | Optional — only when auth is enabled on firmware |
| `settings.password` | `string` | User | Optional — stored encrypted by Homey platform |
| `settings.isAuthenticated` | `boolean` | User | Master flag; if `false`, username/password are ignored |
| `settings.refreshInterval` | `number` | User | Polling interval in seconds; default `15` |

**CVE-specific settings:**

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `settings.enableVirtualRemote` | `boolean` | `false` | Enables virtual remote command path |
| `settings.virtualRemoteType` | `string` | `'rft-auto'` | Remote type — see [Virtual Remote Types](#4-virtual-remote-types) |
| `settings.virtualRemoteIndex` | `string` | `'0'` | Index 0–7; selects which virtual remote slot to use |

**WTW-specific settings:**

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `settings.rfDeviceType` | `string` | — | RF remote type (same type strings as virtual remote) |
| `settings.rfDeviceIndex` | `string` | — | Index of RF device slot |

---

### 1.2 Device Status (polling response)

Returned by `GET /api.html?get=ithostatus`. Firmware source: `IthoSystem.h:ithoDeviceStatus`.

The response can arrive in **two formats** (firmware versions differ on field naming):

**Format A — space/bracket keys (older firmware):**
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

**Format B — kebab-case keys (newer firmware / wrapped):**
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

> **Plugin handling** (`device.js:221–257`): uses `??` chaining to support both key formats, e.g.:
> `status['CO2level (ppm)'] ?? status['Highest CO2 concentration (ppm)'] ?? status['co2level_ppm'] ?? status['highest-co2-concentration_ppm']`

**Field → Capability mapping:**

| Status Field(s) | Homey Capability | Unit | Notes |
|----------------|-----------------|------|-------|
| `temp` | `measure_temperature` | °C | |
| `hum` | `measure_humidity` | % | |
| `CO2level (ppm)` / `co2level_ppm` / `Highest CO2 concentration (ppm)` | `measure_co2` | ppm | CVE only |
| `Speed status` / `speed-status` | `measure_speed.speed_status` | — | integer |
| `Fan speed (rpm)` / `fan-speed_rpm` | `measure_speed.fan_setpoint` | rpm | ⚠ field names are swapped in code |
| `Fan setpoint (rpm)` / `fan-setpoint_rpm` | `measure_speed.fan_speed` | rpm | ⚠ field names are swapped in code |
| `Ventilation setpoint (%)` / `ventilation-setpoint_perc` | `measure_speed.ventilation_setpoint` | % | |
| `Startup counter` / `startup-counter` | `measure_number.startup_counter` | starts | |
| `Total operation (hours)` / `total-operation_hours` | `measure_number.total_operating_hours` | hours | |
| `Selection` / `selection` | `fan_mode` | — | see Selection mapping below |

> ⚠ **Known issue**: `fan_speed` and `fan_setpoint` capabilities appear to have their source fields swapped in `device.js:240–243`. See [10-open-questions.md](10-open-questions.md#dm-1).

---

### 1.3 Current Speed (polling response)

Returned by `GET /api.html?get=currentspeed`.

```json
// Wrapped format:
{ "data": { "currentspeed": 75 } }

// Or raw number:
75
```

Mapped to `fan_speed` capability as `parseInt(currentSpeed)` — `device.js:221`.

---

### 1.4 Last Command (firmware struct)

From `IthoSystem.h:lastCommand`:

```cpp
struct lastCommand {
  char source[30];   // origin: "HTMLAPI", "MQTTAPI", "REMOTE", "WEB"
  char command[32];  // command string sent
  time_t timestamp;
};
```

Not directly exposed to the plugin; lives in firmware state only.

---

## 2. Fan Mode → Selection Integer Mapping

The `Selection` field in status responses encodes the current mode as an integer. Mapping implemented in `device.js:253–263`:

| `Selection` value | Homey `fan_mode` value | Notes |
|-------------------|------------------------|-------|
| `2` | `'low'` | |
| `3` | `'medium'` | |
| `4` | `'high'` | |
| `5` | `'timer1'` | |
| `7` | `'auto'` | |
| other | — | No capability update; current value retained |

> **Gap**: Values for `away`, `autonight`, `timer2`, `timer3`, `cook30`, `cook60`, `motion_on`, `motion_off` are not mapped from the status response. The plugin can **set** these modes but cannot **read them back** from the device. See [10-open-questions.md](10-open-questions.md#dm-2).

---

## 3. Fan Mode Taxonomy (VirtualRemoteModes)

All defined in `lib/virtual-remote-modus.js`. Each mode is `{ id: string, title: { en, nl, de, fr, it, sv, no, es, da, ru, pl, ko } }`.

| Mode ID | Static Member | Category |
|---------|--------------|----------|
| `away` | `AWAY` | Presence |
| `low` | `LOW` | Speed |
| `medium` | `MEDIUM` | Speed |
| `high` | `HIGH` | Speed |
| `auto` | `AUTO` | Automatic |
| `autonight` | `AUTONIGHT` | Automatic |
| `timer1` | `TIMER1` | Timer |
| `timer2` | `TIMER2` | Timer |
| `timer3` | `TIMER3` | Timer |
| `join` | `JOIN` | Remote pairing |
| `leave` | `LEAVE` | Remote pairing |
| `motion_on` | `MOTION_ON` | Sensor |
| `motion_off` | `MOTION_OFF` | Sensor |
| `cook30` | `COOK30` | Kitchen |
| `cook60` | `COOK60` | Kitchen |

---

## 4. Virtual Remote Types

Configured per device; determines which fan mode subset is available. Defined in `device.js:setFanModeOptions()` and `pair/set_settings.html`.

| Type ID | Available Modes | Typical Device |
|---------|----------------|----------------|
| `rft-cve` | away, low, medium, high, timer1–3 | CVE exhaust fan |
| `rft-auto` | auto, autonight, low, high, timer1–3 | Auto-regulated CVE |
| `rft-n` | away, low, medium, high, timer1–3 | CVE N-series |
| `rft-auto-n` | auto, autonight, low, high, timer1–3 | Auto N-series |
| `rft-df-qf` | low, high, cook30, cook60, timer1–3 | Demand/kitchen fan |
| `rft-rv` | auto, autonight, low, medium, high, timer1–3 | RV (recirculation) |
| `rft-co2` | auto, autonight, low, medium, high, timer1–3 | CO2-controlled |
| `rft-pir` | motion_on, motion_off | PIR sensor remote |
| `rft-spider` | auto, autonight, low, medium, high, timer1–3 | Spider system |
| *(default / no virtual remote)* | low, medium, high, timer1–3 | Direct command |

---

## 5. API Response Error Model

From `ApiResponse.h:status` (firmware):

| Status | HTTP | Meaning |
|--------|------|---------|
| `SUCCESS` | 200 | Command accepted; body `"OK"` or `{status:"success"}` |
| `FAIL` | 200 | Command rejected (e.g. wrong params); `{status:"fail", data:{failreason:...}}` |
| `ERROR` | 4xx/5xx | Server-side error; `{status:"error", message:...}` |
| `CONTINUE` | — | Internal firmware state; not exposed to HTTP |

**Plugin-side handling** (`web-client.js:222–270` + `nrgwatch-api.js:_isSuccessResponse`):

| Condition | Plugin action |
|-----------|--------------|
| HTTP 401 or 403 | Throws `'Authentication failed. Please check the username and password.'` |
| Response body `'AUTHENTICATION FAILED'` | Same as above |
| `{status:"error", message}` | Throws `'API error: <message>'` |
| `{status:"fail", data.failreason}` | Throws `'API failure: <failreason>'` |
| `{status:"fail", data.code:401}` | Throws authentication error |
| Body `'OK'` | `_isSuccessResponse` → `true` |
| `{status:"success"}` | `_isSuccessResponse` → `true` |
| Other non-200 | Throws `'HTTP request failed (status: N, response: ...)'` |

---

## 6. Command Parameter DTOs

### Direct command
```json
{ "command": "low" }
```
URL: `GET /api.html?command=low`

### Virtual remote command
```json
{ "vremoteindex": 0, "vremotecmd": "low" }
```
URL: `GET /api.html?vremoteindex=0&vremotecmd=low`

### RF remote command
```json
{ "rfremoteindex": 0, "rfremotecmd": "low" }
```
URL: `GET /api.html?rfremoteindex=0&rfremotecmd=low`

### Fan speed command
```json
{ "speed": 75 }
```
URL: `GET /api.html?speed=75`  
Validation: `0 ≤ speed ≤ 100` (`nrgwatch-api.js:163`)

### Authenticated request (extra query params added by `_buildHeaders`):
```
GET /api.html?get=ithostatus&username=admin&password=secret
Authorization: Basic YWRtaW46c2VjcmV0
```

