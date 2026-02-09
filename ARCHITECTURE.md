# Architecture Documentation

## Overview

The NRGWatch Homey app is designed to control and monitor Itho ventilation systems. The architecture follows a clean, modular design with clear separation of concerns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Homey Platform                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      NRGWatch App                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    app.js                            │   │
│  │  - Application initialization                        │   │
│  │  - Flow card registration                            │   │
│  │  - Utility functions                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                  │
┌─────────▼────────┐              ┌─────────▼────────┐
│  Driver Layer    │              │  Driver Layer    │
│  (CVE)           │              │  (WTW)           │
├──────────────────┤              ├──────────────────┤
│ - Device pairing │              │ - Device pairing │
│ - Device discovery│             │ - Device discovery│
│ - Settings mgmt  │              │ - Settings mgmt  │
└─────────┬────────┘              └─────────┬────────┘
          │                                  │
          └────────────────┬─────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Device Layer      │
                ├─────────────────────┤
                │ - Status polling    │
                │ - Capability mgmt   │
                │ - Event handling    │
                └──────────┬──────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                 │
┌─────────▼─────────┐ ┌───▼────────┐ ┌─────▼─────────┐
│  NRGWatchApi     │ │ WebClient  │ │  WebSocket    │
│                  │ │            │ │               │
│ - getStatus()    │ │ - get()    │ │ - connect()   │
│ - setFanMode()   │ │ - auth     │ │ - events      │
│ - setFanSpeed()  │ │ - errors   │ │ - heartbeat   │
└──────────────────┘ └────────────┘ └───────────────┘
          │                │                 │
          └────────────────┼─────────────────┘
                           │
              ┌────────────▼────────────┐
              │   Itho Device           │
              │   (WiFi Module)         │
              └─────────────────────────┘
```

## Layer Descriptions

### 1. Application Layer (app.js)

**Responsibility**: Application-wide initialization and management

**Key Components**:
- `NRGWatch` class - Main app class extending Homey.App
- Flow card registration
- Utility functions (timezone conversion)

**Design Pattern**: Singleton (one app instance)

### 2. Driver Layer

**Responsibility**: Device discovery, pairing, and driver-level management

**Key Components**:
- `IthoCveWifiDriver` - Driver for CVE devices
- `IthoWtwWifiDriver` - Driver for WTW devices

**Key Functions**:
- Device discovery via mDNS/SSDP
- Pairing workflow management
- Device validation and connection testing
- Settings configuration

**Design Pattern**: Factory pattern for device creation

### 3. Device Layer

**Responsibility**: Individual device management and state handling

**Key Components**:
- `IthoCveWifi` - CVE device class
- `IthoWTWWifi` - WTW device class

**Key Functions**:
- Capability management (add/remove)
- Status polling
- Capability listeners
- Settings synchronization
- Fan mode configuration

**Design Pattern**: Observer pattern for capability changes

### 4. API Layer (lib/)

**Responsibility**: Communication with Itho devices

#### 4.1 Base Layer

**BaseClass** (`base-class.js`)
- Base class for all library components
- Provides Homey instance management
- Shared logging functionality

#### 4.2 API Client Layer

**NRGWatchApi** (`nrgwatch-api.js`)
- High-level API for device operations
- Command abstraction
- Response parsing
- Error handling

**Key Methods**:
```javascript
setSettings(host, username, password, isAuthenticated, enableVirtualRemote, virtualRemoteIndex)
getStatus() -> Promise<Object>
getCurrentSpeed() -> Promise<number>
setFanMode(mode, useRFRemote) -> Promise<boolean>
setFanSpeed(speed) -> Promise<boolean>
setRFFanMode(mode) -> Promise<boolean>
```

#### 4.3 Transport Layer

**WebClient** (`web-client.js`)
- HTTP communication
- Authentication handling
- Request/response management
- Error handling and validation

**Key Features**:
- Basic authentication support
- Query string building
- JSON response parsing
- Timeout handling
- Connection testing

**NRGWatchWebSocket** (`web-socket.js`)
- Real-time updates via WebSocket
- Connection management
- Heartbeat/ping-pong
- Event filtering and processing

#### 4.4 Data Layer

**VirtualRemoteModes** (`virtual-remote-modus.js`)
- Mode definitions
- Multi-language support
- Mode metadata

## Data Flow

### 1. Device Status Update Flow

```
Device Timer → updateStatus()
                    ↓
            api.getStatus()
                    ↓
            webclient.get('/api.html?get=ithostatus')
                    ↓
            HTTP Request → Itho Device
                    ↓
            HTTP Response ← Itho Device
                    ↓
            JSON Parsing
                    ↓
            setCapabilityValue() × N
                    ↓
            Homey Platform Updates
```

### 2. Fan Mode Change Flow

```
User Action (App/Flow) → Capability Listener
                              ↓
                    api.setFanMode(mode)
                              ↓
                    _buildFanModeCommand()
                              ↓
                    webclient.get('/api.html', command)
                              ↓
                    HTTP Request → Itho Device
                              ↓
                    HTTP Response ← Itho Device
                              ↓
                    _isSuccessResponse()
                              ↓
                    Return success/failure
```

### 3. Device Pairing Flow

```
User Initiates Pairing
        ↓
Discovery Strategy
        ↓
    ┌───┴───┐
    │       │
Auto-    Manual
Discover  IP Entry
    │       │
    └───┬───┘
        ↓
Connection Test (testConnection)
        ↓
    ┌───┴───────┐
    │           │
Auth Required  No Auth
    │           │
    └─────┬─────┘
          ↓
Settings Configuration
          ↓
Device Creation
          ↓
Add to Homey
```

## Error Handling Strategy

### 1. Network Errors
- Timeout handling with configurable timeout
- Retry logic (implicit through polling)
- Connection status tracking
- User-friendly error messages

### 2. Authentication Errors
- HTTP 401/403 detection
- Clear error messages
- Authentication test during pairing

### 3. API Errors
- JSON parsing errors
- Invalid response format handling
- Device-specific error codes
- Logging for diagnostics

### 4. Device Errors
- Capability synchronization failures
- Invalid mode settings
- Speed range validation

## Configuration Management

### Device Settings

```javascript
{
  host: string,              // Device IP/hostname
  username: string,          // Auth username (optional)
  password: string,          // Auth password (optional)
  isAuthenticated: boolean,  // Auth enabled flag
  enableVirtualRemote: boolean,  // Virtual remote flag
  virtualRemoteType: string,     // Remote type (CVE only)
  virtualRemoteIndex: string,    // Remote index (0-7)
  rfDeviceType: string,          // RF type (WTW only)
  rfDeviceIndex: string,         // RF index (WTW only)
  refreshInterval: number        // Polling interval (seconds)
}
```

## Capability Management

### Dynamic Capabilities

The app dynamically adds/removes capabilities based on configuration:

**Always Present**:
- `measure_temperature`
- `measure_humidity`
- `fan_mode`

**CVE Specific**:
- `measure_co2`
- `fan_speed` (manual control)
- `measure_speed.fan_speed`
- `measure_speed.fan_setpoint`
- `measure_speed.ventilation_setpoint`
- `measure_speed.speed_status`
- `measure_number.startup_counter`
- `measure_number.total_operating_hours`

**Virtual Remote Specific**:
- `button.join`
- `button.leave`

### Fan Mode Options

Fan mode options are dynamically configured based on:
- Virtual remote enabled/disabled
- Virtual remote type (CVE)
- RF device type (WTW)

Each remote type has a specific set of available modes (see VirtualRemoteModes).

## Performance Considerations

### 1. Polling Strategy
- Configurable refresh interval (default: 15 seconds)
- Prevents overloading device API
- Balance between responsiveness and resource usage

### 2. Capability Updates
- Batch capability updates in single cycle
- Error handling prevents cascade failures
- Silent failures for non-critical capabilities

### 3. WebSocket (Future Enhancement)
- Real-time updates when available
- Reduces polling frequency
- Event-driven architecture

## Security Considerations

### 1. Authentication
- Basic HTTP authentication support
- Credentials stored in Homey settings
- Credentials transmitted over local network only

### 2. Network Security
- Communication over local network
- No cloud dependencies
- HTTPS/WSS support for WebSocket (when available)

### 3. Input Validation
- Speed range validation (0-100)
- Mode validation against allowed values
- IP address format validation during pairing

## Extensibility Points

### 1. New Device Types
- Extend device base classes
- Implement driver interface
- Add device-specific capabilities

### 2. New Fan Modes
- Add to VirtualRemoteModes
- Update fan mode configuration logic
- Add translations

### 3. Flow Cards
- Custom actions in app.js
- Device-specific triggers
- Condition cards for status checks

### 4. WebSocket Events
- Implement event handlers in configureNotificationsListener
- Add event-specific logic
- Trigger flows based on events

## Testing Strategy

### Unit Testing
- API layer methods
- Helper functions
- Command builders
- Response parsers

### Integration Testing
- Device communication
- Authentication flow
- Error scenarios
- Capability management

### End-to-End Testing
- Full pairing workflow
- Mode changes
- Status updates
- Settings updates

## Future Enhancements

1. **Enhanced WebSocket Support**
   - Full real-time updates
   - Bidirectional communication
   - Event-driven architecture

2. **Advanced Scheduling**
   - Custom timer profiles
   - Weekly schedules
   - Presence-based automation

3. **Multi-Device Coordination**
   - Zone-based control
   - Synchronized operation
   - Load balancing

4. **Enhanced Diagnostics**
   - Filter replacement reminders
   - Maintenance scheduling
   - Performance analytics

5. **Cloud Integration** (Optional)
   - Remote monitoring
   - Analytics dashboard
   - Firmware update checks

## Maintenance Notes

### Code Quality
- ESLint for code style
- JSDoc for documentation
- Consistent naming conventions
- SOLID principles

### Dependencies
- Minimal external dependencies
- Regular security updates
- Homey SDK compatibility

### Backwards Compatibility
- Settings migration on updates
- Capability migration
- Deprecation warnings

---

Last Updated: February 9, 2026

