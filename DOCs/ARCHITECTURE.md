# Architecture Documentation

This document provides detailed architecture and implementation notes for PNut-Term-TS.

## System Architecture

### Overview

PNut-Term-TS is an Electron-based debug terminal application that communicates with Parallax Propeller2 microcontrollers. It combines:
- File downloading capabilities to P2 RAM/FLASH
- Serial terminal functionality (PST replacement)
- Comprehensive debug display windows
- Real-time data visualization

### Core Components

#### 1. Application Entry Point
**File**: `src/pnut-term-ts.ts`
- CLI interface using Commander.js
- Handles command-line argument parsing
- Creates and manages the application context
- Initializes main window

#### 2. Window Management System
**Primary Controller**: `src/classes/mainWindow.ts`
- Manages Electron BrowserWindow instances
- Factory pattern for creating debug windows
- Inter-window communication
- Application lifecycle management

#### 3. Debug Window Architecture
**Base Class**: `src/classes/debugWindowBase.ts`

All debug windows extend this base class and must implement:
```typescript
abstract closeDebugWindow(): void;
abstract updateContent(lineParts: string[]): void;
```

**Implemented Windows**:
- `DebugTermWindow` - Terminal emulation with ANSI support
- `DebugLogicWindow` - Logic analyzer with trigger support
- `DebugScopeWindow` - Oscilloscope with trigger support
- `DebugScopeXYWindow` - XY oscilloscope with persistence modes
- `DebugPlotWindow` - 2D plotting with layers and sprites
- `DebugBitmapWindow` - Bitmap display with trace patterns
- `DebugMidiWindow` - MIDI visualization with piano keyboard

#### 4. Hardware Communication Layer
**USB Serial**: `src/utils/usb.serial.ts`
- SerialPort library wrapper
- Device enumeration and selection
- Async data streaming
- Error handling and recovery

**Downloader**: `src/classes/downloader.ts`
- P2 binary file downloading
- RAM and FLASH programming
- Protocol implementation
- Progress tracking

#### 5. Shared Components (`src/classes/shared/`)

**Data Processing**:
- `PackedDataProcessor` - Handles 13 packed data modes
- `Spin2NumericParser` - Parses all Spin2 numeric formats
- `DisplaySpecParser` - Parses display specifications
- `TriggerProcessor` - Evaluates trigger conditions

**Rendering Support**:
- `CanvasRenderer` - HTML5 Canvas operations
- `LayerManager` - Bitmap layer management
- `SpriteManager` - Sprite transformations
- `ColorTranslator` - Color mode conversions

**Input Handling**:
- `InputForwarder` - Keyboard/mouse event forwarding
- `debugInputConstants` - PC_KEY/PC_MOUSE definitions

## Data Flow Architecture

### Serial Data Pipeline

```
P2 Device → USB Serial → Downloader → Logger → Debug Windows
                ↓
           File Watcher → Auto re-download
```

### Debug Command Processing

1. **Raw Data Reception**:
   - Binary data arrives via USB serial
   - Downloader routes to appropriate handler

2. **Command Parsing**:
   - Debug strings parsed by window-specific parsers
   - Commands extracted with parameters
   - Numeric values parsed via Spin2NumericParser

3. **Data Processing**:
   - Packed data unpacked if needed
   - Values validated and transformed
   - State updated in window instance

4. **Rendering**:
   - Canvas operations queued
   - Double buffering for complex windows
   - Real-time updates for streaming data

## Event System

### EventEmitter Pattern
- USB serial events
- Window lifecycle events
- Debug command events
- User input events

### Key Event Flows

**Download Complete**:
```
Downloader.downloadComplete → MainWindow.switchToTerminal → DebugTermWindow.activate
```

**Debug Command Received**:
```
SerialData → Downloader.parseDebugString → Window.updateContent → Canvas.render
```

**User Input**:
```
DOM Event → InputForwarder.queue → SerialPort.write → P2 Device
```

## Memory Management

### Window Lifecycle
- Windows created on-demand from debug commands
- Persist until explicitly closed
- Resources cleaned up in `closeDebugWindow()`
- No state persistence between sessions

### Canvas Management
- Main canvas for display
- OffscreenCanvas for complex rendering
- Double buffering prevents flicker
- Memory limits for bitmap storage

## Performance Optimizations

### Real-time Data Handling
- Efficient packed data processing
- Streaming updates without blocking
- Batched canvas operations
- Debounced input events

### Resource Management
- Lazy window creation
- Canvas size limits
- Bitmap memory pooling
- Serial buffer management

## Security Considerations

### File System Access
- Limited to workspace and downloads
- No execution of downloaded code
- Path validation for file operations

### Serial Communication
- No remote access capability
- Local USB devices only
- User permission required

## Extension Points

### Adding New Window Types
1. Extend `DebugWindowBase`
2. Implement required methods
3. Register in window factory
4. Add to debug display types

### Custom Data Processors
1. Create processor in shared/
2. Integrate with window class
3. Add unit tests
4. Update documentation

### Protocol Extensions
1. Extend command parser
2. Add new packed data modes
3. Update documentation
4. Maintain Pascal parity