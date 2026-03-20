---
title: Configuration
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./package.json
  - path: ./drivers/itho-cve-wifi/driver.settings.compose.json
  - path: ./drivers/itho-wtw-wifi/driver.settings.compose.json
  - path: ./drivers/itho-cve-wifi/driver.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-wtw-wifi/device.js
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
references:
  - name: Homey SDK v3 Device Settings
    url: https://apps.developer.homey.app/the-basics/devices/settings
---

# Configuration

All configuration is stored as **Homey device settings** — there are no environment variables, `.env` files, or external config files.

---

## 1. Dependencies

### Runtime (`package.json:dependencies`)

| Package | Version | Purpose |
|---------|---------|---------|
| `ws` | `^8.18.3` | WebSocket client (`lib/web-socket.js`) |
| `homey-log` | `^2.1.0` | Remote crash logging for Homey apps |

### Development (`package.json:devDependencies`)

| Package | Version | Purpose |
|---------|---------|---------|
| `homey` | `^3.8.4` | Homey SDK v3 CLI + types |
| `@types/homey` | `homey-apps-sdk-v3-types@^0.3.12` | TypeScript type definitions |
| `eslint` | `^7.32.0` | Linting |
| `eslint-config-athom` | `^3.1.5` | Athom's ESLint rule set |

---

## 2. HTTP Client Constants

Defined in `lib/web-client.js` as static class members:

| Constant | Value | Description |
|----------|-------|-------------|
| `WebClient.DEFAULTS.PORT` | `80` | HTTP port (`web-client.js:29`) |
| `WebClient.DEFAULTS.TIMEOUT` | `10000` ms | Request timeout (`web-client.js:30`) |
| `WebClient.HTTP_STATUS.OK` | `200` | |
| `WebClient.HTTP_STATUS.UNAUTHORIZED` | `401` | |
| `WebClient.HTTP_STATUS.FORBIDDEN` | `403` | |

---

## 3. WebSocket Client Constants

Defined in `lib/web-socket.js`:

| Constant | Value | Description |
|----------|-------|-------------|
| `NRGWatchWebSocket.CONFIG.PORT` | `8000` | WebSocket port (`web-socket.js:18`) |
| `NRGWatchWebSocket.CONFIG.PING_INTERVAL` | `30000` ms | Heartbeat interval (`web-socket.js:17`) |

---

## 4. Device Settings — CVE Driver (`itho-cve-wifi`)

Source: `drivers/itho-cve-wifi/driver.settings.compose.json`

### Group: Connection

| ID | Type | Default | Validation | Description |
|----|------|---------|-----------|-------------|
| `host` | `text` | — | required | IP address or hostname (e.g. `nrg-itho-ab12.local`) |

### Group: Authentication

| ID | Type | Default | Description |
|----|------|---------|-------------|
| `isAuthenticated` | `checkbox` | `false` | Master switch — enables auth header + query params |
| `username` | `text` | `''` | HTTP Basic Auth username |
| `password` | `password` | `''` | HTTP Basic Auth password (masked in UI) |

### Group: Virtual Remote

| ID | Type | Default | Description |
|----|------|---------|-------------|
| `enableVirtualRemote` | `checkbox` | `false` | Enables virtual remote command path; changes available fan modes |
| `virtualRemoteType` | `select` | `'rft-auto'` | Remote protocol variant — see §6 |
| `virtualRemoteIndex` | `select` | `'0'` | Slot index 0–7 in firmware remote table |

### Group: Advanced

| ID | Type | Default | Min | Description |
|----|------|---------|-----|-------------|
| `refreshInterval` | `number` | `15` | — | Polling interval in seconds; no minimum enforced in code |

---

## 5. Device Settings — WTW Driver (`itho-wtw-wifi`)

Source: `drivers/itho-wtw-wifi/driver.settings.compose.json`

### Group: Connection

| ID | Type | Default | Description |
|----|------|---------|-------------|
| `host` | `text` | — | IP address or hostname |

### Group: Authentication

| ID | Type | Default | Description |
|----|------|---------|-------------|
| `isAuthenticated` | `checkbox` | `false` | Enable auth |
| `username` | `text` | `''` | Username |
| `password` | `password` | `''` | Password |

### Group: RF Device

| ID | Type | Default | Description |
|----|------|---------|-------------|
| `rfDeviceType` | `select` | — | RF device variant — see §6 |
| `rfDeviceIndex` | `select` | `'0'` | RF slot index 0–7 |

### Group: Advanced

| ID | Type | Default | Description |
|----|------|---------|-------------|
| `refreshInterval` | `number` | `15` | Polling interval in seconds |

---

## 6. Virtual Remote / RF Device Types

Used by both `virtualRemoteType` (CVE) and `rfDeviceType` (WTW):

| Value | Label | Available Fan Modes |
|-------|-------|---------------------|
| `rft-cve` | RFT CVE | away, low, medium, high, timer1–3 |
| `rft-auto` | RFT AUTO | auto, autonight, low, high, timer1–3 |
| `rft-n` | RFT N | away, low, medium, high, timer1–3 |
| `rft-auto-n` | RFT AUTO N | auto, autonight, low, high, timer1–3 |
| `rft-df-qf` | RFT DF QF | low, high, cook30, cook60, timer1–3 |
| `rft-rv` | RFT RV | auto, autonight, low, medium, high, timer1–3 |
| `rft-co2` | RFT CO2 | auto, autonight, low, medium, high, timer1–3 |
| `rft-pir` | RFT PIR | motion_on, motion_off |
| `rft-spider` | RFT SPIDER | auto, autonight, low, medium, high, timer1–3 |

Source: `pair/set_settings.html` select options + `device.js:setFanModeOptions()`.

---

## 7. Settings Defaults at Runtime

Applied in `device.js:onInit` / `driver.js:handler('set_settings')`:

| Field | Fallback expression | Source |
|-------|--------------------|----|
| `refreshInterval` | `this.settings.refreshInterval ?? 15` | `device.js:24` |
| `virtualRemoteIndex` | `virtualRemoteIndex ?? 0` | `nrgwatch-api.js:58` |
| `virtualRemoteType` | Set to `'rft-auto'` if undefined/empty | `device.js:140–143` |
| `refreshInterval` (pairing) | `parseInt(data.refreshInterval) \|\| 15` | `driver.js:68` |
| `virtualRemoteIndex` (pairing) | `data.virtualRemoteIndex \|\| '0'` | `driver.js:71` |

---

## 8. Feature Flags

There are no runtime feature flags. Capability presence acts as implicit feature flags:

| Feature | Control |
|---------|---------|
| Virtual remote | `settings.enableVirtualRemote === true` |
| Fan speed slider | `settings.enableVirtualRemote === false` |
| Join/Leave buttons | `settings.enableVirtualRemote === true` |
| Authentication | `settings.isAuthenticated === true` |

---

## 9. No Environment Variables

The plugin has **zero environment variables**. All configuration lives in Homey device settings, which are:
- Set during pairing (`driver.js:set_settings` handler)
- Editable post-pairing via Homey device settings UI
- Accessible in code via `this.getSettings()` / `this.setSettings()`
- Encrypted at rest by the Homey platform

