# Changelog

All notable changes to PNut-Term-TS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
