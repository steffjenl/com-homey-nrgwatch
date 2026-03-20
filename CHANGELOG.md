# Changelog

> 📋 **The full engineering changelog is maintained at [`./specs/CHANGELOG.md`](./specs/CHANGELOG.md).**
> This file contains the user-facing summary for the Homey App Store.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-09

### Added
- Initial release of NRGWatch for Homey
- Support for Itho CVE WiFi devices
- Support for Itho WTW WiFi devices
- Auto-discovery of devices via mDNS
- Manual device pairing via IP address
- Authentication support for secured devices
- Virtual remote functionality for CVE devices
- RF remote support for WTW devices
- Comprehensive device monitoring:
  - Temperature measurement
  - Humidity measurement
  - CO2 level monitoring
  - Fan speed monitoring
  - Operating hours tracking
  - Startup counter
- Multiple fan modes:
  - Away/Low/Medium/High
  - Auto/Auto Night
  - Timer modes (1, 2, 3)
  - Cooking modes (30/60 minutes)
  - Motion detection modes
  - Join/Leave modes
- Configurable refresh intervals
- Flow card support for automation
- Multi-language support (EN, NL, DE, FR, IT, SV, NO, ES, DA, RU, PL, KO)

### Changed
- Refactored codebase to follow clean code principles
- Improved error handling across all modules
- Enhanced JSDoc documentation for all classes and methods
- Standardized code style with ESLint
- Optimized network communication
- Improved capability management

### Documentation
- Added comprehensive README.md
- Added ARCHITECTURE.md with detailed architecture documentation
- Added API.md with complete API reference
- Added inline JSDoc comments throughout codebase
- Added TypeScript configuration for better IDE support

### Technical
- Modern async/await patterns throughout
- Proper error handling with descriptive messages
- Constants for HTTP status codes and timeouts
- Validated input parameters
- Clean separation of concerns
- Modular architecture with clear responsibilities

## [Unreleased]

### Planned Features
- Enhanced WebSocket support for real-time updates
- Advanced scheduling capabilities
- Multi-device zone coordination
- Filter replacement reminders
- Maintenance scheduling
- Performance analytics dashboard
- Cloud integration (optional)
- Firmware update notifications

---

## Version History

### Pre-release Versions

Prior to version 1.0.0, the application was in active development. The 1.0.0 release represents the first stable, production-ready version with comprehensive refactoring and documentation.

---

For more information about releases, please visit the [GitHub Releases](https://github.com/your-repo/releases) page.

