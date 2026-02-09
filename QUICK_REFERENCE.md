# Quick Reference Guide

Quick reference for developers working with the NRGWatch codebase.

## Project Structure

```
com-homey-nrgwatch/
├── app.js                    # Main application entry point
├── lib/                      # Core library modules
│   ├── base-class.js        # Base class for all components
│   ├── nrgwatch-api.js      # Main API client
│   ├── web-client.js        # HTTP client
│   ├── web-socket.js        # WebSocket client
│   └── virtual-remote-modus.js  # Fan mode definitions
├── drivers/                  # Device drivers
│   ├── itho-cve-wifi/       # CVE device driver
│   └── itho-wtw-wifi/       # WTW device driver
└── locales/                  # Translations

Documentation:
├── README.md                 # User guide
├── ARCHITECTURE.md           # Technical architecture
├── API.md                    # API reference
├── CHANGELOG.md              # Version history
└── CONTRIBUTING.md           # Contribution guide
```

## Common Tasks

### Adding a New Fan Mode

1. Add to `lib/virtual-remote-modus.js`:
```javascript
static NEW_MODE = {
  id: 'new_mode',
  title: {
    en: 'New Mode',
    nl: 'Nieuwe Modus',
    // ... other languages
  },
};
```

2. Update device driver to include the mode in options

3. Add translations to `locales/*.json`

### Adding a New Capability

1. In device class (`drivers/*/device.js`):
```javascript
if (!this.hasCapability('new_capability')) {
  await this.addCapability('new_capability');
}
```

2. Update capability in `updateStatus()`:
```javascript
await this.setCapabilityValue('new_capability', value);
```

3. Add to app.json capabilities definition

### Adding a New API Method

1. In `lib/nrgwatch-api.js`:
```javascript
/**
 * Description of what the method does.
 * @param {type} param - Parameter description
 * @returns {Promise<ReturnType>} Return value description
 * @throws {Error} When it fails
 */
async newMethod(param) {
  try {
    const response = await this.webclient.get(
      NRGWatchApi.ENDPOINTS.API,
      { command: param }
    );
    return response;
  } catch (error) {
    this.homey?.error('Failed to do thing:', error.message);
    throw error;
  }
}
```

## Code Standards

### Documentation (JSDoc)

Always document:
```javascript
/**
 * Brief description of what this does.
 * @param {string} param1 - First parameter
 * @param {number} [param2=0] - Optional parameter with default
 * @returns {Promise<Object>} What it returns
 * @throws {Error} When it throws
 */
async myMethod(param1, param2 = 0) {
  // implementation
}
```

### Error Handling

Always use try-catch:
```javascript
async someOperation() {
  try {
    const result = await this.doSomething();
    return result;
  } catch (error) {
    this.homey?.error('Context about error:', error.message);
    throw error; // Re-throw if caller should handle
  }
}
```

### Constants

Define constants at class level:
```javascript
class MyClass {
  static CONSTANTS = {
    TIMEOUT: 5000,
    MAX_RETRIES: 3,
  };
  
  someMethod() {
    const timeout = MyClass.CONSTANTS.TIMEOUT;
  }
}
```

### Input Validation

Validate before processing:
```javascript
async setSpeed(speed) {
  if (speed < 0 || speed > 100) {
    throw new Error(`Invalid speed: ${speed}. Must be 0-100`);
  }
  // proceed
}
```

## Testing Checklist

### Before Committing
- [ ] Run `npm run lint`
- [ ] Fix all ESLint errors
- [ ] Add JSDoc comments
- [ ] Update documentation if needed
- [ ] Test manually

### Manual Testing
- [ ] Device pairing works
- [ ] Commands execute successfully
- [ ] Status updates correctly
- [ ] Error messages are clear
- [ ] Settings save properly

## Common Patterns

### Async/Await Pattern
```javascript
// Good
async getData() {
  const result = await this.api.getStatus();
  return result;
}

// Avoid
getData() {
  return new Promise((resolve, reject) => {
    this.api.getStatus()
      .then(result => resolve(result))
      .catch(error => reject(error));
  });
}
```

### Error Message Pattern
```javascript
// Good
catch (error) {
  this.homey?.error('Failed to update status:', error.message);
  throw new Error(`Status update failed: ${error.message}`);
}

// Avoid
catch (error) {
  console.log(error);
  throw error;
}
```

### Capability Update Pattern
```javascript
// Good
await this.setCapabilityValue('measure_temperature', status.temp)
  .catch(this.error);

// If multiple updates
try {
  await this.setCapabilityValue('measure_temperature', status.temp);
  await this.setCapabilityValue('measure_humidity', status.hum);
} catch (error) {
  this.error('Failed to update capabilities:', error);
}
```

## Useful Commands

```bash
# Lint check
npm run lint

# Auto-fix lint issues
npm run lint -- --fix

# Lint specific files
npm run lint -- lib/*.js

# Check for errors in specific file
npm run lint -- lib/nrgwatch-api.js
```

## API Quick Reference

### NRGWatchApi

```javascript
const api = new NRGWatchApi();

// Setup
api.setHomeyObject(this.homey);
api.setSettings(host, username, password, isAuth, enableVR, vrIndex);

// Get data
const status = await api.getStatus();
const speed = await api.getCurrentSpeed();

// Control
await api.setFanMode('high');
await api.setFanSpeed(75);
await api.setRFFanMode('auto');
```

### WebClient

```javascript
const client = new WebClient();

// Setup
client._serverHost = '192.168.1.100';
client._isAuthenticated = true;
client._userName = 'admin';
client._passWord = 'password';

// Request
const response = await client.get('api.html', { get: 'status' });

// Test connection
const result = await client.testConnection('192.168.1.100');
if (result === 401) {
  // Authentication required
}
```

## Debugging Tips

### Enable Verbose Logging
```javascript
this.homey.log('Status:', JSON.stringify(status, null, 2));
```

### Check Capability Exists
```javascript
if (this.hasCapability('measure_temperature')) {
  await this.setCapabilityValue('measure_temperature', temp);
}
```

### Test API Calls
```javascript
try {
  const status = await this.api.getStatus();
  this.log('Status:', status);
} catch (error) {
  this.error('API call failed:', error.message);
}
```

## File Modification Workflow

1. **Read** the relevant documentation (ARCHITECTURE.md, API.md)
2. **Plan** your changes
3. **Implement** following patterns above
4. **Document** with JSDoc
5. **Test** manually
6. **Lint** and fix issues
7. **Commit** with clear message

## Resources

- **User Guide:** README.md
- **Architecture:** ARCHITECTURE.md  
- **API Reference:** API.md
- **Changelog:** CHANGELOG.md
- **This Guide:** QUICK_REFERENCE.md

## Getting Help

1. Check the documentation files
2. Look at similar code in the project
3. Check the JSDoc comments
4. Review the ARCHITECTURE.md for patterns

---

**Quick Tip:** Use your IDE's JSDoc intellisense - hover over methods to see documentation!


