# API Documentation

## Table of Contents

- [NRGWatchApi](#nrgwatchapi)
- [WebClient](#webclient)
- [NRGWatchWebSocket](#nrgwatchwebsocket)
- [VirtualRemoteModes](#virtualremotemodes)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## NRGWatchApi

Main API client for interacting with Itho ventilation devices.

### Constructor

```javascript
const api = new NRGWatchApi();
```

### Methods

#### setSettings()

Configures the API client with connection settings.

```javascript
api.setSettings(host, username, password, isAuthenticated, enableVirtualRemote, virtualRemoteIndex)
```

**Parameters**:
- `host` (string): Device IP address or hostname
- `username` (string): Username for authentication (optional)
- `password` (string): Password for authentication (optional)
- `isAuthenticated` (boolean): Whether authentication is required
- `enableVirtualRemote` (boolean): Enable virtual remote functionality
- `virtualRemoteIndex` (number): Index of the virtual remote to use (0-7, default: 0)

**Returns**: `void`

**Example**:
```javascript
api.setSettings('192.168.1.100', 'admin', 'password', true, false, 0);
```

---

#### setHomeyObject()

Sets the Homey application instance for logging.

```javascript
api.setHomeyObject(homey)
```

**Parameters**:
- `homey` (Homey): The Homey application instance

**Returns**: `void`

---

#### getStatus()

Retrieves the current status of the Itho device.

```javascript
const status = await api.getStatus()
```

**Returns**: `Promise<Object>` - Device status object

**Response Object**:
```javascript
{
  temp: number,                           // Temperature in °C
  hum: number,                            // Humidity in %
  "CO2level (ppm)": number,              // CO2 level
  "Fan speed (rpm)": number,             // Current fan speed
  "Fan setpoint (rpm)": number,          // Fan speed setpoint
  "Ventilation setpoint (%)": number,    // Ventilation setpoint
  "Speed status": number,                // Speed status code
  "Startup counter": number,             // Device startup count
  "Total operation (hours)": number,     // Total operating hours
  Selection: number                       // Current mode (2=low, 3=medium, 4=high, 5=timer1, 7=auto)
}
```

**Throws**: `Error` if request fails or returns invalid data

**Example**:
```javascript
try {
  const status = await api.getStatus();
  console.log(`Temperature: ${status.temp}°C`);
  console.log(`Humidity: ${status.hum}%`);
  console.log(`CO2: ${status["CO2level (ppm)"]} ppm`);
} catch (error) {
  console.error('Failed to get status:', error.message);
}
```

---

#### getCurrentSpeed()

Retrieves the current fan speed of the device.

```javascript
const speed = await api.getCurrentSpeed()
```

**Returns**: `Promise<number>` - Current fan speed value

**Throws**: `Error` if request fails or returns invalid data

**Example**:
```javascript
try {
  const speed = await api.getCurrentSpeed();
  console.log(`Current fan speed: ${speed}%`);
} catch (error) {
  console.error('Failed to get speed:', error.message);
}
```

---

#### setFanMode()

Sets the fan mode of the device.

```javascript
const success = await api.setFanMode(mode, useRFRemote)
```

**Parameters**:
- `mode` (string): Fan mode to set
  - `'low'` - Low speed
  - `'medium'` - Medium speed
  - `'high'` - High speed
  - `'auto'` - Automatic mode
  - `'autonight'` - Auto night mode
  - `'away'` - Away mode
  - `'timer1'` - Timer 1
  - `'timer2'` - Timer 2
  - `'timer3'` - Timer 3
  - `'join'` - Join mode
  - `'leave'` - Leave mode
  - `'cook30'` - Cook 30 minutes
  - `'cook60'` - Cook 60 minutes
  - `'motion_on'` - Motion detected
  - `'motion_off'` - No motion
- `useRFRemote` (boolean): Use RF remote command instead of direct command (default: false)

**Returns**: `Promise<boolean>` - True if successful

**Throws**: `Error` if request fails or device doesn't accept the command

**Example**:
```javascript
try {
  await api.setFanMode('high');
  console.log('Fan mode set to high');
} catch (error) {
  console.error('Failed to set fan mode:', error.message);
}
```

---

#### setFanSpeed()

Sets the fan speed as a percentage.

```javascript
const success = await api.setFanSpeed(speed)
```

**Parameters**:
- `speed` (number): Speed percentage (0-100)

**Returns**: `Promise<boolean>` - True if successful

**Throws**: `Error` if request fails or speed is out of range

**Example**:
```javascript
try {
  await api.setFanSpeed(75);
  console.log('Fan speed set to 75%');
} catch (error) {
  console.error('Failed to set fan speed:', error.message);
}
```

---

#### setRFFanMode()

Sets the fan mode using RF remote commands.

```javascript
const success = await api.setRFFanMode(mode)
```

**Parameters**:
- `mode` (string): Fan mode to set (same as setFanMode)

**Returns**: `Promise<boolean>` - True if successful

**Throws**: `Error` if request fails

**Example**:
```javascript
try {
  await api.setRFFanMode('auto');
  console.log('RF fan mode set to auto');
} catch (error) {
  console.error('Failed to set RF fan mode:', error.message);
}
```

---

## WebClient

Low-level HTTP client for device communication.

### Constructor

```javascript
const client = new WebClient();
```

### Properties

- `_serverHost` (string|null): Server hostname or IP address
- `_serverPort` (number): Server port (default: 80)
- `_userName` (string|null): Username for authentication
- `_passWord` (string|null): Password for authentication
- `_isAuthenticated` (boolean): Whether authentication is enabled
- `_enableVirtualRemote` (boolean): Whether virtual remote is enabled
- `_virtualRemoteIndex` (number): Index of the virtual remote

### Methods

#### get()

Performs an HTTP GET request to the device API.

```javascript
const response = await client.get(resource, params)
```

**Parameters**:
- `resource` (string): API resource path (e.g., 'api.html')
- `params` (Object): Query parameters (default: {})

**Returns**: `Promise<string>` - Response body as string

**Throws**: `Error` if authentication fails or request fails

**Example**:
```javascript
try {
  const response = await client.get('api.html', { get: 'ithostatus' });
  const data = JSON.parse(response);
} catch (error) {
  console.error('Request failed:', error.message);
}
```

---

#### testConnection()

Tests connection to a device and determines if authentication is required.

```javascript
const result = await client.testConnection(ipAddress, userName, passWord)
```

**Parameters**:
- `ipAddress` (string): Device IP address
- `userName` (string|null): Username for authentication (optional)
- `passWord` (string|null): Password for authentication (optional)

**Returns**: `Promise<string|number>` - Response data or HTTP status code (401, 403)

**Throws**: `Error` if connection fails

**Example**:
```javascript
try {
  const result = await client.testConnection('192.168.1.100');
  if (result === 401) {
    console.log('Authentication required');
  } else {
    console.log('Connection successful');
  }
} catch (error) {
  console.error('Connection test failed:', error.message);
}
```

---

## NRGWatchWebSocket

WebSocket client for real-time device updates.

### Constructor

```javascript
const ws = new NRGWatchWebSocket();
```

### Properties

- `loggedInStatus` (string): Current connection status
- `lastWebsocketMessage` (string|null): Timestamp of last message

### Methods

#### isWebsocketConnected()

Checks if websocket connection is active.

```javascript
const isConnected = ws.isWebsocketConnected()
```

**Returns**: `boolean` - True if connected

---

#### getLastWebsocketMessageTime()

Gets the timestamp of the last received message.

```javascript
const timestamp = ws.getLastWebsocketMessageTime()
```

**Returns**: `string|null` - ISO timestamp or null

---

#### launchNotificationsListener()

Launches the WebSocket listener for real-time updates.

```javascript
const success = ws.launchNotificationsListener()
```

**Returns**: `boolean` - True if listener was started or already exists

**Example**:
```javascript
if (ws.launchNotificationsListener()) {
  console.log('WebSocket listener started');
  ws.configureNotificationsListener();
}
```

---

#### disconnectEventListener()

Disconnects the WebSocket event listener.

```javascript
await ws.disconnectEventListener()
```

**Returns**: `Promise<boolean>` - Resolves to true when disconnected

---

#### reconnectNotificationsListener()

Reconnects the notifications listener.

```javascript
await ws.reconnectNotificationsListener()
```

**Returns**: `Promise<void>`

---

## VirtualRemoteModes

Virtual remote mode definitions with multi-language support.

### Static Properties

All modes are static properties with the following structure:

```javascript
{
  id: string,      // Mode identifier
  title: {         // Translations
    en: string,
    nl: string,
    de: string,
    fr: string,
    it: string,
    sv: string,
    no: string,
    es: string,
    da: string,
    ru: string,
    pl: string,
    ko: string
  }
}
```

### Available Modes

- `VirtualRemoteModes.AWAY` - Minimal ventilation
- `VirtualRemoteModes.LOW` - Low speed
- `VirtualRemoteModes.MEDIUM` - Medium speed
- `VirtualRemoteModes.HIGH` - High speed
- `VirtualRemoteModes.AUTO` - Automatic
- `VirtualRemoteModes.AUTONIGHT` - Auto night
- `VirtualRemoteModes.TIMER1` - Timer 1
- `VirtualRemoteModes.TIMER2` - Timer 2
- `VirtualRemoteModes.TIMER3` - Timer 3
- `VirtualRemoteModes.JOIN` - Join mode
- `VirtualRemoteModes.LEAVE` - Leave mode
- `VirtualRemoteModes.MOTION_ON` - Motion detected
- `VirtualRemoteModes.MOTION_OFF` - No motion
- `VirtualRemoteModes.COOK30` - Cook 30 minutes
- `VirtualRemoteModes.COOK60` - Cook 60 minutes

**Example**:
```javascript
const VirtualRemoteModes = require('./lib/virtual-remote-modus');

const lowMode = VirtualRemoteModes.LOW;
console.log(lowMode.id);           // 'low'
console.log(lowMode.title.en);     // 'Low'
console.log(lowMode.title.nl);     // 'Laag'
```

---

## Error Handling

### Common Errors

#### Authentication Error

```javascript
Error: Authentication failed. Please check the username and password.
```

**Cause**: Invalid credentials or authentication required but not provided

**Solution**: Verify username and password in device settings

---

#### Connection Error

```javascript
Error: Request timeout
Error: ECONNREFUSED
Error: EHOSTUNREACH
```

**Cause**: Network connectivity issues or incorrect IP address

**Solution**: Verify device IP address and network connectivity

---

#### Invalid Response

```javascript
Error: Invalid response format: missing ithostatus data
Error: Invalid response format: missing currentspeed data
```

**Cause**: Device returned unexpected response format

**Solution**: Check device firmware version, verify device is responding correctly

---

#### Invalid Speed Range

```javascript
Error: Invalid fan speed: 150. Must be between 0 and 100
```

**Cause**: Speed value outside valid range

**Solution**: Use speed value between 0 and 100

---

#### Device Command Failure

```javascript
Error: Device did not confirm fan mode change
Error: Device did not confirm fan speed change
```

**Cause**: Device rejected the command

**Solution**: Verify device supports the requested mode, check virtual remote configuration

---

## Examples

### Complete Setup Example

```javascript
const NRGWatchApi = require('./lib/nrgwatch-api');

// Create and configure API
const api = new NRGWatchApi();
api.setHomeyObject(this.homey);
api.setSettings(
  '192.168.1.100',  // host
  'admin',          // username
  'password',       // password
  true,             // isAuthenticated
  false,            // enableVirtualRemote
  0                 // virtualRemoteIndex
);

// Get device status
try {
  const status = await api.getStatus();
  console.log('Device Status:');
  console.log(`  Temperature: ${status.temp}°C`);
  console.log(`  Humidity: ${status.hum}%`);
  console.log(`  CO2: ${status["CO2level (ppm)"]} ppm`);
} catch (error) {
  console.error('Failed to get status:', error.message);
}

// Set fan mode
try {
  await api.setFanMode('high');
  console.log('Fan mode set to high');
} catch (error) {
  console.error('Failed to set mode:', error.message);
}
```

---

### Virtual Remote Example

```javascript
const NRGWatchApi = require('./lib/nrgwatch-api');
const VirtualRemoteModes = require('./lib/virtual-remote-modus');

// Configure with virtual remote
const api = new NRGWatchApi();
api.setSettings(
  '192.168.1.100',
  null,
  null,
  false,
  true,  // Enable virtual remote
  0      // Use virtual remote 0
);

// Set mode using virtual remote
await api.setFanMode(VirtualRemoteModes.AUTO.id);
```

---

### Polling Example

```javascript
// Poll device status every 30 seconds
const pollInterval = this.homey.setInterval(async () => {
  try {
    const status = await this.api.getStatus();
    
    // Update capabilities
    await this.setCapabilityValue('measure_temperature', status.temp);
    await this.setCapabilityValue('measure_humidity', status.hum);
    await this.setCapabilityValue('measure_co2', status["CO2level (ppm)"]);
    
  } catch (error) {
    this.error('Polling failed:', error);
  }
}, 30000);

// Clean up on device delete
this.homey.clearInterval(pollInterval);
```

---

### Connection Test Example

```javascript
const WebClient = require('./lib/web-client');

const client = new WebClient();

// Test without authentication
try {
  const result = await client.testConnection('192.168.1.100');
  
  if (result === 401 || result === 403) {
    console.log('Device requires authentication');
    // Prompt user for credentials
  } else {
    console.log('Connection successful, no auth required');
  }
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

---

### WebSocket Example

```javascript
const NRGWatchWebSocket = require('./lib/web-socket');

const ws = new NRGWatchWebSocket();
ws.setHomeyObject(this.homey);

// Launch WebSocket connection
if (ws.launchNotificationsListener()) {
  ws.configureNotificationsListener();
  
  // Check connection status
  console.log('Connected:', ws.isWebsocketConnected());
  console.log('Last message:', ws.getLastWebsocketMessageTime());
}

// Disconnect on cleanup
await ws.disconnectEventListener();
```

---

## Best Practices

1. **Always handle errors**: Wrap API calls in try-catch blocks
2. **Use appropriate timeouts**: Don't poll too frequently
3. **Clean up resources**: Clear intervals on device deletion
4. **Validate inputs**: Check speed ranges before calling API
5. **Log appropriately**: Use homey.log for info, homey.error for errors
6. **Test authentication**: Use testConnection before pairing
7. **Check capabilities**: Verify device supports requested operations
8. **Handle network issues**: Implement retry logic where appropriate

---

Last Updated: February 9, 2026

