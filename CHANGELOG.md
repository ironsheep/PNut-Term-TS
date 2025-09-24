# Changelog

All notable changes to PNut-Term-TS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-09-22

### Added
- Initial release of PNut-Term-TS cross-platform debug terminal
- Support for Parallax Propeller 2 debugging protocol
- P2 download implementation with RAM and FLASH support
- Serial communication with DTR/RTS control line support
- Debug windows implemented:
  - Terminal window with full ANSI escape sequence support
  - Logic analyzer window for digital signal analysis
  - Oscilloscope window for analog signal visualization
  - XY scope display window for phase relationships
  - Plot window for data graphing and visualization
- Cross-platform packaging for Windows (x64, arm64), Linux (x64, arm64), and macOS (x64, arm64)
- Command-line launcher `pnut-term-ts` for all platforms
- Electron v33.3.1 runtime bundled in all packages

### Fixed
- Flash loader padding offset calculation
- Duplicate variable declaration errors during download operations
- P2 download protocol checksum validation

### Known Issues
- Not all debug windows are fully implemented yet
- macOS packages require manual signing before distribution
- Windows packages use tar.gz format instead of native .zip

## [Unreleased]

### Planned
- Complete implementation of remaining debug windows:
  - COG state display window
  - Debugger interface window
  - FFT spectrum analysis window
  - Logic analyzer window
  - MIDI interface window
  - Plot data window
  - Oscilloscope window
  - XY scope display window
- Native DMG creation for macOS with code signing
- MSI installer for Windows
- DEB/RPM packages for Linux distributions
- Auto-update functionality