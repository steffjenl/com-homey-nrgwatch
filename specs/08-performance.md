---
title: Performance
status: Draft
last_updated: 2026-03-20
source_coverage:
  - path: ./lib/web-client.js
  - path: ./lib/web-socket.js
  - path: ./drivers/itho-cve-wifi/device.js
  - path: ./drivers/itho-wtw-wifi/device.js
references:
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
---

# Performance

---

## 1. Hot Paths

| Path | Frequency | Latency budget | Notes |
|------|-----------|----------------|-------|
| Status poll (`getStatus` + `getCurrentSpeed`) | Every 15 s (default) | < 2 × 10 s timeout = 20 s | Two sequential HTTP requests per cycle |
| Fan mode set (user action) | On demand | < 10 s | Single HTTP request |
| Fan speed set (user action) | On demand | < 10 s | Single HTTP request |
| Capability value update | Every poll cycle | < 10 ms per call | ~11 `setCapabilityValue` calls per CVE poll |

---

## 2. Expected Throughput

The plugin makes at most:

```
2 HTTP requests per device per poll cycle
```

At default 15 s interval with N devices:

| Devices | Requests/min | Requests/hour |
|---------|-------------|--------------|
| 1 | ~8 | ~480 |
| 5 | ~40 | ~2400 |
| 10 | ~80 | ~4800 |

All requests are sequential within a device. Multiple devices poll independently.

---

## 3. Latency Profile

### HTTP Request Cycle

```
Plugin → TCP connect → HTTP GET → Device processes → HTTP response → Plugin
  ~0ms    ~1-5ms LAN    ~0ms        ~50-200ms ESP32     ~0ms           ~0ms

Typical round-trip: 50–300 ms on local LAN
Max allowed: 10 000 ms (WebClient.DEFAULTS.TIMEOUT)
```

### Poll Cycle Total (CVE, 11 capabilities)

```
getStatus()          50–300 ms
getCurrentSpeed()    50–300 ms
setCapabilityValue() × 11  ~1 ms each
─────────────────────────────────
Total:             ~110–600 ms
```

Well within the 15 s poll interval under normal conditions.

---

## 4. Resource Usage

### Memory

| Component | Footprint | Notes |
|-----------|----------|-------|
| `NRGWatchApi` instance | ~few KB | Per device; holds WebClient + WebSocket refs |
| `WebClient` | ~few KB | No connection pooling; TCP connect per request |
| `NRGWatchWebSocket` | ~few KB | + WS frame buffer if connected |
| `VirtualRemoteModes` | Static class | Loaded once; ~15 mode objects × ~200 bytes = ~3 KB |
| Status JSON | ~1–2 KB | Per poll; GC'd after parsing |

No persistent in-memory caches. Memory growth is bounded.

### Network

- Each HTTP request opens a **new TCP connection** (Node.js `http.request` without keep-alive)
- No connection pooling; each poll cycle = 2 × TCP handshake overhead
- WebSocket (when implemented) would maintain 1 persistent connection per device

### CPU

- Negligible: JSON parsing of small payloads, no computation-heavy operations
- Homey platform is multi-tenant; app should avoid tight loops or blocking operations

---

## 5. Timing Configuration

| Parameter | Default | Config | Code ref |
|-----------|---------|--------|---------|
| Poll interval | 15 s | `settings.refreshInterval` | `device.js:24` |
| HTTP timeout | 10 000 ms | Hardcoded | `web-client.js:30` |
| WS ping interval | 30 000 ms | Hardcoded | `web-socket.js:17` |
| Pairing retry | 10 × 1 s | Hardcoded | `driver.js:waitForResults` |
| Min poll interval | — | No lower bound enforced | — |

---

## 6. Tuning Knobs

| Knob | How | Impact |
|------|-----|--------|
| `refreshInterval` (device setting) | Increase to reduce load; decrease for faster updates | Primary tuning lever |
| HTTP timeout | Change `WebClient.DEFAULTS.TIMEOUT` | Affects how long a stalled request blocks the poll cycle |
| WS ping interval | Change `NRGWatchWebSocket.CONFIG.PING_INTERVAL` | When WS is implemented: connection health vs traffic |

---

## 7. Known Performance Issues

| Issue | Impact | Recommendation |
|-------|--------|---------------|
| No connection keep-alive | 2 × TCP handshake overhead per poll | Add `Connection: keep-alive` header or use `http.Agent` with `keepAlive: true` |
| Two sequential HTTP requests per poll | Total latency = sum of both; second is blocked by first | Parallelize with `Promise.all([getStatus(), getCurrentSpeed()])` |
| No minimum poll interval guard | User can set 1 s interval, overloading ESP32 | Add validation: minimum 5 s |
| `setCapabilityValue` calls not batched | 11 sequential async calls per CVE device | SDK does not support batch; current pattern is idiomatic |
| Polling continues even when device is unavailable | Wasteful HTTP timeouts (10 s × 2 = 20 s wasted per cycle) | Implement exponential backoff or set device unavailable, reduce poll rate |

