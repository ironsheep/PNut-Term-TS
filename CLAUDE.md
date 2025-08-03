# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference - Pascal Source Location

**IMPORTANT**: The Pascal reference source is located at `/pascal-source/` in the root filesystem, NOT in the workspace.

**Key Pascal Files**:
- `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` - Core debug display implementation
- `/pascal-source/P2_PNut_Public/DebugUnit.pas` - Window management
- `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` - Debugger functionality

**Documentation PDFs**:
- `/pascal-source/P2_PNut_Public/P2 Spin2 Documentation v51-250425.pdf` - Complete Spin2 reference
- `/pascal-source/P2_PNut_Public/MouseComamnds.pdf` - PC_KEY and PC_MOUSE specifications
- `/pascal-source/P2_PNut_Public/debugStatements.pdf` - Debug display command reference

## Project Overview

PNut-Term-TS is a cross-platform debug terminal for Parallax Propeller2 microcontrollers, built as an Electron application with TypeScript. It recreates Chip's Debug listener with multiplatform support, combining PST (Propeller Serial Terminal) functionality with downloader capabilities and comprehensive debug display support.

This is part of the P2 Multi-platform Development Environment:
1. VSCode Spin2 Extension (editing P1/P2 code)
2. PNut-TS compiler (multiplatform PNut compiler in TypeScript)
3. PNut-Term-TS (this tool) - terminal replacement with download and debug support

## Development Commands

### Build Commands
- `npm run build` - Full build: TypeScript compilation → esbuild bundling → build date insertion → minification
- `npm run buildnew` - Alternative build without build date insertion
- `tsc` - TypeScript compilation only (outputs to `./dist`)

### Development Tools
- `npm run clean` - Remove build artifacts (`./dist`, `./release`, `./prebuilds`, `./fonts`)
- `npm run minify` - Minify the built JavaScript using Terser
- Main executable after build: `dist/pnut-term-ts.min.js`

### Platform Packaging
- `npm run packageLnx` - Linux package build
- `npm run packageMac` - macOS package build  
- `npm run packageWin` - Windows package build

### Testing & Running
- `npm run help` - Build and show help output
- `npm run start` - Run the built application
- `node dist/pnut-term-ts.min.js` - Direct execution

### Testing Commands
- `npm test` - Run Jest test suite
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate test coverage reports
- `npm run test:verbose` - Run tests with verbose output

## Architecture Overview

### Core Application Structure
The application follows a class-based architecture with clear separation of concerns:

**Entry Point**: `src/pnut-term-ts.ts`
- Main CLI interface using Commander.js
- Handles command-line argument parsing and application initialization
- Creates and manages the main application context

**Window Management**: Electron-based GUI system
- `MainWindow` - Primary application window and controller
- Multiple specialized debug windows extending `DebugWindowBase`:
  - `DebugTermWindow` - Terminal debug interface
  - `DebugScopeWindow` - Oscilloscope-like display
  - `DebugPlotWindow` - Data plotting interface
  - `DebugLogicWindow` - Logic analyzer display

**Shared Classes** (in `src/classes/shared/`):
- `CanvasRenderer` - HTML5 Canvas rendering operations
- `DisplaySpecParser` - Parse display specifications from debug commands
- `PackedDataProcessor` - Handle 13 different packed data modes
- `TriggerProcessor` - Trigger condition evaluation for scope/logic displays
- `debugInputConstants` - PC_KEY and PC_MOUSE constants and interfaces from MouseCommands.PDF
- `debugStatements` - Complete debug display types, configurations, and commands from debugStatements.pdf

**Hardware Communication**: 
- `UsbSerial` - USB serial communication with Propeller2 devices
- `Downloader` - Handles file downloads to P2 RAM/FLASH memory

**Utilities**:
- `Context` - Shared application state and runtime environment
- `Logger` - Centralized logging functionality
- File, image, HTML, and timer utilities

### Debug Display System
The application implements multiple debug display types with varying completion status:
- **Terminal** (complete) - Basic text terminal interface
- **Logic** (complete) - Logic analyzer display with full trigger support
- **Scope** (complete) - Oscilloscope display with full trigger support  
- **Plot** (in-progress) - Data plotting interface
- **Scope_XY, FFT, Spectro, Bitmap, MIDI, Debugger** - Not yet implemented

### Key Design Patterns
- **Base Class Inheritance**: All debug windows extend `DebugWindowBase`
- **Context Pattern**: Shared `Context` object provides runtime configuration
- **Event-Driven**: Uses Node.js EventEmitter for inter-component communication
- **Factory Pattern**: Window creation and management through main controller

## TypeScript Configuration

- **Target**: ES2020 with CommonJS modules
- **Source**: `./src` → **Output**: `./dist`
- **Strict mode**: Enabled with full type checking
- **Source Maps**: Generated for debugging

## Development Environment

The project uses Docker for consistent development environments. Key development setup:
- **Linting**: ESLint with Prettier formatting
- **Build Tools**: TypeScript, esbuild, Terser for minification
- **Electron Builder**: Cross-platform packaging for Windows, macOS, Linux

## File Download & Serial Communication

The application's core functionality revolves around:
1. **File Watching**: Automatic re-download on file changes
2. **PropPlug Selection**: Command-line or GUI selection of USB serial devices  
3. **Dual Mode Operation**: Downloads files, then switches to PST terminal behavior
4. **Logging**: Comprehensive traffic logging with automatic timestamped filenames

## Important Implementation Details

- **Device Selection**: Can auto-select "only" PropPlug if none specified
- **USB Port Management**: Enable/disable functionality to release ports for other tools
- **Memory Operations**: Supports both RAM and FLASH programming of P2 devices
- **Cross-Platform**: Full support for Windows, macOS, and Linux including ARM64

## CI/CD and GitHub Actions

The project uses GitHub Actions for automated builds:
- **macOS workflow** (`.github/workflows/build-macos.yml`): Automated signing and notarization
- **Windows workflow** (`.github/workflows/build-win.yml`): Windows packaging
- Targets Node.js 23 for modern JavaScript features
- Automated artifact uploads for distribution

## Reference Documentation

### Primary Documentation Files

The complete Spin2 language specification, which includes detailed debug display documentation and examples, is available at:
- **Absolute Path**: `/pascal-source/P2_PNut_Public/P2 Spin2 Documentation v51-250425.pdf`
- **Note**: The pascal-source directory is located at the root of the filesystem (`/pascal-source/`), not within the workspace
- **Purpose**: This PDF contains the official Spin2 language reference including:
  - Complete DEBUG statement specifications
  - Debug display command formats and parameters
  - Implementation details for all debug window types
  - Example code for each debug display mode
  - Color modes, packed data formats, and trigger specifications
- **Version**: v51 (dated 2025-04-25)
- **Usage**: Essential reference when implementing TypeScript debug windows from Pascal source

### Additional Debug Documentation

**PC_KEY and PC_MOUSE Commands**:
- **Absolute Path**: `/pascal-source/P2_PNut_Public/MouseComamnds.pdf` (note the typo in filename)
- **TypeScript Implementation**: `src/classes/shared/debugInputConstants.ts`
- **Contents**: Keyboard and mouse input handling for debug displays
  - PC_KEY command for capturing keyboard input
  - PC_MOUSE command for 7-long mouse status structure

**Debug Statements Reference**:
- **Absolute Path**: `/pascal-source/P2_PNut_Public/debugStatements.pdf`
- **TypeScript Implementation**: `src/classes/shared/debugStatements.ts`
- **Contents**: Comprehensive debug display documentation
  - All 9 debug display types and their configurations
  - Instantiation and feeding command syntax
  - Color modes, packed data modes, and examples

**Debug Testing Files**:
- **Location**: `/pascal-source/P2_PNut_Public/DEBUG-TESTING/`
- **Contents**: Test programs and binaries for debug windows
  - `DEBUG_BITMAP_*.spin2/.bin` - Bitmap window test programs
  - `DEBUG_Mouse_and_Keyboard.*` - Input testing programs
  - `DEBUG_PLOT_*.spin2/.bin` - Plot window test programs
  - Various `.bmp` files for testing bitmap loading
  - Compiled binaries can be downloaded to P2 for testing

## Pascal to TypeScript Debug Window Translation Guide

This section documents the translation from Chip Gracey's Pascal reference implementation to TypeScript classes.

### Pascal Reference Analysis

The Pascal source files in `/pascal-source/P2_PNut_Public/` contain the original debug display implementations:

**Important Note**: The pascal-source directory is located at the root filesystem (`/pascal-source/`), NOT within the workspace directory.

**Key Files:**
- `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` - Core debug display implementation (50k+ lines)
- `DebugUnit.pas` - Main debug form and window management
- `DebuggerUnit.pas` - Debugger breakpoint functionality

### Debug Window Types and Constants

Based on Pascal source analysis, the debug system supports 9 display types:

```pascal
// Pascal Display Type Constants (from DebugDisplayUnit.pas:22-30)
dis_logic     = 0;    // Logic analyzer display
dis_scope     = 1;    // Oscilloscope display  
dis_scope_xy  = 2;    // XY Scope display
dis_fft       = 3;    // FFT frequency analysis
dis_spectro   = 4;    // Spectrogram display
dis_plot      = 5;    // Data plotting display
dis_term      = 6;    // Terminal text display
dis_bitmap    = 7;    // Bitmap graphics display
dis_midi      = 8;    // MIDI visualization display
```

**TypeScript Translation Status:**

| Pascal Type | TypeScript Class | Status | File Location |
|-------------|------------------|---------|---------------|
| `dis_logic` | `DebugLogicWindow` | Complete | `src/classes/debugLogicWin.ts` |
| `dis_scope` | `DebugScopeWindow` | Complete | `src/classes/debugScopeWin.ts` |
| `dis_scope_xy` | Not Implemented | Missing | - |
| `dis_fft` | Not Implemented | Missing | - |
| `dis_spectro` | Not Implemented | Missing | - |
| `dis_plot` | `DebugPlotWindow` | In Progress | `src/classes/debugPlotWin.ts` |
| `dis_term` | `DebugTermWindow` | Complete | `src/classes/debugTermWin.ts` |
| `dis_bitmap` | Not Implemented | Missing | - |
| `dis_midi` | Not Implemented | Missing | - |

### Debug Window Implementation Tracking

**IMPORTANT**: This section tracks the implementation progress of all debug windows, including line counts from both Pascal source and TypeScript implementations.

**Complete Implementation Status Table:**

| Window Type | Pascal Type | Pascal Source | Pascal Lines | TypeScript Class | TS Status | TS Lines | Notes |
|-------------|-------------|---------------|--------------|------------------|-----------|----------|-------|
| **Logic** | `dis_logic` | DebugDisplayUnit.pas | ~3,500 | `DebugLogicWindow` | ✅ Complete | 1,240 | Full trigger support |
| **Scope** | `dis_scope` | DebugDisplayUnit.pas | ~4,200 | `DebugScopeWindow` | ✅ Complete | 1,612 | Auto/manual triggers |
| **Scope XY** | `dis_scope_xy` | DebugDisplayUnit.pas | ~2,800 | Not Implemented | ❌ Missing | 0 | XY plotting mode |
| **FFT** | `dis_fft` | DebugDisplayUnit.pas | ~3,100 | Not Implemented | ❌ Missing | 0 | Frequency analysis |
| **Spectrogram** | `dis_spectro` | DebugDisplayUnit.pas | ~2,900 | Not Implemented | ❌ Missing | 0 | Time-frequency display |
| **Plot** | `dis_plot` | DebugDisplayUnit.pas | ~4,500 | `DebugPlotWindow` | ⚠️ In Progress | 1,106 | Missing sprites |
| **Terminal** | `dis_term` | DebugDisplayUnit.pas | ~2,100 | `DebugTermWindow` | ✅ Complete | 686 | Full ANSI support |
| **Bitmap** | `dis_bitmap` | DebugDisplayUnit.pas | ~3,700 | `DebugBitmapWindow` | ✅ Complete | 962 | Full implementation |
| **MIDI** | `dis_midi` | DebugDisplayUnit.pas | ~2,200 | Not Implemented | ❌ Missing | 0 | MIDI visualization |
| **Debugger** | N/A | DebuggerUnit.pas | ~8,500 | Not Implemented | ❌ Missing | 0 | Breakpoint debugging |

**Summary Statistics:**
- **Total Pascal Lines**: ~37,500 (DebugDisplayUnit.pas: ~29,000 + DebuggerUnit.pas: ~8,500)
- **Total TypeScript Lines**: 5,606 (across implemented windows)
- **Implementation Progress**: 5/10 windows complete (50%)
- **Missing Implementations**: 5 windows (~29,156 Pascal lines to translate)

**Pascal Source Notes:**
- Line counts are estimates based on typical Pascal implementations
- DebugDisplayUnit.pas contains 9 display types (~50k lines total)
- DebuggerUnit.pas contains the interactive debugger (~8.5k lines)
- DebugUnit.pas contains window management code

### Pascal Color System Translation

**Color Constants** (Pascal lines 179-196):
- 10 basic colors: black, white, orange, blue, green, cyan, red, magenta, yellow, gray
- 19 color modes: LUT1-8, LUMA8/16, HSV8/16, RGBI8, RGB8/16/24
- 13 packed data modes: various bit-packing schemes for longs/words/bytes

**TypeScript Implementation:**
- Color handling in `src/classes/debugColor.ts`
- Base color validation in `DebugWindowBase.getValidRgb24()`
- Packed data modes defined in `DebugWindowBase` enums `ePackedDataMode`

### Key Pascal Methods for Translation

**Pascal `TDebugDisplayForm` Methods** (primary translation targets):

1. **Window Management:**
   - `FormCreate()` → TypeScript constructor
   - `FormClose()` → `closeDebugWindow()`
   - `FormResize()` → window resize handlers

2. **Data Processing:**
   - `UpdateDisplay()` → `updateContent()`
   - `ParseKeyword()` → command parsing logic
   - `ProcessValue()` → data value processing

3. **Rendering Methods:**
   - `PaintCanvas()` → HTML5 Canvas rendering
   - `DrawGrid()` → grid overlay drawing
   - `PlotData()` → data visualization

4. **Configuration:**
   - `SetTitle()`, `SetSize()`, `SetPosition()` → window setup
   - `SetColors()` → color scheme application
   - `SetTrigger()` → trigger condition setup

### Translation Strategy

**For Each New Window Type:**

1. **Create TypeScript Class:**
   ```typescript
   export class Debug[Type]Window extends DebugWindowBase {
     constructor(ctx: Context) { super(ctx); }
     
     // Implement required abstract methods
     closeDebugWindow(): void { /* cleanup */ }
     updateContent(lineParts: string[]): void { /* process data */ }
   }
   ```

2. **Implement Core Methods:**
   - Parse display-specific commands and parameters
   - Handle data unpacking using `possiblyUnpackData()`
   - Manage HTML5 Canvas rendering
   - Support save-to-BMP functionality via `saveWindowToBMPFilename()`

3. **Add to Factory Pattern:**
   - Register in main window management system
   - Add to display type enumeration
   - Wire up debug string parsing

### Translation Priorities

**Next Implementation Targets:**
1. **DebugScopeXYWindow** - XY plotting for scope data
2. **DebugFFTWindow** - Frequency domain analysis
3. **DebugSpectroWindow** - Spectrogram visualization  
4. **DebugBitmapWindow** - Graphics display with LUT support
5. **DebugMIDIWindow** - MIDI data visualization

**Common Implementation Patterns:**
- All windows extend `DebugWindowBase`
- Use HTML5 Canvas for rendering via Electron
- Support real-time data streaming
- Implement trigger conditions and holdoff
- Provide save-to-file capabilities
- Follow Pascal parameter parsing conventions

## Testing Infrastructure

**Jest Configuration**:
- Test files pattern: `*.test.ts` and `*.spec.ts`
- 30-second timeout for complex integration tests
- Coverage thresholds can be configured in `jest.config.js`

**Running Specific Tests**:
- Single test file: `npm test -- src/classes/debugColor.test.ts`
- Pattern matching: `npm test -- --testNamePattern="color parsing"`
- Debug mode: `node --inspect-brk node_modules/.bin/jest --runInBand`

**Key Test Areas**:
- Unit tests for color system, packed data processing, trigger evaluation
- Integration tests for window creation and inter-component communication
- Performance benchmarks for real-time data processing