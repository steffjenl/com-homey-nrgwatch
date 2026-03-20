---
title: Error Handling & Retry Policy
status: Proposed
date: 2026-03-20
deciders: [Engineering Team]
reviewers: []
tags: [reliability, error-handling, retry, backoff]
---

# ADR-002 — Error Handling & Retry Policy

---

## Context

The current error handling strategy is:

1. **`WebClient`** throws typed error messages for HTTP failures (401, 403, timeouts, non-200)
2. **`NRGWatchApi`** catches, logs, and re-throws all errors
3. **Device `updateStatus()`** uses `.catch(this.error)` — errors are logged but the poll cycle continues
4. **No retry logic** — a failed HTTP request is simply lost until the next poll interval
5. **No device unavailability signalling** — even after 100 consecutive failures, Homey shows the device as available

This means:
- A device unreachable due to a 10 s network outage wastes `2 × 10 s = 20 s` per poll cycle
- Users see stale capability values without any visual indication of connection issues
- Short transient errors (e.g. device rebooting for 30 s) cause several missed polls with no recovery mechanism

**Constraints:**
- Homey's `setInterval` does not support cancellation + backoff natively
- `Homey.Device.setUnavailable(reason)` / `setAvailable()` provide user-visible status
- The firmware has no server-side request queuing; it processes requests sequentially

---

## Options

### Option A — Current behaviour (no change)

Keep the existing log-and-continue approach.

- ✅ No changes needed
- ❌ Device appears available even when unreachable
- ❌ Poll cycle wastes 20 s on every failure (2 × 10 s timeout)
- ❌ No user-visible signal

### Option B — Fail-fast with device unavailable

After the first HTTP failure, call `setUnavailable()`. On success, call `setAvailable()`.

- ✅ Immediate user feedback
- ❌ One transient error marks the device unavailable — too sensitive
- ❌ Flickering available/unavailable on intermittent networks

### Option C — Exponential backoff + unavailable after N failures (recommended)

Track consecutive failure count. After **3 consecutive failures**, set device unavailable. On success, set available and reset counter. Use exponential backoff to reduce poll frequency during failure periods.

- ✅ Tolerates transient errors (3 failures ≈ 45 s at 15 s interval)
- ✅ User sees unavailable after a meaningful outage
- ✅ Reduced wasted requests during extended outages
- ❌ More complex state management in device class
- ❌ Backoff implementation requires manual interval management

---

## Decision

**Proposed: Option C — Exponential backoff + device unavailable after 3 consecutive failures**

Threshold: 3 consecutive failures  
Backoff: 15 s → 30 s → 60 s → 120 s (cap at 120 s)  
Recovery: first successful poll resets counter and restores normal interval

---

## Consequences

### Positive
- Device shows as unavailable in Homey UI after ~45 s of unreachability
- Reduced HTTP traffic and timeout waste during outages
- Automatic recovery when device comes back online

### Negative
- Slightly delayed detection of outage (3 × interval vs immediate)
- Implementation requires replacing simple `setInterval` with managed polling loop

### Risks
- If `setUnavailable` / `setAvailable` have side effects in Homey SDK, need careful testing

### Follow-ups
1. Add `this._consecutiveFailures = 0` counter to device `onInit`
2. In `updateStatus()`: increment on catch; reset on success; call `setUnavailable`/`setAvailable`
3. Implement backoff: on each failure, double the interval (up to max)
4. On `onSettings` change, reset failure counter and interval

## Implementation Notes

```javascript
// Sketch — device.js
async updateStatus() {
  try {
    const status = await this.api.getStatus();
    // ... update capabilities
    if (this._consecutiveFailures > 0) {
      this._consecutiveFailures = 0;
      this._currentInterval = this.settings.refreshInterval ?? 15;
      await this.setAvailable();
    }
  } catch (error) {
    this._consecutiveFailures = (this._consecutiveFailures || 0) + 1;
    this.error(`Status update failed (attempt ${this._consecutiveFailures}):`, error.message);

    if (this._consecutiveFailures >= 3) {
      await this.setUnavailable(error.message).catch(this.error);
    }

    // Exponential backoff (cap at 120 s)
    this._currentInterval = Math.min(
      (this._currentInterval || this.settings.refreshInterval) * 2,
      120
    );
    this.homey.clearInterval(this.pollingInterval);
    this.pollingInterval = this.homey.setInterval(
      () => this.updateStatus(),
      this._currentInterval * 1000
    );
  }
}
```

Success criteria: device shows as unavailable in Homey within 60 s of device being powered off; shows available within one poll cycle after power-on.

## References

- Code: `drivers/itho-cve-wifi/device.js:218–268` — `updateStatus()`
- Code: `lib/web-client.js:222–270` — `_validateResponse` (error types)
- Code: `lib/nrgwatch-api.js:95–103` — error re-throw pattern
- Docs: [Homey SDK — setUnavailable](https://apps-sdk-v3.developer.homey.app/Device.html#setUnavailable)
- Risks: [R-7](../09-risk-register.md#r-7), [R-8](../09-risk-register.md#r-8)

