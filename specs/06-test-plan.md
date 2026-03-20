---
title: Test Plan
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/nrgwatch-api.js
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-cve-wifi/driver.js
  - path: ./.ai/ithowifi/software/NRG_itho_wifi/test/test.js
references:
  - name: Homey SDK v3 Testing
    url: https://apps.developer.homey.app/guides/testing
  - name: Node.js test runner
    url: https://nodejs.org/api/test.html
---

# Test Plan

---

## 1. Current State

**No automated tests exist.** The only test-related file found is:

```
.ai/ithowifi/software/NRG_itho_wifi/test/test.js  — firmware-side test (not plugin tests)
```

There is no `test/` directory, no test framework configured in `package.json`, and no CI test step in `.github/`.

---

## 2. Test Matrix

| Layer | Type | Priority | Status |
|-------|------|----------|--------|
| `WebClient.get()` | Unit | High | ❌ Missing |
| `WebClient.testConnection()` | Unit | High | ❌ Missing |
| `WebClient._buildHeaders()` (auth/no-auth) | Unit | High | ❌ Missing |
| `WebClient._validateResponse()` | Unit | High | ❌ Missing |
| `WebClient._toQueryString()` | Unit | Medium | ❌ Missing |
| `NRGWatchApi.getStatus()` — Format A | Unit | High | ❌ Missing |
| `NRGWatchApi.getStatus()` — Format B | Unit | High | ❌ Missing |
| `NRGWatchApi.getCurrentSpeed()` | Unit | Medium | ❌ Missing |
| `NRGWatchApi.setFanMode()` — direct | Unit | High | ❌ Missing |
| `NRGWatchApi.setFanMode()` — virtual remote | Unit | High | ❌ Missing |
| `NRGWatchApi.setFanMode()` — RF | Unit | High | ❌ Missing |
| `NRGWatchApi.setFanSpeed()` — valid range | Unit | High | ❌ Missing |
| `NRGWatchApi.setFanSpeed()` — out of range | Unit | Medium | ❌ Missing |
| `NRGWatchApi._isSuccessResponse()` | Unit | High | ❌ Missing |
| `VirtualRemoteModes` static members | Unit | Low | ❌ Missing |
| CVE `updateStatus()` — all field variants | Integration | High | ❌ Missing |
| CVE `setFanModeOptions()` per type | Integration | Medium | ❌ Missing |
| CVE `createAndRemoveCabapilities()` | Integration | Medium | ❌ Missing |
| Pairing flow — mDNS path | E2E | Medium | ❌ Missing |
| Pairing flow — manual IP path | E2E | Medium | ❌ Missing |
| Auth failure during pairing | Integration | High | ❌ Missing |
| Settings change → API reconfigured | Integration | Medium | ❌ Missing |

---

## 3. Recommended Test Framework

```bash
# Install test dependencies
npm install --save-dev jest

# Or use Node.js built-in test runner (Node >= 18)
# No install needed
```

Suggested `package.json` addition:
```json
{
  "scripts": {
    "test": "node --test test/**/*.test.js",
    "test:watch": "node --test --watch test/**/*.test.js"
  }
}
```

---

## 4. How to Run Existing Checks

```bash
# Lint (only automated check currently available)
npm run lint

# Lint a specific file
npx eslint lib/nrgwatch-api.js

# Type-check (tsconfig.json present; checks JSDoc types)
npx tsc --noEmit
```

---

## 5. Mock Strategy

### Mock: `WebClient`

```javascript
// test/mocks/web-client.mock.js
class WebClientMock {
  constructor() {
    this._serverHost = 'test-device.local';
    this._isAuthenticated = false;
    this._enableVirtualRemote = false;
    this._virtualRemoteIndex = 0;
  }

  async get(resource, params) {
    // Return fixture based on params
    if (params.get === 'ithostatus') return JSON.stringify(fixtures.statusFormatA);
    if (params.get === 'currentspeed') return '75';
    if (params.command || params.vredemotecmd || params.rfremotecmd) return 'OK';
    return 'OK';
  }

  async testConnection(ip) {
    return JSON.stringify(fixtures.statusFormatA);
  }

  setHomeyObject(homey) { this.homey = homey; }
}
```

### Mock: Homey App Instance

```javascript
const homeyMock = {
  log: (...args) => console.log('[HOMEY LOG]', ...args),
  error: (...args) => console.error('[HOMEY ERR]', ...args),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};
```

---

## 6. Fixture Payloads

### Status — Format A (flat, older firmware)

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

### Status — Format B (wrapped, newer firmware)

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

### Current Speed

```json
// Wrapped:
{ "data": { "currentspeed": 75 } }

// Raw:
75
```

### Successful Command Response

```
"OK"
```

or

```json
{ "status": "success" }
```

### Error Responses

```json
{ "status": "fail", "data": { "failreason": "Invalid command" } }
{ "status": "error", "message": "Internal server error" }
{ "status": "fail", "data": { "code": 401 } }
```

---

## 7. Key Unit Test Scenarios

### `WebClient._validateResponse`

```javascript
// Should throw on 401
assert.throws(() => client._validateResponse(401, ''), /Authentication failed/);

// Should throw on body 'AUTHENTICATION FAILED'
assert.throws(() => client._validateResponse(200, 'AUTHENTICATION FAILED'), /Authentication failed/);

// Should throw on JSON error response
assert.throws(
  () => client._validateResponse(500, '{"status":"error","message":"crash"}'),
  /API error: crash/
);

// Should not throw on 200 OK
assert.doesNotThrow(() => client._validateResponse(200, '{"temp":21.5}'));
```

### `NRGWatchApi._isSuccessResponse`

```javascript
assert.ok(api._isSuccessResponse('OK'));
assert.ok(api._isSuccessResponse('{"status":"success"}'));
assert.ok(!api._isSuccessResponse('{"status":"fail"}'));
assert.ok(!api._isSuccessResponse(''));
```

### `NRGWatchApi._buildFanModeCommand`

```javascript
// Direct command
api.webclient._enableVirtualRemote = false;
assert.deepEqual(api._buildFanModeCommand('low', false), { command: 'low' });

// RF remote
assert.deepEqual(api._buildFanModeCommand('low', true), { rfremotecmd: 'low' });

// Virtual remote
api.webclient._enableVirtualRemote = true;
api.webclient._virtualRemoteIndex = 2;
assert.deepEqual(
  api._buildFanModeCommand('low', false),
  { vremoteindex: 2, vremotecmd: 'low' }
);
```

### `NRGWatchApi.setFanSpeed` — validation

```javascript
await assert.rejects(api.setFanSpeed(-1), /Invalid fan speed/);
await assert.rejects(api.setFanSpeed(101), /Invalid fan speed/);
await assert.doesNotReject(api.setFanSpeed(50));
```

---

## 8. Integration Test Scenarios

### Scenario A: Happy path poll cycle

1. Configure `NRGWatchApi` with mock `WebClient` returning Format B status
2. Call `getStatus()` + `getCurrentSpeed()`
3. Assert all capability values are correctly extracted and match expected values

### Scenario B: Authentication failure

1. Configure `WebClient` mock to return HTTP 401
2. Call `getStatus()`
3. Assert error is thrown with message containing `'Authentication failed'`

### Scenario C: Fan mode roundtrip

1. Set `enableVirtualRemote=false`
2. Call `setFanMode('high')`
3. Assert `WebClient.get` called with `{ command: 'high' }`
4. Assert return value is `true`

### Scenario D: Firmware format fallback

1. Return status with only `co2level_ppm` key (no `CO2level (ppm)`)
2. Assert `measure_co2` capability receives the correct value
3. Assert no error is thrown

### Scenario E: Polling on unreachable device

1. `WebClient.get` throws `ECONNREFUSED`
2. Device `updateStatus()` should log error but not crash
3. Polling interval should continue running

---

## 9. E2E / Manual Test Checklist

For testing against a real NRG.Watch device:

- [ ] mDNS discovery finds `nrg-itho-XXXX.local` within 30 s
- [ ] Manual IP pairing succeeds with valid hostname
- [ ] Auth pairing: 401 returned when wrong credentials, 200 when correct
- [ ] Status polling updates temperature, humidity, CO2 every 15 s
- [ ] Fan mode change `low → medium → high` via Homey app
- [ ] Fan speed slider (0–100) sends correct `speed` param
- [ ] `button.join` sends within 2-minute window after power cycle
- [ ] `button.leave` removes virtual remote
- [ ] Settings change (new refresh interval) → polling restarts at new rate
- [ ] Device deletion clears polling interval (no background leaks)

