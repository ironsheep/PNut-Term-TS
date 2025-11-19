# Changelog

All notable changes to PNut-Term-TS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.4] - 2025-11-19

### Added

- PropPlug device management system with persistent per-device settings
- PropPlug Management tab in Preferences dialog for viewing/editing known devices
- Per-device DTR/RTS control line settings (automatically determined by device type)
- Project-level PropPlug selection in Preferences
- Automatic discovery and tracking of new PropPlug devices
- Friendly name support for PropPlug devices

### Changed

- Exit with error if `-p` specifies a device that is not found (previously would silently proceed to UI)
- Control line (DTR/RTS) now determined per-device instead of global setting
- Device selection now matches by serial number in addition to path

## [0.9.3] - 2025-11-17

### Added

- Add `-m, --match-vendor-only` option to match any FTDI device (VID 0x0403), ignoring product ID

## [0.9.2] - 2025-11-14

### Changes

- Improve main window layout when --IDE mode (used by VSCode)
- Use Local time within debug and USB log files, not UTC
- Disable Chromium sandbox to prevent Linux runtime error requiring root permissions
- Fixed macOS signing so that .dmg's can now be notarised

## [0.9.1] - 2025-11-09

- Packaging cleanup

## [0.9.0] - 2025-11-08

### Added

- Initial release of PNut-Term-TS cross-platform debug terminal
- Support for Parallax Propeller 2 debugging protocol
- P2 download implementation with RAM and FLASH support
- Serial communication with DTR/RTS control line support
- 9 Debug windows implemented:
  - Terminal window with full ANSI escape sequence support
  - Logic analyzer window for digital signal analysis
  - Oscilloscope window for analog signal visualization
  - XY scope display window for phase relationships
  - Plot window for data graphing and visualization
  - FFT spectrum analyzer window for frequency analysis
  - Bitmap display window for image visualization
  - MIDI interface window for musical data
  - Logger window for message capture and analysis
- Cross-platform packaging for Windows (x64, arm64), Linux (x64, arm64), and macOS (x64, arm64)
- Command-line launcher `pnut-term-ts` for all platforms
- Electron v33.3.1 runtime bundled in all packages

### Known Issues

- Single Step debugger is not yet ready for use

## [Unreleased]

### Planned

- Complete implementation of remaining debug windows:
  - Single Step debugger
