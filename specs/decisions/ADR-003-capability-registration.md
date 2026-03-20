---
title: Capability Registration — Static vs Dynamic
status: Proposed
date: 2026-03-20
deciders: [Engineering Team]
reviewers: []
tags: [sdk, capabilities, architecture]
---

# ADR-003 — Capability Registration: Static vs Dynamic

---

## Context

The CVE device (`drivers/itho-cve-wifi/device.js`) uses **dynamic capability management** — calling `addCapability()` and `removeCapability()` at runtime to add or remove `button.join`, `button.leave`, and `fan_speed` depending on the `enableVirtualRemote` setting.

The Homey SDK v3 supports declaring all capabilities statically in `driver.compose.json`, then conditionally showing/hiding them using `capabilitiesOptions`. Alternatively, `addCapability` / `removeCapability` can be used for truly dynamic scenarios.

**Current pattern** (`device.js:createAndRemoveCabapilities`, ~lines 53–144):
```javascript
if (this.settings.enableVirtualRemote) {
  if (!this.hasCapability('button.join')) await this.addCapability('button.join');
  if (!this.hasCapability('button.leave')) await this.addCapability('button.leave');
  if (this.hasCapability('fan_speed')) await this.removeCapability('fan_speed');
} else {
  if (this.hasCapability('button.join')) await this.removeCapability('button.join');
  if (this.hasCapability('button.leave')) await this.removeCapability('button.leave');
  if (!this.hasCapability('fan_speed')) await this.addCapability('fan_speed');
}
```

**Issues identified:**
- `button.join` and `button.leave` are listed in `driver.compose.json` capabilities array but also dynamically managed — potential duplication / state drift
- `fan_speed` is listed in `driver.compose.json` but conditionally removed — `app.json` may list it as always present
- `createAndRemoveCabapilities` has a typo (`Cabapilities` vs `Capabilities`)
- SDK best practice discourages dynamic add/remove for static devices

**Constraints:**
- Capabilities declared in `driver.compose.json` are provisioned when the device is added; removing them after-the-fact via `removeCapability()` is valid but creates a transient mismatch
- The Homey platform stores capability state per device; dynamic changes persist across restarts

---

## Options

### Option A — Keep dynamic management (current)

No changes. Continue adding/removing capabilities at runtime.

- ✅ No migration needed
- ✅ Works for existing devices
- ❌ State drift risk: capability present in `driver.compose.json` but removed at runtime
- ❌ Typo in method name
- ❌ Adds complexity to `onInit` and `onSettings`
- ❌ `button.join`/`button.leave` declared AND dynamically managed — confusing

### Option B — Static declaration + runtime guard (recommended)

Declare **all** capabilities statically in `driver.compose.json`. Use `hasCapability()` checks before reading/writing. Use `capabilitiesOptions` to configure behaviour. Remove the add/remove logic from `createAndRemoveCabapilities`.

For mutually exclusive capabilities (`fan_speed` vs `button.*`):
- Declare all in manifest
- In `onSettings`, when `enableVirtualRemote` changes, still call `removeCapability` once for the migration, then never add/remove again

- ✅ Consistent capability state between manifest and runtime
- ✅ Simpler device lifecycle
- ✅ No race conditions during init
- ❌ Requires one-time migration for existing devices
- ❌ `fan_speed` and `button.*` will always be "present" in Homey's device model, though unused

### Option C — Keep dynamic but make it idempotent and logged

Keep dynamic management but improve it:
- Add debug logging when adding/removing
- Remove the duplicate static declarations of `button.join`/`button.leave` from `driver.compose.json`
- Fix the typo
- Add a capability version check to avoid repeated add/remove on every init

- ✅ Minimal changes from current state
- ✅ Explicit control over what's shown
- ❌ Still complex; still has state drift risk

---

## Decision

**Proposed: Option B for new capabilities; Option C for existing to avoid breaking changes**

- For **new capabilities** in future versions: always declare statically
- For **existing capabilities** (`button.join`, `button.leave`, `fan_speed`): apply Option C as an interim step
  1. Remove `button.join` and `button.leave` from the static capabilities list in `driver.compose.json` (they should only be added dynamically)
  2. Fix the `createAndRemoveCabapilities` typo → `createAndRemoveCapabilities`
  3. Add capability version guard to prevent repeated operations

Full migration to Option B is a **breaking change** for existing paired devices and should be done in a major version bump with a migration step in `onInit`.

---

## Consequences

### Positive
- Cleaner separation: manifest = full capability set; runtime = conditional subset
- No confusing duplication in `driver.compose.json`
- Method typo fixed

### Negative
- Removing from `driver.compose.json` means newly paired devices won't have `button.*` capabilities until `onInit` runs and adds them
- Existing paired devices are unaffected (capabilities already present)

### Risks
- Race condition: if `onInit` fails before `addCapability`, user sees capabilities missing
- Homey may warn about capabilities added at runtime that are not in manifest

### Follow-ups
1. Remove `button.join`, `button.leave` from `driver.compose.json` capabilities array
2. Rename `createAndRemoveCabapilities` → `createAndRemoveCapabilities` everywhere
3. Add `// @migration` comment in `createAndRemoveCapabilities` for future removal
4. For full Option B migration: add `onInit` capability migration block in next major version

## References

- Code: `drivers/itho-cve-wifi/device.js:53–144` — `createAndRemoveCabapilities()`
- Code: `drivers/itho-cve-wifi/driver.compose.json:5–17` — static capabilities list
- Docs: [Homey SDK — addCapability](https://apps-sdk-v3.developer.homey.app/Device.html#addCapability)
- Docs: [Homey SDK — capabilitiesOptions](https://apps.developer.homey.app/the-basics/devices/capabilities#capability-options)
- Risks: [R-9](../09-risk-register.md#r-9)
- SDK deviation: [03-homey-sdk-mapping.md §10](../03-homey-sdk-mapping.md#10-deviations-from-sdk-best-practices)

