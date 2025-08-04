# Technical Debt

This document tracks technical debt items in the PNut-Term-TS project.

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

## Code Quality Issues

### Window Classes Review
- **TODO**: Review all debug window classes before release to ensure:
  - Proper use of shared CanvasRenderer for all canvas operations
  - Direct canvas manipulation via executeJavaScript should be moved to CanvasRenderer
  - CSS/HTML usage should be consistent and centralized
  - All windows properly extend DebugWindowBase features
  - InputForwarder integration is consistent across all windows
  - Error handling with unparsed command strings is implemented

### Missing Pascal Behavior Documentation
- **TODO**: Add comprehensive Pascal behavior documentation comments before class declarations:
  - `debugLogicWin.ts` - Missing detailed Pascal implementation notes
  - `debugScopeWin.ts` - Missing detailed Pascal implementation notes
  - `debugPlotWin.ts` - Missing detailed Pascal implementation notes
  - `debugBitmapWin.ts` - Has some but needs expansion on Pascal differences
  - `debugMidiWin.ts` - Has good documentation, verify completeness
  - `debugTermWin.ts` - ✓ Complete (just added)
  - Note: Document any TypeScript enhancements beyond Pascal (like ANSI in Term)

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

## Known Issues from Test Suite

### Failing Tests
- **debugTermWin.test.ts** - Compilation errors due to constructor parameter changes
- **debugScopeWin.test.ts** - InputForwarder mock issues causing test failures
- **debugPlotWin.commands.test.ts** - Parameter validation issues (8 failing tests)
- **integrationTests.test.ts** - Color expectation mismatches (3 failing tests)

### Test Infrastructure Issues
- InputForwarder mocks are brittle and cause crashes in some test suites
- Jest doesn't exit cleanly for some tests (async operations not properly cleaned up)

## Architecture Issues

### Missing Implementations
- **Scope_XY** window type - Not implemented
- **FFT** window type - Not implemented  
- **Spectro** window type - Not implemented
- **Debugger** window type - Not implemented

### Technical Requirements
- Preserve unparsed debug strings for error logging
- Include full command context in error messages

## Performance Considerations
- Test suite takes ~90 seconds to run all tests sequentially
- Some tests have memory leaks or unclosed handles

## Documentation Gaps
- Missing JSDoc comments for many public methods
- No API documentation for public interfaces
- Limited examples for debug window implementations