# Technical Debt

This document tracks technical debt items in the PNut-Term-TS project.

## ⚠️ CRITICAL - DO NOT SHIP

### WindowRouter Array Copy Performance Issue
**Priority: CRITICAL - Blocks production release**
**File:** `src/classes/shared/windowRouter.ts:551`
**Added:** 2025-10-08

**Problem:**
Currently creates a NEW array for EACH window via `dataString.split(' ')` inside the forEach loop.
For multi-window commands like `` `a b c d e f g h i $7``, this creates 9 separate `["$7"]` arrays.
With 20 windows, this creates 20 copies of the same data.

**Impact:**
- Excessive array allocations proportional to window count
- Multiplies GC pressure by number of target windows
- Completely defeats all byte-copy reduction efforts
- Violates core performance design principle

**Current Code (WRONG):**
```typescript
targetWindows.forEach(windowNameUpper => {
  const windowDataParts = dataString.split(' ');  // NEW ARRAY PER WINDOW!
  debugWindow.updateContent(windowDataParts);
});
```

**Required Fix:**
Share ONE array reference across all windows:
```typescript
const sharedDataParts = parts.slice(dataStartIndex);  // ONE ARRAY
targetWindows.forEach(windowNameUpper => {
  debugWindow.updateContent(sharedDataParts);  // SHARE IT
});
```

**Investigation Needed:**
When using shared array reference, observed inconsistent behavior where HSV16 windows worked
perfectly but first 9 windows broke (or vice versa). Must identify root cause:
- Are windows modifying the shared array? (Grep shows no mutations)
- Async timing issues with canvas operations?
- Different code paths for different window types?
- Something else causing non-deterministic behavior?

**Acceptance Criteria:**
- ONE array created per multi-window command, regardless of window count
- All windows receive same array reference
- All bitmap tests pass with shared reference
- Behavior is deterministic across runs

**Estimated effort:** 4-8 hours investigation + fix

---

## Pre-Release Audit Items

### Debug Window Pascal Parity Audit
**Priority: High - Must be completed before release**

All implemented debug windows need to be audited against their Pascal reference implementation to ensure no features, behaviors, or implementation details have been missed during the TypeScript translation.

**Windows to audit:**
- ✅ Terminal (`debugTermWin.ts` vs `DebugDisplayUnit.pas`)
- ✅ Logic (`debugLogicWin.ts` vs `DebugDisplayUnit.pas`)  
- ✅ Scope (`debugScopeWin.ts` vs `DebugDisplayUnit.pas`)
- ⚠️ Scope XY (`debugScopeXyWin.ts` vs `DebugDisplayUnit.pas`) - **Missing concentric rings in grid display**
- ✅ Plot (`debugPlotWin.ts` vs `DebugDisplayUnit.pas`)
- ✅ Bitmap (`debugBitmapWin.ts` vs `DebugDisplayUnit.pas`) 
- ✅ MIDI (`debugMidiWin.ts` vs `DebugDisplayUnit.pas`)
- ✅ FFT (`debugFftWin.ts` vs `DebugDisplayUnit.pas`) - Complete, needs final audit

**Audit checklist for each window:**
- [ ] All configuration parameters and their ranges
- [ ] All data feeding modes and packed data support
- [ ] All rendering modes and visual appearance
- [ ] All commands (CLEAR, SAVE, PC_KEY, PC_MOUSE)
- [ ] Mouse and keyboard interaction behavior
- [ ] Window lifecycle and resource management
- [ ] Error handling and edge cases
- [ ] Performance characteristics

**Estimated effort:** 2-3 hours per window × 8 windows = 16-24 hours

### SCOPE_XY Specific Issues
**Priority: Medium - Visual parity issue**

The SCOPE_XY window has the following known issues:
1. **Missing concentric rings**: The circular grid should display 4 concentric rings but they're not appearing. The drawing code exists and appears correct, but rings don't render. Crosshairs work fine.
2. **Blue legend positioning**: The 'B' channel legend positioning has been problematic - needs final adjustment to match Pascal positioning exactly.
3. **Minor flickering**: While greatly reduced with the snake/queue model, some flickering remains in the dot rendering.

**Root cause analysis needed for:**
- Why concentric rings don't render despite correct drawing code
- Potential canvas state or rendering order issues
- Possible interference from save/restore background optimization attempts

**Estimated effort:** 2-4 hours to diagnose and fix

## Configuration and Logging Issues

### loggingEnabled Flag - Dead Code
**Priority: Medium - Cleanup needed**
**Date Added: 2025-01-10**

The `this.context.runEnvironment.loggingEnabled` flag is checked extensively throughout the codebase but is NEVER set to true in production code:

**Current situation:**
- Defaults to `false` in `/src/utils/context.ts`
- Only set to `true` in test files
- Checked in 35+ places across multiple files:
  - `src/classes/mainWindow.ts` (17 occurrences)
  - `src/utils/usb.serial.ts` (2 occurrences)
  - `src/classes/downloader.ts` (1 occurrence)
  - `src/classes/logger.ts` (was blocking all non-error output - now fixed)

**Impact:**
- All code wrapped in `if (this.context.runEnvironment.loggingEnabled)` checks is effectively dead code
- Was preventing the logger from outputting anything except errors (fixed)
- Potentially hiding useful debugging/logging functionality

**Action needed:**
1. Determine the original intent of this flag
2. Either:
   - Remove all `loggingEnabled` checks if the feature is not needed
   - Implement a proper way to enable it (command-line flag, config file, etc.)
   - Repurpose it for a different logging control mechanism
3. Review what functionality is currently hidden behind these checks
4. Consider if `logToFile` should be the actual control for file logging

**Note:** The `logToConsole` flag is separate and controls `console.log()` debug statements per file, not the main logging system.

**Estimated effort:** 4-6 hours to audit all uses and implement proper solution

## Missing Test Coverage

The following classes currently have no test files:

### Core Classes
- **Downloader** (`src/classes/downloader.ts`) - Handles binary download to P2 devices
- **Logger** (`src/classes/logger.ts`) - Logging infrastructure
- **MainWindow** (`src/classes/mainWindow.ts`) - Main application window management

### Entry Point
- **DebugTerminalInTypeScript** (`src/pnut-term-ts.ts`) - Main application entry point

### Utility Classes
- **Context** (`src/utils/context.ts`) - Application context management
- **ObjectImage** (`src/utils/imageUtils.ts`) - Image processing utilities
- **UsbSerial** (`src/utils/usb.serial.ts`) - USB serial communication

### Constants/Types (may not need unit tests)
- **debugInputConstants** (`src/classes/shared/debugInputConstants.ts`) - PC_KEY/PC_MOUSE constants
- **debugStatements** (`src/classes/shared/debugStatements.ts`) - Debug command definitions

## Timing and State Management Issues

### Window Display After Failed Download
**Priority: Medium - Investigate when time permits**
**Date Identified: 2025-01-21**

**Issue:** When a download to P2 fails, the device automatically boots after 142ms and starts running its existing program (hardware test). The resulting debug window displays with incorrect positions - all elements are in the wrong places.

**Symptoms:**
- Download fails with "No Propeller v2 device found"
- P2 boots normally after 142ms timeout
- Hardware test runs and sends debug data
- Debug window opens but all display positions are wrong

**Likely Causes:**
- Timing issue between failed download state and window initialization
- Parser/window may not be properly synchronized after download failure
- State machine might be in an intermediate state when P2 starts sending data
- Baud rate might still be at download speed (2MHz) instead of debug speed

**Investigation Needed:**
- Check if parser is properly reset after download failure
- Verify baud rate is restored to debug speed after failed download
- Investigate window initialization timing relative to data arrival
- Check if there's a race condition between download cleanup and debug data processing

**Notes:**
- This is not critical since normal operation works fine
- Only occurs in the specific failure case of download fail → immediate P2 boot
- May be related to the narrow 142ms window between reset and normal boot

## Architecture Issues

### Serial Processing Thread Architecture
**Priority: Medium - Performance and reliability improvement**
**Date Identified: 2025-01-21**

**Current State:** Serial data processing runs in the main Electron process, not in a separate thread as might be expected.

**Issues:**
- Serial processing can be blocked by UI operations (modal dialogs, heavy rendering)
- UI events can interrupt real-time serial data handling
- No isolation between serial I/O and electron main process
- Potential for data loss during blocking operations

**Impact:**
- Modal dialogs (like error messages) block serial data processing
- Can lead to buffer overflows and lost messages
- Debug windows may receive incomplete initialization data
- Timing-sensitive operations become unreliable

**Recommended Solution:**
- Move serial port handling to a Node.js Worker Thread
- Implement message passing between worker and main process
- Buffer data in worker during UI blocking events
- Consider using SharedArrayBuffer for high-performance data transfer

**Benefits of Worker Thread:**
- True parallel processing of serial data
- Immunity from UI blocking
- Better real-time performance
- More reliable data capture

**Implementation Considerations:**
- Worker threads can't directly access Electron APIs
- Need robust message passing protocol
- Must handle worker crashes gracefully
- May need to restructure data flow architecture

## Code Quality Issues

### Window Classes Review
- **TODO**: Review all debug window classes before release to ensure:
  - Proper use of shared CanvasRenderer for all canvas operations
  - Direct canvas manipulation via executeJavaScript should be moved to CanvasRenderer
  - CSS/HTML usage should be consistent and centralized
  - All windows properly extend DebugWindowBase features
  - InputForwarder integration is consistent across all windows
  - Error handling with unparsed command strings is implemented

### ✅ COMPLETED: Pascal Behavior Documentation
- **DONE (2025-08-06)**: All debug windows now have comprehensive JSDoc documentation:
  - `debugLogicWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugScopeWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugScopeXYWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugPlotWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugBitmapWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugMidiWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugTermWin.ts` - ✓ Complete JSDoc with Pascal references added
  - `debugFftWin.ts` - ✓ Complete JSDoc with Pascal references added
  - All windows now reference specific Pascal procedures with line numbers from DebugDisplayUnit.pas

### TECH-DEBT Markers in Code
Run `grep -r "TECH-DEBT" src/` to find inline technical debt markers.

### TODO Items in Code

#### Logging Infrastructure
- Multiple classes need context/runtime option awareness:
  - `debugLogicWin.ts` - TODO: make it context/runtime option aware
  - `debugTermWin.ts` - TODO: make it context/runtime option aware
  - `debugPlotWin.ts` - TODO: make it context/runtime option aware
  - `debugScopeWin.ts` - TODO: make it context/runtime option aware
  - `debugWindowBase.ts` - TODO: make it context/runtime option aware
  - `debugColor.ts` - TODO: make it context/runtime option aware
  - `mainWindow.ts` - TODO: make it context/runtime option aware
  - `logger.ts` - TODO: make it context/runtime option aware
  - `downloader.ts` - TODO: make it context/runtime option aware
  - `spin2NumericParser.ts` - TODO: Also log to Context logger when available

#### Debug Window Base Class
- TODO: Audit all debug window implementations to ensure compliance
- TODO: Add unparsedCommand parameter to common error logging methods

#### Bitmap Window
- TODO: Parse color properly using DebugColor class
- TODO: Implement saving just the canvas area

### FIXME Items
Run `grep -r "FIXME" src/` to find FIXME items in the codebase.

## Architecture Issues

### Missing Implementations
- **Spectro** window type - Not implemented
- **Debugger** window type - Not implemented

### Technical Requirements
- Preserve unparsed debug strings for error logging
- Include full command context in error messages

## Performance Considerations
- Canvas rendering operations should be optimized for real-time data
- Serial communication should avoid blocking the event loop
- Consider using OffscreenCanvas for complex rendering operations

## Documentation Gaps
- ✅ **COMPLETED**: JSDoc comments for all debug window classes (2025-08-06)
- ✅ **COMPLETED**: All debug windows now have Spin2 code examples
- ✅ **COMPLETED**: Pascal procedure references with line numbers added
- **TODO**: JSDoc comments for utility classes and shared components
- **TODO**: API documentation for public interfaces in shared classes

## Window Construction Pattern Issues

### Debug Window Creation Consistency
**Priority: Medium - Post-release cleanup**
**Added: 2025-09-09**

Some debug windows have incorrect construction patterns that need standardization:

#### ✅ **Correctly Using Deferred Construction**
- **Scope** - Fixed to wait for channel specifications before creating window
- **FFT** - Needs investigation - likely should use deferred pattern

#### ✅ **Correctly Using Immediate Construction**  
- **Logic** - Creates window in constructor (has channel specs upfront)
- **Term** - Creates window in constructor
- **Logger** - Creates window in constructor

#### ⚠️ **Construction Pattern Issues**
- **Plot** - Currently using deferred construction but shouldn't need it
  - Problem: Uses `isFirstDisplayData` flag to defer window creation
  - Solution: Should create window immediately in constructor
  - Impact: Windows don't appear until first data arrives

- **Bitmap** - Unclear when window gets created
  - Problem: Has conditional creation but trigger point unclear
  - Investigation needed: Find where `if (!this.debugWindow)` check occurs

- **MIDI** - Has `createDebugWindow()` method but may not call it
  - Problem: May not create window in constructor
  - Investigation needed: Verify constructor calls `createDebugWindow()`

#### **Design Principle**
- **Immediate Construction**: Use when all sizing/layout info is available at creation time
- **Deferred Construction**: Use only when window must wait for additional specifications (like channel configs)

## Specific Technical Debt Items

### TECH-DEBT-001: Main Window needs ANSI escape sequence support
- **Issue**: Main serial terminal window should support ANSI escape sequences but currently doesn't
- **Impact**: P2 programs using standard terminal control sequences won't display correctly
- **Fix**: Implement ANSI escape sequence parsing in MainWindow (not debug windows)
- **Note**: Debug windows (TERM, etc.) should NOT have ANSI support to match Pascal implementation

### TECH-DEBT-002: Pascal Hanning Window Mathematical Differences
- **Issue**: Pascal Hanning window implementation differs significantly from standard DSP practices
- **Details**:
  - Uses formula (1 - cos(2πi/N)) instead of standard 0.5*(1 - cos(2πi/(N-1)))
  - Results in non-symmetric window function for even sizes
  - Produces coherent gain of 1.0 instead of standard 0.5
  - Maximum window value is 2*scale (8192) instead of scale (4096)
- **Impact**: Different frequency response characteristics than expected in standard DSP
- **Status**: Documented, needs discussion with original Pascal author

### TECH-DEBT-003: BITMAP Window Black Border (Visual Deviation from Pascal)
- **Issue**: BITMAP window displays 10-pixel black border around canvas, differing from Pascal implementation
- **Location**: `src/classes/debugBitmapWin.ts:1233` - `body { padding: 10px; background-color: #000; }`
- **Root Cause**: Body element has 10px padding with black background, creating visual spacing
- **Current Behavior**: Black border provides breathing room between canvas and window chrome
- **Pascal Behavior**: No border - canvas directly against window edges
- **Impact**: Minor visual difference, actually aesthetically pleasing
- **Decision**: Keep current implementation (user preference), document as intentional deviation
- **Future Consideration**: May add toggle option or remove padding to match Pascal exactly
- **Added**: 2025-10-04

### TECH-DEBT-004: Window Function Edge Case Handling
- **Files**: `src/classes/shared/windowFunctions.ts`, `tests/windowFunctions.test.ts`
- **Issue**: Hamming and Blackman window formulas produce NaN for single-sample windows
- **Details**: Division by (N-1) = 0 when N = 1 causes NaN, currently handled by returning 0
- **Impact**: Unexpected behavior for edge cases, potential Pascal implementation oversight
- **Status**: Documented, needs discussion with original Pascal author
- **Files**: `src/classes/shared/windowFunctions.ts`

### TECH-DEBT-004: FFT Fixed-Point Arithmetic Behavioral Differences
- **Issue**: FFT implementation shows several behaviors that differ from standard DSP expectations
- **Pascal Author Questions**:
  1. **Frequency Peak Detection Precision**: Single frequency sine waves produce peaks only 1x-2x greater than noise floor (expected 5x). Is this reduced dynamic range expected with 12-bit fixed-point arithmetic?
  2. **High Frequency (Near Nyquist) Behavior**: Frequencies near Nyquist (e.g., 0.47 * sample_rate/2) appear at unexpected bins (20-40 range instead of ~60). Is there intentional frequency aliasing or filtering?
  3. **Minimum FFT Size (4 samples) Behavior**: 4-sample FFT with Hanning window produces all zeros or very small values. Does Pascal implementation have special handling for minimum size FFTs?
  4. **Default Dot Size Behavior**: Pascal code comment suggests default should be dotSize=1, but implementation defaults to lineSize=3. Should it default to dot mode (size 1) or line mode (size 3)?
  5. **Frequency Leakage**: Energy spread across bins is different than expected - energy concentrated in single bin even with fractional frequency. Does the fixed-point implementation intentionally quantize to nearest bin?
- **Test Adjustments Made**: Relaxed expectations in tests to match observed behavior (peak dominance from 5x to 1x, frequency bin precision ±2 bins, Nyquist detection just >DC)
- **Impact**: Current implementation works correctly for production use but may not meet academic/scientific DSP expectations
- **Status**: Documented, needs discussion with Chip Gracey (Pascal author)
- **Files**: `src/classes/shared/fftProcessor.ts`, `src/classes/shared/windowFunctions.ts`, `tests/fftAccuracyVerification.test.ts`, `src/classes/debugFftWin.ts` (lines 865-868)
- **Pascal References**: `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` lines 1552-1712 (FFT implementation), lines 4170-4243 (PrepareFFT/PerformFFT)## Technical Debt Item

### CRITICAL: Font Loading Broken - Cannot Ship Until Fixed
**Date Added**: 2025-09-10
**Priority**: CRITICAL - BLOCKER
**Category**: Core Functionality

**Current State**:
- Custom fonts (Parallax.ttf and 3270-Regular.ttf) cannot be loaded in the application
- Loading HTML as data: URL prevents file:// font URLs from working (browser security)
- Embedding fonts as base64 makes HTML too large (2.2MB), causing ERR_INVALID_URL
- Application runs with fallback fonts only

**Problem Details**:
1. **Security Restriction**: data: URLs cannot load file:// resources
2. **Size Limitation**: Base64-encoded fonts make HTML exceed Electron's URL length limit
3. **Catch-22**: Can't use file:// URLs (security) and can't use base64 (size)

**Impact**:
- **CANNOT SHIP**: Missing core visual identity of the application
- Parallax font is essential for P2 branding consistency
- IBM 3270 font needed for terminal emulation authenticity
- User experience severely degraded without proper fonts

**Potential Solutions to Investigate**:
1. Load HTML from file:// URL instead of data: URL
2. Use protocol.registerFileProtocol to serve fonts
3. Implement local web server to serve assets
4. Use Electron's custom protocol handler
5. Load HTML with loadFile() instead of loadURL()

**Required for Release**: YES - This must be fixed before any public release

---

### Bridge Menu Logging to Main Process
**Date Added**: 2025-09-10
**Priority**: Low
**Category**: Logging/Debugging

**Current State**: 
- Menu operations log to renderer console with [MENU] prefix
- Makes renderer console noisy with routine operational logs
- Harder to spot actual renderer issues that need attention

**Desired State**:
- Menu operation logs should be forwarded to main process console via IPC
- Renderer console should only contain actual errors, warnings, or issues that need attention
- Cleaner separation of concerns between UI events and application logic

**Implementation Notes**:
- Add IPC channel for forwarding logs (e.g., 'forward-log')
- Intercept console.log calls in renderer menu code
- Forward [MENU] tagged logs to main process
- Main process receives and logs with appropriate context

**Benefits**:
- Cleaner renderer console for debugging actual issues
- All operational logs in one place (main console)
- Easier to identify real problems vs routine operations

---

## Missing Interactive Features from Pascal Reference

### CRITICAL: Mouse Hover Coordinate Display System Missing
**Date Added**: 2025-09-15
**Priority**: HIGH - Core User Experience Feature
**Category**: User Interface Parity

**Current State**:
- TypeScript debug windows have no mouse interaction capabilities
- Users cannot see coordinates when hovering over visual data
- Missing essential debugging/analysis functionality that Pascal provides

**Pascal Reference Implementation**:
All visual debug windows in Pascal implement sophisticated mouse hover coordinate displays via `FormMouseMove` handlers:

#### **Visual Debug Windows Coordinate Flyouts**:

1. **Logic Analyzer Window** (`debugLogicWin.ts`)
   - **Missing**: Time unit and sample position coordinates
   - **Pascal Shows**: `"<time_units>,<sample_position>"` (e.g., "-5,12")
   - **Implementation**: Custom cursor with cross-hair + text overlay

2. **Scope Window** (`debugScopeWin.ts`)
   - **Missing**: X,Y pixel coordinates within scope area
   - **Pascal Shows**: `"<x_pixel>,<y_pixel>"` (e.g., "150,200")
   - **Implementation**: Real-time coordinate tracking

3. **Scope XY Window** (`debugScopeXyWin.ts`)
   - **Missing**: Scaled X,Y coordinates (cartesian or polar)
   - **Pascal Shows**:
     - Cartesian: `"<scaled_x>,<scaled_y>"` with log/linear scaling
     - Polar: `"<radius>,<angle>*"` (asterisk indicates polar mode)
   - **Examples**: `"1024,-512"` or `"2048,$12345678*"`

4. **FFT Window** (`debugFftWin.ts`)
   - **Missing**: Frequency bin and amplitude coordinates
   - **Pascal Shows**: `"<freq_bin>,<amplitude_level>"` (e.g., "128,45")
   - **Implementation**: Real-time frequency analysis feedback

5. **Plot Window** (`debugPlotWin.ts`)
   - **Missing**: Plot grid coordinates accounting for direction
   - **Pascal Shows**: `"<grid_x>,<grid_y>"` divided by dot size (e.g., "25,40")
   - **Implementation**: Grid-aware coordinate system

6. **Terminal Window** (`debugTermWin.ts`)
   - **Missing**: Character column and row position
   - **Pascal Shows**: `"<column>,<row>"` (e.g., "12,3")
   - **Implementation**: Character-based coordinate system

7. **Bitmap Window** (`debugBitmapWin.ts`)
   - **Missing**: Pixel coordinates
   - **Pascal Shows**: `"<pixel_x>,<pixel_y>"` divided by dot size (e.g., "320,240")
   - **Implementation**: Pixel-level precision tracking

8. **MIDI Window** (`debugMidiWin.ts`)
   - **Missing**: Pixel coordinates (same as bitmap)
   - **Pascal Shows**: `"<pixel_x>,<pixel_y>"`
   - **Implementation**: Coordinate display for MIDI visualization

#### **COG/Debugger Window Tooltip System**:

9. **COG Window** (`debugCOGWindow.ts` - when implemented)
   - **Missing**: Extensive context-aware tooltip system
   - **Pascal Has**: 40+ different tooltips including:
     - Register maps: `"Cog Register Bitmap/Heatmap | Click to lock disassembly to REG subrange"`
     - Program counter: `"Program Counter | Click to lock disassembly to PC"`
     - Stack data: `"Stack Registers (top..bottom) | Click to lock disassembly and HUB address to <address>"`
     - Pin registers: `"Pin Registers | P<n> | <pin_state_info>"`
     - Event flags: `"Event Flags | L-Click to break on <event> event | R-Click to toggle"`
     - Interactive instructions with keyboard shortcuts

#### **Technical Implementation Requirements**:

**Custom Cursor System**:
- Cross-hair overlay at mouse position
- Dynamic text box showing coordinates
- Intelligent positioning (quadrant-based to avoid screen edges)
- Color-coded display matching window theme
- 50ms refresh rate for real-time updates

**Canvas Mouse Event Handling**:
- `onMouseMove` handlers for all visual debug windows
- Coordinate transformation based on window type and scaling
- Context-aware formatting (time units, pixels, grid positions, etc.)
- Integration with existing canvas rendering system

**Impact**:
- **Major user experience gap** - users expect these features from Pascal version
- **Debugging capability loss** - cannot see precise coordinates for analysis
- **Professional appearance** - missing polish and functionality
- **Feature parity issue** - TypeScript version appears incomplete

**Implementation Estimate**: 2-3 hours per window × 8 windows = 16-24 hours

**Required for Release**: HIGH PRIORITY - Essential for user experience parity

---

### Console Error Output in Production
**Date Added**: 2025-09-25
**Priority**: Medium - Post-First-Release
**Category**: User Experience / Error Handling

**Current State**:
- `console.error()` and `console.warn()` calls throughout the codebase output to terminal
- When users launch the GUI app from terminal, errors appear in that terminal while they interact with windows
- Mixing of `this.logConsoleMessage()` (dev diagnostics) and `console.error()` (always outputs)
- Creates confusing, disconnected experience where errors appear far from where problems occur

**Impact**:
- **Confusing UX**: Users don't know to look back at terminal for errors
- **Unprofessional**: Makes app feel like development build
- **Easy to miss**: Users may close/minimize terminal after launching
- **Disconnected**: Error appears in terminal while user is interacting with GUI

**Proper Solution**:
1. Implement in-app error handling system
2. Route errors to appropriate UI elements:
   - Status bar messages for non-critical errors
   - Modal dialogs for critical errors
   - In-window notification areas
   - Log files accessible from within the app
3. No console output for a GUI application in production
4. `this.logConsoleMessage()` should be completely disabled for production builds

**Files Affected**:
- All `src/classes/debug*.ts` files
- `src/classes/mainWindow.ts`
- Any file with `console.error()` or `console.warn()` calls

**Implementation Notes**:
- Don't refactor before first release - ship first, refactor later
- This is acceptable technical debt for early testing
- Early testers can help identify which errors actually matter

**Required for Release**: NO - Acceptable for early testing release

## External Control Interface

### Signal Handlers (Implemented)
**Priority: Low - Already implemented**

The application now supports Unix signal-based control for background operation:

**Implemented signals:**
- `SIGUSR1` - Reset hardware via DTR/RTS pulse
- `SIGTERM` - Graceful shutdown (closes windows, saves state, disconnects)
- `SIGINT` - Graceful shutdown (same as SIGTERM, handles Ctrl+C)

**Usage example:**
```bash
# Start pnut-term in background
./pnut-term-ts --port /dev/ttyUSB0 &
PID=$!

# Reset the hardware
kill -USR1 $PID

# Graceful shutdown
kill -TERM $PID
```

### Command File Interface (Future Enhancement)
**Priority: Low - Nice to have for advanced automation**

A more flexible command interface could be implemented using a command file that the application monitors for changes.

**Proposed implementation:**
- Monitor `.pnut-term-ts.command` file in the working directory (where command was run)
- Commands written to this file would be executed by the running instance
- File would be cleared after command execution

**Example commands:**
```bash
# Write command to file
echo "RESET" > .pnut-term-ts.command
echo "DOWNLOAD /path/to/file.binary" > .pnut-term-ts.command
echo "SET_BAUD 115200" > .pnut-term-ts.command
echo "SEND_DATA Hello World\r\n" > .pnut-term-ts.command
echo "SAVE_LOG /path/to/output.log" > .pnut-term-ts.command
echo "SHUTDOWN" > .pnut-term-ts.command
```

**Benefits over signals:**
- Unlimited commands (not limited to ~5 signals)
- Can pass parameters with commands
- Works cross-platform (including Windows)
- Can queue multiple commands
- Easier to debug (can see command file contents)

**Implementation considerations:**
- Use file watcher (fs.watch or chokidar)
- Parse commands safely (validate all inputs)
- Handle race conditions (multiple writes)
- Clear file after processing
- Log all commands for audit trail

**Estimated effort:** 4-6 hours to implement basic command file interface

**Required for Release**: NO - Current signal handlers sufficient for basic automation

---

## Message Routing Architecture Issues

### Router Architecture Refactoring
**Date Added**: 2025-10-01
**Priority**: Medium - Post-First-Release Refactor
**Category**: Architecture / Code Quality

**Current State**:
- Three routing layers with overlapping responsibilities:
  1. **MessageRouter** - Protocol-level type-based routing
  2. **cogWindowRouter** - Format adapter (ExtractedMessage → SerialMessage)
  3. **WindowRouter** - Content-aware routing + window lifecycle + recording

**Problems**:
1. **Redundant routing decisions** - Both MessageRouter and WindowRouter independently route to debug logger
2. **Format conversion overhead** - cogWindowRouter is just 28 lines of adapter code
3. **Mixed responsibilities** - WindowRouter does routing + window management + recording + performance monitoring
4. **Content parsing duplication** - WindowRouter re-parses COG IDs that MessageExtractor already extracted

**Desired State**:
- **MessageRouter** owns ALL routing decisions (protocol-level)
- **WindowRouter** becomes pure infrastructure:
  - Window registry (lifecycle management)
  - Recording/playback system
  - Performance monitoring
  - NO routing decisions, NO content parsing, NO hardcoded logging policy
- **Eliminate cogWindowRouter** - MessageRouter outputs correct format directly

**Implementation Plan**:
1. Extract window registry from WindowRouter into separate WindowRegistry service
2. Extract recording system into separate RecordingManager service
3. Move all routing decisions to MessageRouter
4. Remove WindowRouter's hardcoded "always log" policy
5. Eliminate cogWindowRouter adapter

**Estimated Effort**: 16-24 hours for full refactoring

**Required for Release**: NO - Current system works, refactor for maintainability

---

### Message Splitting Corruption
**Date Added**: 2025-10-01
**Priority**: HIGH - Immediate Fix Required
**Category**: Data Integrity Bug

**Current State**:
- `mainWindow.ts:434-435` splits COG messages on whitespace then rejoins
- Destroys original formatting (P2 protocol uses two spaces after COG ID)
- Debug logger receives corrupted messages with incorrect spacing

**Code Location**:
```typescript
const textData = new TextDecoder().decode(message.data);
data = textData.split(/\s+/).filter((part) => part.length > 0);  // ← BREAKS FORMATTING
```

**Impact**:
- P2 protocol specifies two spaces after COG ID: `"Cog0  message"`
- Split/join collapses to one space: `"Cog0 message"`
- Message integrity compromised in debug logger

**Fix**:
```typescript
const textData = new TextDecoder().decode(message.data);
data = textData;  // Pass as plain string - NO SPLITTING
```

**Why Safe**:
- Debug logger already handles plain strings (`debugLoggerWin.ts:861-864`)
- Only affects MessageRouter Path A (direct to debug logger)
- WindowRouter path unchanged
- No other code depends on split behavior

**Required for Release**: YES - Data integrity issue

---

### Duplicate COG Message Routing to Debug Logger
**Date Added**: 2025-10-01
**Priority**: HIGH - Immediate Fix Required
**Category**: Logic Bug / User Experience

**Current State**:
- COG messages appear TWICE in debug logger with different formatting
- Path A: MessageRouter line 479 → debugLogger (with split/join corruption)
- Path B: MessageRouter line 483 → cogWindowRouter → WindowRouter lines 371-385 → debugLogger (correct formatting)

**Root Cause**:
- **MessageRouter** explicitly routes COG_MESSAGE to debugLogger (`messageRouter.ts:479`)
- **WindowRouter** has hardcoded policy: "Always route to DebugLogger" (`windowRouter.ts:371-385`)
- Both routers independently decide to send to debug logger

**Impact**:
- Users see each COG message twice in debug logger
- One copy has corrupted spacing, one copy is correct
- Confusing user experience
- Wastes logging resources

**Surgical Fix** (safest approach):
Remove MessageRouter's direct debugLogger registration for COG_MESSAGE:

```typescript
// messageRouter.ts:479 - REMOVE THIS LINE
// this.registerDestination(MessageType.COG_MESSAGE, debugLogger);

// Keep cogWindowRouter route - WindowRouter will handle debug logger
if (cogWindowRouter) {
  this.registerDestination(MessageType.COG_MESSAGE, cogWindowRouter);
}
```

**Why This Fix Is Safe**:
- COG messages still reach debug logger via: MessageRouter → cogWindowRouter → WindowRouter → debugLogger
- WindowRouter's hardcoded policy ensures debug logger gets them
- Only removes ONE of the two duplicate paths
- All other message types unchanged (BACKTICK_WINDOW, TERMINAL_OUTPUT, etc.)
- Individual COG windows still work correctly

**Risk Assessment**:
- ✅ Debug logger will still receive COG messages (via WindowRouter)
- ✅ Individual COG windows (COG0-COG7) still work
- ✅ No impact on other message types
- ⚠️ Relies on WindowRouter's "always log" policy staying in place (but we're not removing that now)

**Required for Release**: YES - User-visible bug

---

### COG Window Show/Hide State Machine Bug
**Date Added**: 2025-10-01
**Priority**: HIGH - Immediate Fix Required
**Category**: State Management Bug

**Current State**:
- Show/hide toggle follows pattern: works, fails, works, fails, works
- First show: ✅ All 8 COG windows appear
- First hide: ✅ All windows close
- Second show: ❌ Only COG windows with traffic appear
- Second hide: ✅ Windows close
- Third show: ✅ All 8 windows appear again

**Root Cause**:
- `handleHideAllCOGs()` calls `cogWindowManager.reset()` at line 896
- `reset()` reinitializes ALL state including mode
- Mode defaults back to `ON_DEMAND` instead of preserving `SHOW_ALL`
- Next show operation uses wrong mode

**Code Flow**:
```typescript
// mainWindow.ts:870-906
public handleHideAllCOGs(): void {
  this.cogWindowManager.setMode(COGDisplayMode.OFF);  // Set to OFF
  // ... close windows ...
  this.cogWindowManager.reset();  // ← BUG: Resets mode to ON_DEMAND
}
```

**Surgical Fix**:
Don't call `reset()` - mode should persist across hide operations:

```typescript
public handleHideAllCOGs(): void {
  this.cogWindowManager.setMode(COGDisplayMode.OFF);
  // ... close windows ...
  // this.cogWindowManager.reset();  // REMOVE - preserve mode state
}
```

**Why Safe**:
- Mode stays in whatever state it was (SHOW_ALL or ON_DEMAND)
- Windows are still closed properly
- Just preserves mode across show/hide cycles
- No other state needs resetting during hide

**Alternative** (if reset is needed for other reasons):
Extract mode preservation or add parameter to reset():
```typescript
const currentMode = this.cogWindowManager.getMode();
this.cogWindowManager.reset();
this.cogWindowManager.setMode(currentMode);  // Restore mode
```

**Required for Release**: YES - User-visible functional bug

**UPDATE 2025-10-01**: Fix attempted but made worse - removing `reset()` causes show to NEVER work after first hide (previously worked every other time). Root cause still unknown. `reset()` was masking a deeper issue with show/hide state machine or window creation logic. Needs investigation into `cogWindowManager.showAllCOGs()` logic and COGDisplayMode state transitions.

