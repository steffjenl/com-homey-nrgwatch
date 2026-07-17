'use strict';

/**
 * Tracks the most recent {value, timestamp} sample per metric key and
 * computes the rate of change (value delta per minute) between consecutive
 * samples. One instance is meant to be owned by a single device.
 */
class RateTracker {
  constructor() {
    this._samples = new Map();
  }

  /**
   * Feed a new sample for `key` and get back the rate of change since the
   * previous sample, in units-per-minute. Returns null if no rate could be
   * computed (first sample for this key, invalid value, or dt <= 0).
   */
  update(key, value, timestamp = Date.now()) {
    if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    const prev = this._samples.get(key);
    if (!prev) {
      this._samples.set(key, { value, timestamp });
      return null;
    }

    const dt = timestamp - prev.timestamp;
    if (dt <= 0) {
      return null;
    }

    const rate = ((value - prev.value) / dt) * 60000;
    this._samples.set(key, { value, timestamp });
    return rate;
  }

  reset(key) {
    this._samples.delete(key);
  }
}

module.exports = RateTracker;
