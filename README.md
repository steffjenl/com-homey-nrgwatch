# NRGWatch for Homey

Control your Itho ventilation systems (CVE and WTW) through Homey with the NRGWatch app.

## Features

- **Real-time monitoring** of temperature, humidity, CO2 levels, and fan speeds
- **Multiple control modes** including manual, automatic, and timer-based operation
- **Virtual remote support** for RF-controlled devices
- **Auto-discovery** of devices on your network
- **Extensive device metrics** including operating hours and startup counters

## Supported Devices

### Itho CVE WiFi
- CVE ventilation units with WiFi module
- Full control and monitoring capabilities
- Virtual remote support

### Itho WTW WiFi  
- WTW heat recovery ventilation units with WiFi module
- RF remote control support
- Status monitoring

## Installation

1. Install the NRGWatch app from the Homey App Store
2. Add your Itho device through the Homey app
3. The app will auto-discover devices on your network, or you can manually enter the IP address
4. Configure authentication if required by your device
5. Select your device type and remote configuration

## Configuration

### Authentication
If your Itho device requires authentication:
- Enable "Authentication Required"
- Enter your username and password

### Virtual Remote
For CVE devices with virtual remote functionality:
- Enable "Virtual Remote"
- Select your remote type (RFT-CVE, RFT-Auto, RFT-N, etc.)
- Choose the virtual remote index (0-7)

### RF Remote
For WTW devices:
- Select your RF device type
- Choose the RF device index

### Refresh Interval
Configure how often the app polls device status (default: 15 seconds)

## Fan Modes

### Standard Modes
- **Away**: Minimal ventilation when nobody is home
- **Low**: Basic ventilation for normal conditions
- **Medium**: Standard ventilation
- **High**: Maximum ventilation for high humidity/CO2
- **Auto**: Automatic adjustment based on sensors
- **Auto Night**: Reduced speed automatic mode

### Timer Modes
- **Timer 1, 2, 3**: Temporary high-speed ventilation for predefined durations

### Special Modes
- **Join/Leave**: Activate/deactivate ventilation on arrival/departure
- **Cook 30/60**: High ventilation for 30 or 60 minutes (DF/QF models)
- **Motion On/Off**: Motion-based control (PIR models)

## Capabilities

### Sensors
- Temperature measurement
- Humidity measurement
- CO2 level measurement (ppm)
- Fan speed (RPM)
- Fan setpoint (RPM)
- Ventilation setpoint (%)
- Speed status

### Controls
- Fan mode selection
- Fan speed control (percentage)
- Quick action buttons (Join/Leave for virtual remote)

### Diagnostics
- Startup counter
- Total operating hours

## API Usage

The app provides a clean API for interacting with Itho devices:

```javascript
const api = new NRGWatchApi();
api.setSettings(host, username, password, isAuthenticated, enableVirtualRemote, virtualRemoteIndex);

// Get device status
const status = await api.getStatus();

// Get current fan speed
const speed = await api.getCurrentSpeed();

// Set fan mode
await api.setFanMode('high');

// Set fan speed (0-100%)
await api.setFanSpeed(75);
```

## Development

### Project Structure

```
lib/
  ├── base-class.js           # Base class for all components
  ├── nrgwatch-api.js         # Main API client
  ├── web-client.js           # HTTP client
  ├── web-socket.js           # WebSocket client for real-time updates
  └── virtual-remote-modus.js # Virtual remote mode definitions

drivers/
  ├── itho-cve-wifi/          # CVE driver
  └── itho-wtw-wifi/          # WTW driver
```

### Key Classes

#### NRGWatchApi
Main API client for device interaction. Handles all HTTP requests to the device.

#### WebClient
Low-level HTTP client with authentication support and error handling.

#### NRGWatchWebSocket
WebSocket client for real-time device updates (when supported).

#### VirtualRemoteModes
Definitions for all available fan modes with multi-language support.

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Troubleshooting

### Device Not Found
- Ensure the device is on the same network as Homey
- Check if the device WiFi module is properly configured
- Try entering the IP address manually

### Authentication Failed
- Verify username and password are correct
- Check if authentication is enabled on the device

### Connection Timeout
- Check network connectivity
- Verify the device IP address
- Ensure no firewall is blocking communication

### Commands Not Working
- Verify the correct virtual/RF remote type is selected
- Check if the remote index matches your device configuration
- Ensure the device firmware is up to date

## Support

For issues and feature requests, please visit:
- GitHub: [NRGWatch Issues](https://github.com/your-repo/issues)
- Homey Community: [Community Forum](https://community.homey.app)

## License

See [LICENSE](LICENSE) file for details.

## Changelog

### Version 1.0.0
- Initial release
- Support for Itho CVE and WTW devices
- Virtual remote functionality
- Comprehensive device monitoring
- Auto-discovery support

---

Made with ❤️ for Homey

