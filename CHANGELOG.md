# Changelog

All notable changes to PNut-Term-TS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.13] - 2026-02-12

### Fixed

- **Worker extractor PST misclassification** - Terminal text containing PST control codes (0x00-0x07) was misclassified as debugger packets by the extraction worker
  - `classifyMessage()` in the worker thread now validates bytes 1-3 are 0x00 (32-bit little-endian COG ID) before classifying as debugger, matching the existing `find416ByteBoundary()` validation
  - NUL bytes (0x00) in PST terminal text no longer produce spurious "Cog 0:" hex dump entries in the debug logger
  - PST POS command (0x02) and other control codes no longer produce spurious "Cog 2:" entries
- **False message boundary splits on NUL bytes** - `looksLikeMessageStart()` treated NUL (0x00) as a valid message start, causing PST terminal text to fragment at CR+NUL sequences
  - NUL removed from message-start detection; 416-byte debugger packets are found by `find416ByteBoundary()` with proper 4-byte validation instead
- **Duplicate debugger log entries** - 416-byte debugger packets were registered to two routing destinations, both calling `routeBinaryMessage()` which already routes to all logger windows
  - DEBUGGER0-7 messages now registered to a single destination, eliminating 2x delivery to the debug logger
- **COG window PST misclassification** - Legacy `isASCIIData()` in COG logger rejected PST control codes (0x00-0x10), causing hex dump display for PST-containing data
  - Now uses 3-tier classification matching the main logger, with proper PST parameter byte skipping
- **Stale idle timeout causing message fragmentation** - The extraction worker's idle timeout tracker only updated when the buffer transitioned from empty to non-empty, so unterminated data (e.g., a prompt with no CR/LF) kept the timestamp stale for seconds
  - Now tracks the buffer's write position via `getTailPosition()` to detect new data arriving even when old data remains in the buffer
- **Multi-line text output swallowed by overly strict boundary validation** - `looksLikeMessageStart()` only recognized protocol-specific bytes (backtick, 'C', 0xDB, PST 0x01-0x10) as valid starts after CR/LF, causing all text lines starting with spaces or regular ASCII (e.g., `help` command output) to be merged into a single giant message
  - Added `looksLikeTextLineStart()` relaxed validator that also accepts printable ASCII (0x20-0x7E)
  - Non-backtick messages use the relaxed check; backtick messages retain strict validation to protect SPRITEDEF bitmap data with embedded CR/LF

## [0.9.11] - 2025-02-10

### Fixed

- **NUL byte tolerance** - NUL bytes (0x00) in P2 serial data no longer trigger binary misclassification
  - Logger classifier treats NUL as non-binary (flagged as PST-class, silently discarded in display)
  - Blue terminal PST parser silently discards NUL bytes, matching real terminal behavior
  - Real terminals (VT100, PST) ignore NUL — now PNut-Term-TS does the same
- **Carriage return (CR) behavior** - CR (0x0D) now only returns cursor to column 0 without advancing the row
  - Previously CR acted as CR+LF, causing double line advance when paired with LF
- **macOS notarization** - Enabled Apple notarization and stapling in release workflow
  - Removed nested `node_modules/electron` from app bundle (dev dependency, not needed at runtime)
  - Fixed post-signing icon copy that was invalidating code signatures

## [0.9.9] - 2025-02-09

### Added

- **Blue terminal PST character grid** - Replaced append-only DOM rendering with a proper cursor-addressed character grid model (80x25 default)
  - PST control codes (Home, Position, Clear Screen, cursor movement, etc.) now work correctly
  - Text is written at the cursor position, not appended to the bottom
  - Grid auto-scrolls when cursor moves past the last row
  - Backspace is now non-destructive (moves cursor only, matches PST specification)
- **Dynamic terminal grid sizing** - Grid automatically resizes when the window is resized
  - Measures actual font metrics via canvas after window load
  - Recalculates rows and columns based on available space (debounced 200ms)
  - Preserves existing grid content during resize

### Fixed

- **Logger ASCII/binary misclassification** - Messages containing PST control codes with parameter bytes (e.g., Position x,y) were incorrectly classified as binary and displayed as hex dumps
  - New three-tier classifier: pure ASCII, ASCII with PST codes, or true binary
  - PST parameter bytes (0x02: 2 params, 0x0E/0x0F: 1 param each) are properly skipped during classification
  - Added missing Bell (0x07) to PST control code formatter
- Removed dead code: non-existent `terminal-cursor` DOM element references, unused `dataset.cursorX/Y` attributes

## [0.9.8] - 2025-02-03

### Fixed

- GitHub Actions release workflow - resolve tag immutability issue blocking v0.9.6
- macOS build - remove pip upgrade that fails on Homebrew-managed Python

## [0.9.6] - 2025-01-10

### Added

- **Headless mode** (`--headless`) for AI agents and CI/CD automation
  - Run without GUI windows, output to log files only
  - `--timeout <seconds>` - Auto-exit after specified duration
  - `--end-marker [phrase]` - Auto-exit when phrase detected in serial output
    - Default recognizes both `END_SESSION` and `DEBUG_END_SESSION` (PNut compatibility)
    - Custom phrases supported: `--end-marker "MY_PHRASE"`
  - Enables Claude Code, Cursor, and other AI agents to do hardware-in-the-loop testing
  - Three termination modes: signal (Ctrl+C), timeout, or end-marker detection

### Fixed

- macOS code signing in GitHub Actions release workflow
  - Proper inside-out signing order for Electron frameworks
  - Added USB/serial device entitlements for hardware access
  - Fixed DMG volume icon and app icon paths
- Suppress PropPlug "not found" warning when showing help or when auto-detect succeeds

## [0.9.5] - 2025-11-20

### Added

- Baud rate status indicator in main window status bar (both IDE and Standard modes)

### Fixed

- Case-insensitive device serial number matching for `-p/--plug` option
- Device selection now accepts serial numbers in any case (e.g., `p6yh4spg`, `P6yh4spg`, `P6YH4SPG`)

## [0.9.4] - 2025-11-19

### Added

- PropPlug device management system with persistent per-device settings
- PropPlug Management tab in Preferences dialog for viewing/editing known devices
- Per-device DTR/RTS control line settings (automatically determined by device type with manual override)
- Project-level PropPlug selection in Preferences
- Automatic discovery and tracking of new PropPlug devices
- Friendly name support for PropPlug devices

### Changed

- Exit with error if `-p` specifies a device that is not found (previously would silently proceed to UI)
- Control line (DTR/RTS) now determined per-device instead of global setting
- Device selection now matches by serial number in addition to path

### Known Issues

- The **Windows arm64 build** is having issues. It is not opening the serial port. This, so far, appears to be an [npm serialport](https://www.npmjs.com/package/serialport) issue. We filed a bug report to get clarification and/or a fix.

- **SPECIAL REQUEST**: If you have a **native arm64 Windows machine** please test this build and let me know if it works. I'm running Windows 11 Pro under Parallels on a macOS (Apple Silicon) machine and this problem may be limited to my context!

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

## [Unreleased]

### Planned

- Additional debug window improvements
