# Implementation Status

## Debug Window Implementation Progress (10/11 complete - 91%)

| Window | TypeScript Class | Status | Notes |
|--------|------------------|--------|-------|
| Main* | `MainWindow` | ✅ Complete | Full toolbar, native menu, recording controls, status bar |
| Debug Logger** | Not Implemented | ❌ Missing | Auto-opens on first "Debug" message, lime green on black terminal, high-speed logging to timestamped files |
| Terminal | `DebugTermWindow` | ✅ Complete | ~70% test coverage, no ANSI |
| Logic | `DebugLogicWindow` | ✅ Complete | Full trigger support |
| Scope | `DebugScopeWindow` | ✅ Complete | Auto/manual triggers |
| Scope XY | `DebugScopeXYWindow` | ✅ Complete | XY plotting with persistence |
| Plot | `DebugPlotWindow` | ✅ Complete | Double buffering, layers, sprites |
| Bitmap | `DebugBitmapWindow` | ✅ Complete | All trace patterns |
| MIDI | `DebugMidiWindow` | ✅ Complete | Piano keyboard display |
| FFT | `DebugFFTWindow` | ✅ Complete | Cooley-Tukey FFT, line/bar/dot modes, 82.6% test coverage |
| Spectro | Not Implemented | ❌ Missing | Time-frequency display |
| Debugger | `DebugDebuggerWindow` | ✅ Complete | Full P2 debugger with 123x77 grid, dual protocol support, multi-COG, heat maps, Pascal parity verified |

*Main Window is a custom creation for this app, not from Pascal source
**Debug Logger window should automatically open when first "Debug" prefixed message is received from P2

## Missing Feature: Debug Logger Window

### Expected Behavior
- **Auto-opens**: Creates window automatically when first "Debug" prefixed message arrives from P2
- **Visual Style**: Lime green text on black background (high contrast for debugging)
- **High-speed Logging**: Writes all Debug messages to timestamped log files
- **Log File Management**:
  - New log file created on each download (binary name becomes log name root)
  - New log file created on each DTR reset (when running from flash)
  - Timestamps added to filenames to prevent overwrites
- **Purpose**: Captures all debug output at high velocity without losing data
- **Separate from TERM**: This is distinct from `DEBUG TERM` windows which are explicitly created

## Debugger Window Components

### Core Infrastructure
- `src/classes/shared/windowRouter.ts` - Centralized message routing for all windows
- `src/classes/shared/recordingCatalog.ts` - Recording session management

### Debugger-Specific Components
- `src/classes/shared/debuggerProtocol.ts` - Bidirectional P2 serial communication (100% test coverage)
- `src/classes/shared/debuggerDataManager.ts` - COG state and memory caching (100% test coverage)
- `src/classes/shared/debuggerRenderer.ts` - 123x77 grid UI rendering with heat maps (90%+ test coverage)
- `src/classes/shared/debuggerConstants.ts` - P2 debugger constants and message formats
- `src/classes/shared/disassembler.ts` - P2 instruction decoder with SKIP pattern support (100% test coverage)
- `src/classes/shared/debuggerInteraction.ts` - Mouse/keyboard handling with Pascal shortcuts (100% test coverage)
- `src/classes/shared/multiCogManager.ts` - Multi-COG window coordination and breakpoint sync
- `src/classes/shared/advancedDebuggerFeatures.ts` - Heat maps, smart pins, HUB viewer
- `src/classes/debugDebuggerWin.ts` - Main debugger window implementation (80%+ test coverage)

### Key Features
- **Dual Protocol Support**: Binary debugger protocol + text DEBUG commands
- **Multi-COG Debugging**: Support for all 8 P2 COGs simultaneously
- **Memory Caching**: Checksum-based change detection for efficient updates
- **Heat Map Visualization**: Memory access patterns with decay
- **Performance Optimized**: <1ms routing, dirty rectangle rendering
- **Recording/Playback**: JSON Lines format for regression testing

## Key Shared Components

### Data Processing
- `src/classes/shared/spin2NumericParser.ts` - All Spin2 numeric formats
- `src/classes/shared/packedDataProcessor.ts` - 12 packed data modes with ALT/SIGNED modifiers
- `src/classes/shared/debugInputConstants.ts` - PC_KEY/PC_MOUSE definitions
- `src/classes/shared/tracePatternProcessor.ts` - Bitmap trace patterns

### Rendering Support
- `src/classes/shared/canvasRenderer.ts` - HTML5 Canvas operations
- `src/classes/shared/layerManager.ts` - Bitmap layer management
- `src/classes/shared/spriteManager.ts` - Sprite transformations

### Input Support
All debug windows support PC_KEY and PC_MOUSE commands for input forwarding to P2 devices:
- **Base Integration**: `InputForwarder` class in `DebugWindowBase`
- **Mouse Features**: Coordinate transformation, wheel debouncing, visual feedback
- **Window-Specific**: Each window type implements custom coordinate systems
- **Logic/Scope Windows**: Show coordinate tooltips and crosshairs (Pascal parity)