---
title: Glossary
status: Stable
last_updated: 2026-03-20
source_coverage:
  - path: ./ (all sources)
references:
  - name: Itho Daalderop
    url: https://www.ithodaalderop.nl/
  - name: Homey SDK v3
    url: https://apps-sdk-v3.developer.homey.app/index.html
---

# Glossary

Project-specific and domain-specific terminology used throughout this specification suite.

---

## Devices & Hardware

| Term | Definition |
|------|-----------|
| **Itho Daalderop** | Dutch manufacturer of ventilation, heat pump, and boiler systems. Parent brand for CVE and WTW product lines. |
| **CVE** | *Centraal Ventilatie Eenheid* — Dutch for "Central Ventilation Unit". A single-flow exhaust ventilation fan that extracts stale air from bathrooms, toilets, and kitchens. The app models this as driver `itho-cve-wifi`. |
| **WTW** | *Warmte Terugwin* — Dutch for "Heat Recovery". A heat-recovery ventilation unit (HRV / MVHR) that extracts stale air and supplies fresh air, recovering heat in the process. Modelled as driver `itho-wtw-wifi`. |
| **HRU** | *Heat Recovery Unit* — alternative acronym for WTW devices; used in firmware (`devices/hru200.h`, `devices/hru350.h`). |
| **NRG.Watch** | Brand name for the third-party WiFi add-on module (ESP32-based) that attaches to Itho devices via I²C and adds WiFi connectivity, an HTTP API, and WebSocket support. |
| **ESP32** | Espressif microcontroller used in the NRG.Watch WiFi module; runs the firmware in `.ai/ithowifi/`. |
| **CC1101** | Texas Instruments sub-GHz RF transceiver chip on the NRG.Watch module used to communicate with RF remote controls (Itho RFT remotes). |
| **I²C** | Two-wire serial bus protocol used to communicate between the NRG.Watch module and the Itho ventilation unit's control board. |

---

## Remote Control Types

| Term | Definition |
|------|-----------|
| **Virtual Remote (VRemote)** | A software-emulated RF remote registered in the NRG.Watch firmware's remote table. Commands are sent via `vremoteindex` + `vremotecmd` params. CVE-only feature. |
| **RF Remote** | A physical or emulated RF remote communicating over the CC1101 radio. WTW devices use RF remotes (`rfremoteindex` + `rfremotecmd` params). |
| **RFT** | *Radio Frequency Transceiver* — Itho's proprietary 868 MHz RF remote protocol. Remote types: RFT-CVE, RFT-Auto, RFT-N, RFT-AUTO-N, RFT-DF-QF, RFT-RV, RFT-CO2, RFT-PIR, RFT-Spider. |
| **Remote Index** | Integer slot (0–7) in the NRG.Watch firmware's remote table that identifies which virtual or RF remote to use for a given command. |
| **Join** | RF pairing operation — registers a new virtual remote with the Itho unit. Only accepted within 2 minutes after power cycle. |
| **Leave** | RF de-pairing operation — removes a registered virtual remote from the Itho unit. |

---

## Fan Modes

| Term | Definition |
|------|-----------|
| **Away** | Minimal ventilation speed; used when no occupants are present. |
| **Low** | Low-speed continuous ventilation for normal occupancy. |
| **Medium** | Medium-speed ventilation for elevated humidity or CO2. |
| **High** | Maximum continuous ventilation. |
| **Auto** | Firmware-controlled speed based on sensor readings (CO2, humidity). |
| **Auto Night** | Auto mode with reduced maximum speed during night hours. |
| **Timer 1/2/3** | Temporary boost mode for a predefined duration (typically 15 / 30 / 60 minutes). |
| **Cook 30 / Cook 60** | Kitchen-specific timer boost for 30 or 60 minutes. |
| **Motion On / Off** | PIR sensor-triggered modes: high ventilation when motion detected, low when not. |
| **Selection** | Integer field in the status response encoding the current fan mode (2=low, 3=medium, 4=high, 5=timer1, 7=auto). |

---

## Plugin Architecture

| Term | Definition |
|------|-----------|
| **NRGWatchApi** | The main API client class (`lib/nrgwatch-api.js`); orchestrates HTTP + WebSocket communication and provides high-level methods like `getStatus()`, `setFanMode()`. |
| **WebClient** | HTTP transport class (`lib/web-client.js`); handles raw HTTP GET requests, authentication, and timeout. |
| **NRGWatchWebSocket** | WebSocket client class (`lib/web-socket.js`); manages connection lifecycle and heartbeat. Currently a stub. |
| **VirtualRemoteModes** | Enum-like static class (`lib/virtual-remote-modus.js`) providing all fan mode definitions with multilingual titles. |
| **BaseClass** | Base class (`lib/base-class.js`) extending `Homey.SimpleClass`; provides `homey` instance reference and `setHomeyObject()`. |
| **IthoCveWifi** | Homey Device class for CVE devices (`drivers/itho-cve-wifi/device.js`). |
| **IthoWTWWifi** | Homey Device class for WTW devices (`drivers/itho-wtw-wifi/device.js`). |
| **Polling** | The interval-based mechanism (`setInterval`) used to periodically fetch device status via HTTP. Default: every 15 seconds. |

---

## Homey SDK

| Term | Definition |
|------|-----------|
| **Homey** | Smart home hub platform by Athom B.V. (Netherlands). This app targets Homey SDK v3 and Homey firmware ≥ 12.4.0. |
| **Capability** | A named data channel on a Homey device (e.g. `measure_temperature`, `fan_mode`). Can be readable, writable, or both. |
| **Driver** | A Homey class (`Homey.Driver`) managing device discovery, pairing, and the device factory. |
| **Device** | A Homey class (`Homey.Device`) representing a single physical device instance; manages settings, capabilities, and lifecycle. |
| **Flow Card** | A building block for Homey automation flows. Types: Trigger (when), Condition (and), Action (then). |
| **mDNS-SD** | Multicast DNS Service Discovery — used to auto-discover NRG.Watch devices on the local network by hostname pattern `nrg-itho-XXXX.local`. |
| **Homeycompose** | Build system tool that compiles `driver.compose.json` + `.homeycompose/app.json` into the final `app.json`. |
| **Maintenance Action** | A capability button type that appears in the device settings page (not the main device card). Used for `button.join` and `button.leave`. |

---

## API & Protocol

| Term | Definition |
|------|-----------|
| **api.html** | The single HTTP endpoint on the NRG.Watch firmware (`GET /api.html`). All read and write operations use query parameters on this endpoint. |
| **ithostatus** | The `get` command that returns full device status JSON. `GET /api.html?get=ithostatus`. |
| **currentspeed** | The `get` command that returns current fan speed. `GET /api.html?get=currentspeed`. |
| **Basic Auth** | HTTP authentication scheme sending `Authorization: Basic <base64(user:pass)>`. Also injected as query params by the NRG.Watch firmware requirement. |
| **Format A / Format B** | Two response format variants for the `ithostatus` endpoint — flat JSON (older firmware) vs nested `{data:{ithostatus:{...}}}` (newer firmware). |

