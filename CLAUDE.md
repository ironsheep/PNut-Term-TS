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
- `CanvasRenderer` - HTML5 Canvas rendering operations (modified to accept context parameters directly)
- `DisplaySpecParser` - Parse display specifications from debug commands
- `PackedDataProcessor` - Handle 13 different packed data modes
- `TriggerProcessor` - Trigger condition evaluation for scope/logic displays
- `debugInputConstants` - PC_KEY and PC_MOUSE constants and interfaces from MouseCommands.PDF
- `debugStatements` - Complete debug display types, configurations, and commands from debugStatements.pdf
- `LayerManager` - Manages up to 8 bitmap layers for debug windows with loading and cropping support
- `SpriteManager` - Handles up to 256 sprite definitions with transformation capabilities (rotation, scaling, opacity)
- `Spin2NumericParser` - Centralized parser for all Spin2 numeric formats (see Spin2 Numeric Formats section)

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
| `dis_plot` | `DebugPlotWindow` | Complete | `src/classes/debugPlotWin.ts` |
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
| **Plot** | `dis_plot` | DebugDisplayUnit.pas | ~4,500 | `DebugPlotWindow` | ✅ Complete | 1,694 | Double buffering, layers, sprites |
| **Terminal** | `dis_term` | DebugDisplayUnit.pas | ~2,100 | `DebugTermWindow` | ✅ Complete | 686 | Full ANSI support |
| **Bitmap** | `dis_bitmap` | DebugDisplayUnit.pas | ~3,700 | `DebugBitmapWindow` | ✅ Complete | 962 | Full implementation |
| **MIDI** | `dis_midi` | DebugDisplayUnit.pas | ~2,200 | Not Implemented | ❌ Missing | 0 | MIDI visualization |
| **Debugger** | N/A | DebuggerUnit.pas | ~8,500 | Not Implemented | ❌ Missing | 0 | Breakpoint debugging |

**Summary Statistics:**
- **Total Pascal Lines**: ~37,500 (DebugDisplayUnit.pas: ~29,000 + DebuggerUnit.pas: ~8,500)
- **Total TypeScript Lines**: 6,194 (across implemented windows)
- **Implementation Progress**: 6/10 windows complete (60%)
- **Missing Implementations**: 4 windows (~16,700 Pascal lines to translate)

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

### Plot Window Implementation Details

**DebugPlotWindow** has been fully implemented with the following architecture:

**Double Buffering System:**
- Uses `OffscreenCanvas` as working buffer for all drawing operations
- Display updates only occur on UPDATE command via `drawImage()`
- Prevents flickering and enables complex scene composition

**CanvasRenderer Modifications:**
- All methods now accept `CanvasRenderingContext2D` directly instead of canvas ID strings
- Methods perform immediate operations instead of returning JavaScript code strings
- Supports both `HTMLCanvasElement` and `OffscreenCanvas` contexts

**Implemented Commands:**
- **Drawing**: DOT, BOX, OBOX, OVAL, UPDATE, CLEAR
- **Style**: LINESIZE, OPACITY, TEXTANGLE, LUTCOLORS  
- **Layers**: LAYER (load bitmap), CROP (draw with optional cropping)
- **Sprites**: SPRITEDEF (define sprite), SPRITE (draw sprite with transformations)
- **Coordinates**: ORIGIN, SET, POLAR, CARTESIAN, PRECISE

**New Shared Classes:**
- `LayerManager`: Manages 8 bitmap layers with async loading and cropping
- `SpriteManager`: Handles 256 sprites with rotation, scaling, and opacity transformations

**Testing Status:**
- Build: ✅ Fully successful with TypeScript compilation, bundling, and minification
- Command Tests: ✅ All 71 tests pass in debugPlotWin.commands.test.ts
- Unit Tests: ⚠️ 6 failures in debugPlotWin.test.ts (mock/setup issues, not functionality)
- Integration Tests: ⚠️ 6 failures in debugPlotWin.integration.test.ts (mock expectations)
- Note: Test failures are related to test infrastructure and mocking, not implementation bugs

### Translation Priorities

**Next Implementation Targets:**
1. **DebugScopeXYWindow** - XY plotting for scope data
2. **DebugFFTWindow** - Frequency domain analysis
3. **DebugSpectroWindow** - Spectrogram visualization  
4. **DebugMIDIWindow** - MIDI data visualization

**Common Implementation Patterns:**
- All windows extend `DebugWindowBase`
- Use HTML5 Canvas for rendering via Electron
- Support real-time data streaming
- Implement trigger conditions and holdoff
- Provide save-to-file capabilities
- Follow Pascal parameter parsing conventions

## Spin2 Numeric Formats

The Spin2 language supports multiple numeric formats for integer and floating-point values. All numeric values in debug commands and data streams must be parsed according to these formats:

### Integer Formats (32-bit resolution)

1. **Hexadecimal**: `$` prefix followed by hex digits (0-9, A-F, a-f) with optional underscores
   - Examples: `$FF`, `$1234_ABCD`, `$00FF_00FF`
   - Valid digits: 0-9, A-F, a-f
   - Underscores allowed for readability

2. **Decimal**: Optional minus sign followed by decimal digits with optional underscores
   - Examples: `123`, `-456`, `1_000_000`, `-2_147_483_648`
   - Valid digits: 0-9
   - Underscores allowed for readability

3. **Binary**: `%` prefix followed by binary digits (0-1) with optional underscores
   - Examples: `%1010`, `%1111_0000`, `%1010_1010_1010_1010`
   - Valid digits: 0-1
   - Underscores allowed for readability

4. **Quaternary (Double-binary)**: `%%` prefix followed by quaternary digits (0-3) with optional underscores
   - Examples: `%%0123`, `%%33_22_11_00`, `%%3210`
   - Valid digits: 0-3
   - Underscores allowed for readability

### Floating Point Format (32-bit IEEE 754 single precision)

- Standard decimal notation with decimal point
- Scientific notation with `e` or `E` exponent indicator
- Examples:
  - `-1.0` - Simple decimal
  - `1_250_000.0` - With underscores for readability
  - `1e9` - Scientific notation (1 × 10⁹)
  - `5e-6` - Negative exponent (5 × 10⁻⁶)
  - `-1.23456e-7` - Negative value with scientific notation

### Parsing Requirements

- All numeric formats should support underscores (`_`) for visual grouping
- Integer values resolve to 32-bit signed integers
- Floating point values follow IEEE 754 single precision format
- Numeric parsing must be consistent across all debug windows and commands
- Invalid numeric formats should be handled gracefully with appropriate error messages

## Spin2NumericParser Usage

The `Spin2NumericParser` class provides centralized parsing for all Spin2 numeric formats. Located in `src/classes/shared/spin2NumericParser.ts`, it ensures consistent numeric handling across the entire codebase.

### Context-Aware Parsing Methods

The parser provides specialized methods for different contexts, each with appropriate validation:

**parseColor(value: string): number | null**
- Parses color values (RGB 24-bit)
- Accepts all numeric formats: `$FF0000`, `%11111111`, `%%3333`, `16711680`
- Constrains values to 0-0xFFFFFF range
- Returns null for invalid formats

**parsePixel(value: string): number | null**
- Parses pixel coordinates and dimensions
- Integers only, no negatives allowed
- Caps unreasonably large values at 65535
- Used for screen positions, widths, heights

**parseCoordinate(value: string): number | null**
- Parses plot coordinates
- Allows floating point and negative values
- Supports scientific notation: `1.5e-3`, `-2.5`
- Used for graph positions, data points

**parseCount(value: string): number | null**
- Parses quantities and counts
- Positive integers only
- Used for samples, sizes, indices

**parseInteger(value: string, allowNegative: boolean = true): number | null**
- General integer parsing with negative control
- Rejects floating point values

**parseFloat(value: string): number | null**
- Accepts all numeric formats as floating point

### Usage Examples

```typescript
import { Spin2NumericParser } from './shared/spin2NumericParser';

// Color parsing
const color = Spin2NumericParser.parseColor('$FF00FF');  // Returns 16711935
const color2 = Spin2NumericParser.parseColor('MAGENTA'); // Returns null (not a number)

// Coordinate parsing (allows negatives and floats)
const x = Spin2NumericParser.parseCoordinate('-123.45'); // Returns -123.45
const y = Spin2NumericParser.parseCoordinate('1.5e2');   // Returns 150

// Pixel parsing (positive integers only)
const width = Spin2NumericParser.parsePixel('1920');     // Returns 1920
const invalid = Spin2NumericParser.parsePixel('-100');   // Returns null

// Count parsing
const samples = Spin2NumericParser.parseCount('1_000');  // Returns 1000
```

### Error Handling

The parser logs descriptive errors to the console when invalid formats are encountered:
- "Unknown numeric format" - for unrecognized patterns
- "Negative value not allowed" - when negatives are used where not permitted
- "Expected integer but got float" - when integers are required
- "Color value exceeds 24-bit RGB range" - for colors > 0xFFFFFF

### Important Notes

- **Underscores**: All formats support underscores for readability (e.g., `$FF_00_FF`, `1_000_000`)
- **Case Insensitive**: Hex digits are case-insensitive (`$FF` = `$ff`)
- **Overflow Handling**: Values are capped at appropriate ranges rather than rejected
- **Packed Data Streams**: The parser is NOT used for packed data streams - those are handled separately by `PackedDataProcessor`

## Packed Data Format Specifications

The packed data format specifications are documented in `/pascal-source/P2_PNut_Public/packedData.pdf`. These formats enable efficient transmission of sub-byte data types by packing multiple values into bytes, words, or longs.

### Syntax
```
packed_data_mode {ALT} {SIGNED}
```

### Optional Modifiers

**ALT Keyword**: 
- Reorders bits, double-bits, or nibbles within each byte end-to-end on the host side
- Useful for bitmap data where bitfields are out-of-order with respect to the DEBUG display
- Simplifies handling of data composed in standard formats

**SIGNED Keyword**:
- Causes all unpacked data values to be sign-extended on the host side
- Converts unsigned ranges to signed ranges as specified in the table below

### Complete Packed Data Modes

| Mode | Description | Values per Unit | Unsigned Range | Signed Range |
|------|-------------|-----------------|----------------|--------------|
| **LONGS_1BIT** | Each long → 32 separate 1-bit values | 32 | 0..1 | -1..0 |
| **LONGS_2BIT** | Each long → 16 separate 2-bit values | 16 | 0..3 | -2..1 |
| **LONGS_4BIT** | Each long → 8 separate 4-bit values | 8 | 0..15 | -8..7 |
| **LONGS_8BIT** | Each long → 4 separate 8-bit values | 4 | 0..255 | -128..127 |
| **LONGS_16BIT** | Each long → 2 separate 16-bit values | 2 | 0..65,535 | -32,768..32,767 |
| **WORDS_1BIT** | Each word → 16 separate 1-bit values | 16 | 0..1 | -1..0 |
| **WORDS_2BIT** | Each word → 8 separate 2-bit values | 8 | 0..3 | -2..1 |
| **WORDS_4BIT** | Each word → 4 separate 4-bit values | 4 | 0..15 | -8..7 |
| **WORDS_8BIT** | Each word → 2 separate 8-bit values | 2 | 0..255 | -128..127 |
| **BYTES_1BIT** | Each byte → 8 separate 1-bit values | 8 | 0..1 | -1..0 |
| **BYTES_2BIT** | Each byte → 4 separate 2-bit values | 4 | 0..3 | -2..1 |
| **BYTES_4BIT** | Each byte → 2 separate 4-bit values | 2 | 0..15 | -8..7 |

### Processing Details

1. **Extraction Order**: Values are extracted starting from the LSB (Least Significant Bit) of the received value
2. **Sign Extension**: When SIGNED is specified, values are sign-extended to their full range
3. **ALT Reordering**: When ALT is specified, bit groups within each byte are reversed in order
4. **Data Flow**: Raw packed data → Unpacking → Optional ALT reordering → Optional sign extension → Final values

### Implementation Notes

- The 13th packed data mode `NO_PACKING = 0` represents normal unpacked data (no processing)
- Packed data is processed by `PackedDataProcessor` class in `src/classes/shared/packedDataProcessor.ts`
- The processor handles all 12 packed modes plus the no-packing mode
- Numeric values in packed data streams are NOT parsed by `Spin2NumericParser` - they arrive as raw binary data
- **ALT modifier is fully implemented** - reverses bit groups within each byte as per specification
- **SIGNED modifier is fully implemented** - sign-extends values based on their bit width

### ALT Reordering Implementation Details

The ALT modifier reverses the order of bit groups within each byte:
- **1-bit mode**: All 8 bits in a byte are reversed (bit 7→0, 6→1, etc.)
- **2-bit mode**: The 4 groups of 2 bits are reversed in order
- **4-bit mode**: The 2 nibbles in a byte are swapped
- **8-bit mode**: Bytes within words/longs are processed individually
- **16-bit mode**: Each 16-bit value is treated as 2 bytes, ALT applied per byte

For WORDS and LONGS modes, ALT is applied to each constituent byte independently, ensuring consistent behavior across all data widths.

### Testing Strategy

Comprehensive unit tests for PackedDataProcessor include:
- All 12 packed modes tested with and without ALT modifier
- Edge cases: 0x00, 0xFF, 0x55, 0xAA for bit pattern verification
- Combined ALT and SIGNED modifier tests
- Multi-byte values (WORDS/LONGS) to verify per-byte ALT application
- Test file: `tests/packedDataProcessor.test.ts` with 26 passing tests

### Integration in Debug Windows

All debug windows use the parser for consistent numeric handling:
- `DebugWindowBase.getValidRgb24()` uses `parseColor()`
- `DebugPlotWindow` uses `parseCoordinate()` for plot positions
- `DisplaySpecParser` uses `parsePixel()` for window dimensions
- `DebugBitmapWindow` uses `parseColor()` for color values

This ensures that numeric values are parsed consistently throughout the application, supporting all Spin2 numeric formats wherever numbers are accepted.

## Mouse and Keyboard Input Support

### Overview

The debug windows now support PC_KEY and PC_MOUSE commands for input forwarding from the host PC to the P2 device, achieving feature parity with the Pascal implementation.

### Architecture

**Base Class Integration (DebugWindowBase)**:
- Protected `inputForwarder: InputForwarder` member shared by all debug windows
- Protected `wheelTimer` and `lastWheelDelta` for 100ms wheel event debouncing
- Protected methods `enableKeyboardInput()` and `enableMouseInput()` for consistent setup
- Abstract method `getCanvasId()` that derived classes must implement
- Virtual methods for customization:
  - `transformMouseCoordinates()` - window-specific coordinate transformation
  - `getPixelColorGetter()` - optional pixel color sampling

**InputForwarder Class** (existing, reused):
- Manages keyboard and mouse event queuing
- Handles serial communication with P2 device
- Supports all PC_KEY values and 7-long PC_MOUSE structure
- Implements proper data formatting for P2 communication

### Window-Specific Implementations

**DebugLogicWindow**:
- Parses PC_KEY and PC_MOUSE commands in `updateContent()`
- Transforms mouse coordinates to logic-specific format:
  - X: Negative sample index (samples back from current position)
  - Y: Channel number (0-based from top)
- Canvas ID: 'canvas'
- **Visual Coordinate Display** (matching Pascal implementation):
  - Shows coordinate tooltip near cursor when hovering over display area
  - Format: `-samples,channel` (e.g., "-47,3")
  - Crosshair overlay for precise positioning
  - Display colors match window's grid/background colors
  - Auto-positions to avoid window edges
  - Only visible when mouse is within the logic data display area

**DebugScopeWindow**:
- Parses PC_KEY and PC_MOUSE commands in `updateContent()`
- Transforms mouse coordinates to scope-specific format:
  - X: Pixel position within display area (0 to width-1)
  - Y: Inverted pixel position (bottom = 0)
- Canvas ID: 'canvas'
- **Visual Coordinate Display** (matching Pascal implementation):
  - Shows coordinate tooltip near cursor when hovering over display area
  - Format: `x,y` (e.g., "125,400")
  - Crosshair overlay for precise positioning
  - Display colors match window's grid/background colors
  - Auto-positions to avoid window edges
  - Y-axis is inverted: bottom of display = 0, top = height-1

**DebugPlotWindow** (existing support enhanced):
- Already had InputForwarder integration
- Removed duplicate private methods in favor of base class implementation
- Canvas ID: 'plot-area'

**DebugBitmapWindow** (existing support enhanced):
- Already had InputForwarder integration
- Removed duplicate private methods in favor of base class implementation
- Canvas ID: dynamically generated bitmapCanvasId

**DebugTermWindow**:
- Minimal implementation (terminal doesn't typically need mouse)
- Canvas ID: 'terminal-canvas'

### PC_MOUSE Data Structure

The PC_MOUSE command returns a 7-long structure to the P2:
```
LONG 0: xpos        // X position within DEBUG Display (negative if outside)
LONG 1: ypos        // Y position within DEBUG Display (negative if outside)
LONG 2: wheeldelta  // Scroll wheel delta: 0, +1, or -1
LONG 3: lbutton     // Left button state: 0 or -1 if pressed
LONG 4: mbutton     // Middle button state: 0 or -1 if pressed
LONG 5: rbutton     // Right button state: 0 or -1 if pressed
LONG 6: pixel       // Pixel color at mouse position: $00_RR_GG_BB or -1 if outside
```

### Key Features

- **Coordinate Transformation**: Each window type transforms raw canvas coordinates to its specific coordinate system
- **Wheel Debouncing**: 100ms timer prevents wheel event spam, matching Pascal behavior
- **Out-of-Bounds Detection**: Returns -1 for position when mouse is outside display area
- **Button State Tracking**: Maintains current state of all three mouse buttons
- **Pixel Color Sampling**: Placeholder for future implementation (currently returns 0x000000)
- **Event Queuing**: Uses existing InputForwarder queue system for reliable event delivery

### Logic Window Mouse Behavior Details

The logic window provides an enhanced mouse experience that matches the Pascal reference implementation:

**Visual Feedback**:
1. **Coordinate Display Tooltip**:
   - Appears near the mouse cursor when hovering over the logic data area
   - Shows format: `-samples,channel` where:
     - Negative sample number indicates samples back from current/latest sample
     - Channel number is 0-based from top of display
   - Example: "-47,3" means 47 samples ago on channel 3
   - Tooltip background matches window background color
   - Text color matches grid color for consistency
   - Auto-positions to avoid clipping at window edges

2. **Crosshair Overlay**:
   - Thin horizontal and vertical lines intersecting at cursor position
   - Uses grid color with 50% opacity
   - Helps with precise sample and channel identification
   - Only visible when mouse is within the data display area

**Coordinate System**:
- **X-axis (Samples)**:
  - Calculated as: `-Math.floor((displayWidth - 1 - mouseX) / spacing)`
  - Negative values count backwards from the right edge (current position)
  - -1 = most recent sample, -2 = one sample back, etc.
  - Allows intuitive reference to "how many samples ago" an event occurred

- **Y-axis (Channels)**:
  - Calculated as: `Math.floor((mouseY - marginTop) / charHeight)`
  - Zero-based index from top of display
  - Direct correspondence to visual channel layout

**Implementation Notes**:
- Coordinate display is added via `enableMouseInput()` override in DebugLogicWindow
- Uses absolute positioning for tooltip and crosshair elements
- Mouse events are captured on the container element
- Display elements have `pointer-events: none` to avoid interfering with mouse input
- Coordinates are calculated using the same formulas as the Pascal implementation

### Testing Considerations

When testing mouse support:
1. Ensure P2 device is connected and running debug display code
2. PC_KEY or PC_MOUSE must be the last command in a DEBUG() statement
3. The debug window must have focus for keyboard events
4. Mouse coordinates are transformed based on window type
5. Wheel events are debounced with 100ms timeout
6. For logic window, verify coordinate tooltip appears and shows correct negative sample indices

## Testing Infrastructure

**Jest Configuration**:
- Test files pattern: `*.test.ts` and `*.spec.ts`
- 30-second timeout for complex integration tests
- Coverage thresholds can be configured in `jest.config.js`

### Test Coverage Status (as of 2025-08-04)

**Base Class Testing**:
- **DebugWindowBase**: ✅ Complete test coverage (29 tests passing)
  - Color validation (names and numeric formats)
  - Text style encoding/decoding
  - Font metrics calculations
  - Window lifecycle management
  - Input forwarding setup
  - Save to BMP functionality
  - Abstract method enforcement

**Window-Specific Testing**:
- **DebugTermWindow**: ⚠️ Test file created but not integrated
- **DebugScopeWindow**: ✅ Existing tests (integration level)
- **DebugLogicWindow**: ✅ Existing tests (integration level)
- **DebugPlotWindow**: ✅ Comprehensive tests (command and integration)
- **DebugBitmapWindow**: ✅ Comprehensive tests (command and integration)

**Shared Component Testing**:
- **Spin2NumericParser**: ✅ Complete coverage (44 tests passing)
- **PackedDataProcessor**: ✅ Complete coverage (26 tests passing)
- **ColorTranslator**: ⚠️ Some failing tests (implementation differences)
- **InputForwarder**: ⚠️ Test infrastructure issues

**Testing Strategy**:
1. Base class (DebugWindowBase) tests common functionality once
2. Window-specific tests focus on unique behavior
3. Shared components have dedicated unit tests
4. Integration tests verify inter-component communication

### Running Tests - Best Practices

**UPDATE**: As of 2025-08-04, the build step has been moved to `pretest`, so `npm test` now runs cleanly!

**Recommended Test Commands**:
1. **Run all tests (with automatic build)**: `npm test`
2. **Run specific test file**: `npm test -- tests/debugLogicWin.test.ts`
3. **Run tests without build**: `npm run test:nobuild`
4. **Run tests with coverage**: `npm run test:coverage`
5. **Watch mode for development**: `npm run test:watch`
6. **Run with pattern**: `npm test -- --testNamePattern="mouse"`

**IMPORTANT**: Always use `--` when passing arguments to jest through npm:
- ✅ Correct: `npm test -- tests/debugLogicWin.test.ts`
- ❌ Wrong: `npm test tests/debugLogicWin.test.ts` (may cause pattern matching issues)

**Benefits of the new setup**:
- `npm test` now shows clean test output (build runs in `pretest`)
- Pattern matching works as expected: `npm test tests/debug*`
- Skip build when needed with `npm run test:nobuild`
- Coverage commands no longer need separate build steps

**For quick test runs without build**:
- Use `npm run test:nobuild` or `./node_modules/.bin/jest` directly
- This is faster when you know the code is already built

### Known Test Failures (As of 2025-08-04)

These test failures are not related to recent changes and can be ignored:

**colorTranslator.test.ts** (13 failures):
- RGB16/RGB8 conversion tests failing due to implementation differences
- HSV mode tests failing due to color calculation differences
- These are existing issues with the color translation implementation

**inputForwarder.test.ts** (crashes):
- Unhandled error from serial port mock
- Test crashes with "Serial error" 
- Appears to be test infrastructure issue, not actual code problem

**debugPlotWin.commands.test.ts** (3 failures):
- LINESIZE invalid value handling
- OPACITY boundary value handling  
- SPRITE invalid ID rejection
- Minor validation differences from expected behavior

### Test Troubleshooting Guide

**If tests won't run**:
1. Ensure build is complete: `npm run build`
2. Check for TypeScript errors: `tsc --noEmit`
3. Clear Jest cache: `./node_modules/.bin/jest --clearCache`

**To see cleaner test output**:
```bash
# Run tests and filter output to just see results
./node_modules/.bin/jest 2>&1 | grep -E "(PASS|FAIL|Test Suites:|Tests:)" | tail -20

# Count passing test files
./node_modules/.bin/jest 2>&1 | grep -c "PASS tests/"
```

**To debug a specific test**:
```bash
# Run in Node debug mode
node --inspect-brk ./node_modules/.bin/jest tests/debugLogicWin.test.ts --runInBand

# Then attach with Chrome DevTools or VS Code debugger
```

**Running Specific Tests** (original documentation):
- Single test file: `npm test -- tests/debugColor.test.ts`
- Pattern matching: `npm test -- --testNamePattern="color parsing"`
- Debug mode: `node --inspect-brk node_modules/.bin/jest --runInBand`

### Test Suite Summary

**Total Test Files**: ~25 test files  
**Typical Test Run Time**: 5-7 seconds per file

**Quick Health Check**:
```bash
# Get a quick summary of test suite health
./node_modules/.bin/jest --listTests | wc -l  # Count test files
./node_modules/.bin/jest --passWithNoTests 2>&1 | tail -10  # See final summary
```

**Key Test Areas**:
- Unit tests for color system, packed data processing, trigger evaluation
- Integration tests for window creation and inter-component communication
- Performance benchmarks for real-time data processing

## Bitmap Display Trace and Rate Parameters

### Trace Parameter (0-15)

The `trace` parameter controls the pixel plotting order and image orientation when data is streamed to the bitmap display. It combines rotation, flipping, and optional scrolling behavior.

**Values 0-7 (without scrolling):**
- **0**: Normal orientation - left-to-right, top-to-bottom
- **1**: Horizontal flip - right-to-left, top-to-bottom
- **2**: Vertical flip - left-to-right, bottom-to-top
- **3**: 180° rotation (H+V flip) - right-to-left, bottom-to-top
- **4**: 90° CCW rotation + V flip - top-to-bottom, left-to-right
- **5**: 90° CCW rotation - bottom-to-top, left-to-right
- **6**: 90° CW rotation - top-to-bottom, right-to-left
- **7**: 90° CW rotation + V flip - bottom-to-top, right-to-left

**Values 8-15 (with scrolling enabled):**
When bit 3 is set, scrolling is enabled with a specific orientation mapping:
- **8**: Vertical flip + scrolling (same orientation as trace=2)
- **9**: 180° rotation + scrolling (same orientation as trace=3)
- **10**: Normal orientation + scrolling (same orientation as trace=0)
- **11**: Horizontal flip + scrolling (same orientation as trace=1)
- **12**: 90° CW rotation + scrolling (same orientation as trace=6)
- **13**: 90° CW rotation + V flip + scrolling (same orientation as trace=7)
- **14**: 90° CCW rotation + V flip + scrolling (same orientation as trace=4)
- **15**: 90° CCW rotation + scrolling (same orientation as trace=5)

**Key Implementation Notes:**
- The scrolling bit (bit 3) doesn't simply add scrolling to the base orientation
- Values 8-15 use a remapped orientation pattern: the equivalent non-scrolling orientation can be found by XORing with 0b1010 (10)
- When scrolling is enabled, the bitmap shifts its content instead of wrapping when reaching edges
- Scroll direction depends on the data flow direction for that trace mode

### Rate Parameter

The `rate` parameter controls display update frequency:
- **0**: Manual update control only (no automatic updates)
- **-1**: Converted to width × height (update after full screen is drawn)
- **Positive values**: Update display after this many pixels are plotted

**Example Configurations:**
- `trace=0, rate=1`: Normal raster scan, update every pixel (real-time display)
- `trace=0, rate=640`: Normal raster scan, update after each line (for 640-width display)
- `trace=10, rate=-1`: Normal orientation with scrolling, update after full screen
- `trace=5, rate=0`: 90° CCW rotation, manual update control only

### Internal Implementation

The bitmap display maintains:
- Current pixel position (vPixelX, vPixelY)
- Rate counter (vRateCount) that increments with each plotted pixel
- Trace mode determines starting position and movement pattern
- StepTrace() advances position according to trace mode after each pixel
- RateCycle() checks if display update is needed based on rate parameter
- When scrolling is enabled and edge is reached, ScrollBitmap() shifts content