---
title: Coding Standards
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./.eslintrc.json
  - path: ./package.json
  - path: ./tsconfig.json
  - path: ./lib/
  - path: ./drivers/
  - path: ./app.js
references:
  - name: eslint-config-athom
    url: https://github.com/athombv/eslint-config-athom
  - name: Homey SDK v3 Coding Guide
    url: https://apps.developer.homey.app/
---

# Coding Standards

> Migrated and enriched from root `QUICK_REFERENCE.md`.

---

## 1. Language & Runtime

| Property | Value |
|----------|-------|
| Language | JavaScript (ES2021) — **no TypeScript compilation** |
| Type hints | JSDoc annotations only (TypeScript types via `@types/homey` for IDE support) |
| Module system | CommonJS (`require` / `module.exports`) |
| Runtime | Node.js (embedded in Homey firmware — version determined by Homey platform) |
| Strict mode | `'use strict'` at top of every file |

---

## 2. Linting

```bash
# Run lint
npm run lint

# Auto-fix safe issues
npm run lint -- --fix

# Lint specific file
npm run lint -- lib/nrgwatch-api.js
```

Config: `.eslintrc.json` — extends `eslint-config-athom` (Athom's official ruleset).

Key rules from `eslint-config-athom`:
- No `console.log` — use `this.log` / `this.error` instead
- Single quotes for strings
- Trailing comma in multi-line objects/arrays
- 2-space indentation
- `no-var` — use `const` / `let`
- `prefer-const`
- Arrow functions for callbacks

---

## 3. Folder Layout

```
com-homey-nrgwatch/
├── app.js                          # App entry point
├── app.json                        # Generated manifest (do not edit directly)
├── .homeycompose/
│   ├── app.json                    # Manifest source of truth
│   ├── capabilities/               # Custom capability definitions
│   └── discovery/                  # mDNS discovery configs
├── drivers/
│   ├── itho-cve-wifi/
│   │   ├── driver.js               # Homey.Driver subclass
│   │   ├── device.js               # Homey.Device subclass
│   │   ├── driver.compose.json     # Driver manifest (class, capabilities, pair views)
│   │   ├── driver.settings.compose.json  # Settings schema
│   │   ├── assets/
│   │   └── pair/                   # Pairing HTML views
│   └── itho-wtw-wifi/              # Same structure
├── lib/
│   ├── base-class.js               # BaseClass extends Homey.SimpleClass
│   ├── nrgwatch-api.js             # NRGWatchApi — high-level API client
│   ├── web-client.js               # WebClient — HTTP transport
│   ├── web-socket.js               # NRGWatchWebSocket — WS transport
│   └── virtual-remote-modus.js     # VirtualRemoteModes — fan mode enum
├── locales/
│   └── *.json                      # Translation strings
├── specs/                          # Engineering documentation (this folder)
└── assets/
    └── capability_icons/
```

---

## 4. Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Files | kebab-case | `nrgwatch-api.js`, `web-client.js` |
| Classes | PascalCase | `NRGWatchApi`, `WebClient` |
| Methods | camelCase | `getStatus()`, `setFanMode()` |
| Private methods | `_` prefix + camelCase | `_buildHeaders()`, `_isSuccessResponse()` |
| Constants (class-level) | `static UPPER_SNAKE_CASE` (object keys) | `WebClient.DEFAULTS.PORT` |
| Capability IDs | kebab-case with `.` for sub-capabilities | `measure_speed.fan_speed` |
| Driver IDs | kebab-case | `itho-cve-wifi` |
| Fan mode IDs | lowercase with `_` | `'motion_on'`, `'timer1'` |

---

## 5. Class Structure Pattern

All lib classes follow this pattern:

```javascript
'use strict';

const BaseClass = require('./base-class');

class MyClass extends BaseClass {
  // 1. Static constants
  static CONSTANTS = {
    KEY: value,
  };

  // 2. Constructor
  constructor(...props) {
    super(...props);
    /** @type {TypeName} Description */
    this.property = null;
  }

  // 3. Public methods (alphabetical or logical grouping)
  async publicMethod(param) { ... }

  // 4. Private helper methods (prefixed with _)
  _privateHelper() { ... }
}

module.exports = MyClass;
```

---

## 6. Error Handling Pattern

### In lib classes — log and re-throw:

```javascript
async someOperation() {
  try {
    const result = await this.doSomething();
    return result;
  } catch (error) {
    this.homey?.error('Failed to do thing:', error.message);
    throw error;  // caller must handle
  }
}
```

### In device/driver — bubble to Homey:

```javascript
// Non-critical: use catch(this.error) to continue on failure
this.setCapabilityValue('measure_temperature', status.temp)
  .catch(this.error);

// Critical path: explicit try-catch
async updateStatus() {
  try {
    const status = await this.api.getStatus().catch(this.error);
    // ... update capabilities
  } catch (error) {
    this.error('Error fetching status:', error);
  }
}
```

### Input validation — throw with descriptive message:

```javascript
async setFanSpeed(speed) {
  if (speed < 0 || speed > 100) {
    throw new Error(`Invalid fan speed: ${speed}. Must be between 0 and 100`);
  }
  // ...
}
```

---

## 7. JSDoc Standards

Every public method, property, and class must have JSDoc:

```javascript
/**
 * Brief one-line description of what this does.
 * @param {string} host - Device IP address or hostname
 * @param {string} [username=null] - Optional: username for auth
 * @param {boolean} isAuthenticated - Whether auth is required
 * @returns {Promise<Object>} The status object from the device
 * @throws {Error} If the request fails or returns invalid data
 */
async getStatus(host, username = null, isAuthenticated) { ... }
```

Private methods use `@private`:
```javascript
/**
 * Builds HTTP headers.
 * @private
 * @param {Object} params - Query parameters (modified in place)
 * @returns {Object} HTTP headers object
 */
_buildHeaders(params) { ... }
```

---

## 8. Async/Await Style

Prefer `async/await` over raw Promises:

```javascript
// ✅ Preferred
async getData() {
  const result = await this.api.getStatus();
  return result;
}

// ❌ Avoid
getData() {
  return new Promise((resolve, reject) => {
    this.api.getStatus().then(resolve).catch(reject);
  });
}
```

---

## 9. Capability Update Pattern

```javascript
// Non-critical: fire and forget, log error on failure
this.setCapabilityValue('measure_temperature', status.temp)
  .catch(this.error);

// Guard against missing capabilities
if (this.hasCapability('measure_co2')) {
  await this.setCapabilityValue('measure_co2', value);
}
```

---

## 10. Constants Pattern

Define at class level, not as module-level `const`:

```javascript
class WebClient extends BaseClass {
  static HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
  };

  static DEFAULTS = {
    PORT: 80,
    TIMEOUT: 10000,
  };
}
```

Access via `WebClient.HTTP_STATUS.OK` — never hard-code magic numbers.

---

## 11. How to Add a New Fan Mode

1. Add static member to `lib/virtual-remote-modus.js`:
```javascript
static NEW_MODE = {
  id: 'new_mode',
  title: {
    en: 'New Mode', nl: 'Nieuwe Modus', /* ... all 12 languages */
  },
};
```
2. Add to the relevant `options.values` array in `device.js:setFanModeOptions()` for the applicable remote type(s).
3. Add translations to all `locales/*.json` files.

---

## 12. How to Add a New Capability

1. Add `addCapability('new_cap')` guard in `device.js:createAndRemoveCabapilities()`:
```javascript
if (!this.hasCapability('new_cap')) {
  await this.addCapability('new_cap');
}
```
2. Map the status field in `device.js:updateStatus()`:
```javascript
this.setCapabilityValue('new_cap', status.field).catch(this.error);
```
3. If custom: add JSON definition in `.homeycompose/capabilities/new_cap.json`.
4. Declare in `driver.compose.json` capabilities array.

---

## 13. Pre-commit Checklist

- [ ] `npm run lint` — zero errors
- [ ] All new methods have JSDoc
- [ ] All new strings have translations in all 12 locale files
- [ ] Capabilities declared in `driver.compose.json` match runtime `addCapability` calls
- [ ] No `console.log` — use `this.log` or `this.homey.log`
- [ ] No hardcoded magic numbers — use static constants

