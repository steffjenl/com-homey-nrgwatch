---
title: API Reference
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/nrgwatch-api.js
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
  - path: ./lib/virtual-remote-modus.js
  - path: ./lib/base-class.js
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
---

# API Reference

> Migrated and enriched from root `API.md`. Full class-level reference for the `lib/` modules.

---

## Table of Contents

- [NRGWatchApi](#nrgwatchapi)
- [WebClient](#webclient)
- [NRGWatchWebSocket](#nrgwatchwebsocket)
- [VirtualRemoteModes](#virtualremotemodes)
- [BaseClass](#baseclass)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## NRGWatchApi

**File**: `lib/nrgwatch-api.js`  
**Extends**: `BaseClass`

Main API client for interacting with Itho ventilation devices via HTTP and (planned) WebSocket.

### Static Constants

```javascript
NRGWatchApi.ENDPOINTS.API       // 'api.html'
NRGWatchApi.COMMANDS.GET_STATUS // 'ithostatus'
NRGWatchApi.COMMANDS.GET_SPEED  // 'currentspeed'
```

### Constructor

```javascript
const api = new NRGWatchApi();
// api.webclient  → WebClient instance
// api.websocket  → NRGWatchWebSocket instance
```

### Methods

#### `setSettings(host, username, password, isAuthenticated, enableVirtualRemote, virtualRemoteIndex)`

Configures the API client. Called from `device.js:onInit` and `device.js:onSettings`.

| Param | Type | Description |
|-------|------|-------------|
| `host` | `string` | Device IP or hostname |
| `username` | `string` | Auth username (optional) |
| `password` | `string` | Auth password (optional) |
| `isAuthenticated` | `boolean` | Enable Basic Auth |
| `enableVirtualRemote` | `boolean` | Use virtual remote command path |
| `virtualRemoteIndex` | `number` | Remote slot 0–7 (default: 0) |

---

#### `setHomeyObject(homey)`

Injects the Homey instance for logging. Propagates to `WebClient` and `WebSocket`.

---

#### `async getStatus()` → `Promise<Object>`

`GET /api.html?get=ithostatus`

Returns the full device status object. Handles both Format A (flat) and Format B (wrapped `{data:{ithostatus:{...}}}`).

**Throws**: `Error` on network failure, auth failure, or invalid response format.

---

#### `async getCurrentSpeed()` → `Promise<number>`

`GET /api.html?get=currentspeed`

Returns the current fan speed. Handles both raw number and wrapped `{data:{currentspeed:n}}` formats.

**Throws**: `Error` on failure.

---

#### `async setFanMode(mode, useRFRemote = false)` → `Promise<boolean>`

Sets the fan mode. Command path depends on settings:
- `enableVirtualRemote=true` → `?vremoteindex=N&vremotecmd=<mode>`
- `useRFRemote=true` → `?rfremotecmd=<mode>`
- default → `?command=<mode>`

**Returns**: `true` on success.  
**Throws**: `Error` if device rejects command or network fails.

Valid modes: `'low'`, `'medium'`, `'high'`, `'away'`, `'auto'`, `'autonight'`, `'timer1'`, `'timer2'`, `'timer3'`, `'join'`, `'leave'`, `'cook30'`, `'cook60'`, `'motion_on'`, `'motion_off'`

---

#### `async setFanSpeed(speed)` → `Promise<boolean>`

`GET /api.html?speed=<n>`

| Param | Type | Constraint |
|-------|------|-----------|
| `speed` | `number` | 0–100 (validated client-side) |

**Throws**: `Error` if `speed < 0 || speed > 100`, or on network failure.

---

#### `async setRFFanMode(mode)` → `Promise<boolean>`

`GET /api.html?rfremoteindex=<n>&rfremotecmd=<mode>`

Uses `webclient._virtualRemoteIndex` for the index. Called explicitly when direct RF control is needed outside the `setFanMode` path.

---

### Private Methods

| Method | Description |
|--------|-------------|
| `_buildFanModeCommand(mode, useRFRemote)` | Selects command object based on virtual remote / RF / direct mode |
| `_isSuccessResponse(response)` | Returns `true` for `'OK'` or `{status:'success'}` |
| `_isValidJsonString(str)` | Safe JSON parse check |

---

## WebClient

**File**: `lib/web-client.js`  
**Extends**: `BaseClass`

Low-level HTTP transport using Node.js `node:http`.

### Static Constants

```javascript
WebClient.HTTP_STATUS.OK           // 200
WebClient.HTTP_STATUS.UNAUTHORIZED // 401
WebClient.HTTP_STATUS.FORBIDDEN    // 403
WebClient.DEFAULTS.PORT            // 80
WebClient.DEFAULTS.TIMEOUT         // 10000 ms
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `_serverHost` | `string\|null` | `null` | Target hostname or IP |
| `_serverPort` | `number` | `80` | Target port |
| `_userName` | `string\|null` | `null` | Auth username |
| `_passWord` | `string\|null` | `null` | Auth password |
| `_isAuthenticated` | `boolean` | `false` | Enable auth |
| `_enableVirtualRemote` | `boolean` | `false` | Flag used by `NRGWatchApi` command builder |
| `_virtualRemoteIndex` | `number` | `0` | Remote slot index |

### Methods

#### `async get(resource, params = {})` → `Promise<string>`

Performs an HTTP GET. Injects auth header + query params if `_isAuthenticated`.

**Throws**: `Error` on 401/403, timeout, non-200, or auth failure string.

---

#### `async testConnection(ipAddress, userName?, passWord?)` → `Promise<string | 401 | 403>`

Tests reachability and auth status. Returns HTTP status code for 401/403; returns response body string for 200.

**Throws**: `Error` on connection failure (non-auth errors).

---

### Private Methods

| Method | Description |
|--------|-------------|
| `_buildHeaders(params)` | Adds `Authorization` header + injects credentials into params when authenticated |
| `_buildRequestOptions(method, resource, params, headers)` | Builds `http.request` options object |
| `_validateResponse(statusCode, responseBody)` | Throws on auth failures, non-200, API error/fail responses |
| `_toQueryString(obj)` | Converts object to `?key=value&...` string |
| `_isValidJsonString(str)` | Safe JSON parse check |

---

## NRGWatchWebSocket

**File**: `lib/web-socket.js`  
**Extends**: `BaseClass`

WebSocket client using the `ws` package. Manages connection lifecycle and heartbeat.

> ⚠ **Not operational**: `launchNotificationsListener()` is never called from any driver or device. Message handler is a TODO stub. See [ADR-001](decisions/ADR-001-connection-strategy.md).

### Static Constants

```javascript
NRGWatchWebSocket.CONFIG.PING_INTERVAL // 30000 ms
NRGWatchWebSocket.CONFIG.PORT          // 8000
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `loggedInStatus` | `string` | `'Unknown'` / `'Connecting'` / `'Connected'` / `'Disconnected'` / `<error>` |
| `lastWebsocketMessage` | `string\|null` | ISO timestamp of last received message |
| `_eventListener` | `WebSocket\|null` | Active `ws` connection |
| `_eventListenerConfigured` | `boolean` | Whether `on('message')` handler is attached |
| `pingTimeout` | `number\|null` | `setInterval` handle for heartbeat |

### Methods

#### `isWebsocketConnected()` → `boolean`

Returns `true` if `_eventListener.readyState === WebSocket.OPEN`.

---

#### `getLastWebsocketMessageTime()` → `string | null`

Returns the `lastWebsocketMessage` timestamp string.

---

#### `launchNotificationsListener()` → `boolean`

Creates a new `WebSocket` to `wss://<host>:8000`. Sets up `open`, `pong`, `close`, `error` handlers. Calls `heartbeat()` on open.

> ⚠ URL scheme should be `ws://` not `wss://` — see Risk R-2.

---

#### `configureNotificationsListener()` → `boolean`

Attaches the `on('message')` handler. The message body is a **TODO stub** (`web-socket.js:248`).

---

#### `async disconnectEventListener()` → `Promise<boolean>`

Closes the WebSocket and cleans up internal state.

---

#### `async reconnectNotificationsListener()` → `Promise<void>`

Calls `disconnectEventListener()` then `launchNotificationsListener()` + `configureNotificationsListener()`.

---

### Private Methods

| Method | Description |
|--------|-------------|
| `heartbeat()` | Clears + restarts ping `setInterval` |
| `notificationsUrl()` | Returns `wss://<host>:8000` (⚠ should be `ws://`) |
| `shouldProcessEvent(packet)` | Returns `false` for empty / `'Hello'` messages; `true` for valid JSON with data |

---

## VirtualRemoteModes

**File**: `lib/virtual-remote-modus.js`  
**Extends**: `BaseClass`

Static enum-like class providing multilingual fan mode definitions.

### Mode Object Shape

```javascript
{
  id: string,   // Mode identifier sent to firmware API
  title: {
    en, nl, de, fr, it, sv, no, es, da, ru, pl, ko: string
  }
}
```

### All Modes

| Static member | `id` | Category |
|--------------|------|----------|
| `VirtualRemoteModes.AWAY` | `'away'` | Presence |
| `VirtualRemoteModes.LOW` | `'low'` | Speed |
| `VirtualRemoteModes.MEDIUM` | `'medium'` | Speed |
| `VirtualRemoteModes.HIGH` | `'high'` | Speed |
| `VirtualRemoteModes.AUTO` | `'auto'` | Automatic |
| `VirtualRemoteModes.AUTONIGHT` | `'autonight'` | Automatic |
| `VirtualRemoteModes.TIMER1` | `'timer1'` | Timer |
| `VirtualRemoteModes.TIMER2` | `'timer2'` | Timer |
| `VirtualRemoteModes.TIMER3` | `'timer3'` | Timer |
| `VirtualRemoteModes.JOIN` | `'join'` | Pairing |
| `VirtualRemoteModes.LEAVE` | `'leave'` | Pairing |
| `VirtualRemoteModes.MOTION_ON` | `'motion_on'` | Sensor |
| `VirtualRemoteModes.MOTION_OFF` | `'motion_off'` | Sensor |
| `VirtualRemoteModes.COOK30` | `'cook30'` | Kitchen |
| `VirtualRemoteModes.COOK60` | `'cook60'` | Kitchen |

---

## BaseClass

**File**: `lib/base-class.js`  
**Extends**: `Homey.SimpleClass`

Minimal base providing `homey` instance injection.

### Properties

| Property | Type | Default |
|----------|------|---------|
| `homey` | `Homey\|null` | `null` |

### Methods

#### `setHomeyObject(homey)`

Sets `this.homey`. Must be called before any method that uses `this.homey?.log` / `this.homey?.error`.

---

## Error Handling

### Error Messages Reference

| Error message | Source | Cause |
|--------------|--------|-------|
| `'Authentication failed. Please check the username and password.'` | `web-client.js:228` | HTTP 401, 403, or body `'AUTHENTICATION FAILED'` |
| `'API error: <message>'` | `web-client.js:250` | Firmware `{status:"error", message:...}` |
| `'API failure: <reason>'` | `web-client.js:256` | Firmware `{status:"fail", data:{failreason:...}}` |
| `'HTTP request failed (status: N, response: ...)'` | `web-client.js:266` | Non-200, unrecognized format |
| `'Request timeout'` | `web-client.js:95` | 10 s HTTP timeout exceeded |
| `'Invalid response format: missing ithostatus data'` | `nrgwatch-api.js:101` | Neither Format A nor B found |
| `'Invalid fan speed: N. Must be between 0 and 100'` | `nrgwatch-api.js:163` | `speed` param out of range |
| `'Device did not confirm fan mode change'` | `nrgwatch-api.js:150` | Response not `'OK'` or `{status:'success'}` |
| `'Connection test failed (status: N, response: ...)'` | `web-client.js:158` | Non-200 during pairing probe |
| `'Connection test timeout'` | `web-client.js:168` | 10 s timeout during pairing |

---

## Examples

### Basic status poll

```javascript
const api = new NRGWatchApi();
api.setHomeyObject(this.homey);
api.setSettings('192.168.1.100', '', '', false, false, 0);

const status = await api.getStatus();
console.log(status.temp, status.hum);
```

### Virtual remote mode change

```javascript
api.setSettings('nrg-itho-ab12.local', 'admin', 'pass', true, true, 0);
await api.setFanMode('auto');  // → GET /api.html?vremoteindex=0&vremotecmd=auto&username=admin&password=pass
```

### Fan speed set

```javascript
await api.setFanSpeed(75);  // → GET /api.html?speed=75
```

### Connection test during pairing

```javascript
const client = new WebClient();
const result = await client.testConnection('192.168.1.100');
if (result === 401) {
  // Show auth form to user
}
```

