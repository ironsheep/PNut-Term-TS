# Sprint 1 Detailed Plan: The Tall Thin Man - Window Behavior Implementation

> **Planning Philosophy**: This document provides guidance and advice for implementation, not rigid requirements. Code examples are SUGGESTED approaches - autonomous agents implementing tasks should determine optimal implementation details.

## Sprint Goal
Implement the "Tall Thin Man" behavior - the core window routing and debug logging system that makes everything work. When an external P2 device sends debug data, users will see debug windows pop up automatically and log files being created and populated.

## System Architecture & Flow

### Two Execution Modes

#### Mode 1: IDE-Integrated (VSCode Extension)
**Setup:**
- Developer has Spin2 source code project open in VSCode
- PNut-TS TypeScript compiler installed on machine
- PNut-Term-TS integrated with VSCode extension

**Flow:**
1. Developer writes Spin2 code in VSCode with syntax highlighting
2. VSCode extension triggers PNut-TS compiler → creates `.bin` file
3. VSCode tells PNut-Term-TS: "Running under IDE guidance"
4. PNut-Term-TS MainWindow opens
5. VSCode provides binary path for download
6. Tool downloads binary to P2 RAM and executes
7. Debug data streams back immediately
8. System processes data stream:
   - Opens green Debug Logger window (auto on first Cog message)
   - Creates timestamped log files
   - Opens debug windows as commanded
   - Routes messages appropriately

#### Mode 2: Standalone Command Line
**Setup:**
- User in directory containing `.bin` file
- Runs PNut-Term-TS directly from command line

**Flow:**
1. User runs: `pnut-term-ts myprogram.bin`
2. Tool uses filename as base for log naming
3. Downloads binary to P2 RAM
4. Same debug processing as IDE mode

## Logging Directory Structure

### Default Log Directory
```
<project-root>/
├── logs/                    # Fixed folder name at project root
│   ├── myprogram_20250113_143022_debug.log    # Debug messages only
│   ├── myprogram_20250113_144530_debug.log    # Next session's debug messages
│   └── [older logs...]
├── src/
├── dist/
└── [other project files]
```

### Log Naming Convention
**Base name determination:**
- IDE Mode: Binary filename without extension
- Standalone Mode: Command-line filename without extension

**Full log name format:**
```
<basename>_YYYYMMDD_HHMMSS_debug.log
```
Where:
- `basename`: From binary filename (e.g., "myprogram" from "myprogram.bin")
- `YYYYMMDD`: Date stamp
- `HHMMSS`: Time stamp  
- `debug`: Fixed suffix indicating debug messages only

**One log file created per session:**
1. **Debug log**: Only Cog-prefixed debug messages (non-Cog messages go to blue terminal display only)

## Component Implementation Details

### 1. DebugLoggerWindow Class

#### Visual Specifications
```typescript
interface DebugLoggerConfig {
  // Display
  columns: 80;
  rows: 24;
  fontSize: 12;  // Monospace font
  
  // Colors
  defaultTheme: {
    foreground: '#00FF00',  // Lime green
    background: '#000000'   // Black
  };
  alternateTheme: {
    foreground: '#FFBF00',  // Amber
    background: '#000000'   // Black
  };
  
  // Position
  position: 'bottom-right';  // Aligned with MainWindow top edge
  offset: { x: 20, y: 0 };   // Gap from MainWindow
}
```

#### Window Chrome
- Title bar: "Debug Logger - [Current Log Filename]"
- No menu bar (minimal chrome)
- Status bar: Shows log file path and message count
- No input field (output-only terminal)
- Close button functional

#### Performance Requirements
```typescript
interface PerformanceConfig {
  // Data rates
  maxSerialRate: 2_000_000;    // 2 Mbps total (single serial port)
  numCogs: 8;                  // All 8 COGs share this single stream
  
  // Buffering
  messageQueueSize: 5000;      // Messages (reduced from 10K)
  batchUpdateInterval: 16;     // ms (60 fps)
  displayBufferLines: 10000;   // Circular buffer
  
  // File I/O
  fileWriteBuffer: 4096;        // bytes
  fileFlushInterval: 100;      // ms
  asyncWrites: true;
}
```

### 2. Message Routing System

#### Per-Window Message Queuing Strategy

**Problem:** Window creation takes 100-200ms, but messages arrive every few ms. Messages sent to windows during creation get lost.

**Solution:** Each window class manages its own internal message queue.

**Why this approach:** Centralizes queue management where the readiness state is known, keeps MainWindow simple, and provides consistent behavior across all window types.

```typescript
// SUGGESTED APPROACH (not mandatory implementation):
// In DebugWindowBase - all windows inherit this behavior
abstract class DebugWindowBase {
  private messageQueue: string[][] = [];
  private isWindowReady: boolean = false;
  
  // MainWindow always calls this - window handles readiness internally
  updateContent(parts: string[]) {
    if (this.isWindowReady) {
      this.processMessageImmediate(parts); // Handle immediately
    } else {
      this.messageQueue.push([...parts]);  // Queue for later (copy parts)
    }
  }
  
  // Called when Electron window is ready
  protected onWindowReady() {
    this.isWindowReady = true;
    
    // Drain entire queue in order
    while (this.messageQueue.length > 0) {
      const parts = this.messageQueue.shift()!;
      this.processMessageImmediate(parts);
    }
  }
  
  // Subclass implements actual message processing
  protected abstract processMessageImmediate(parts: string[]): void;
}
```

**Benefits:**
- **Simple MainWindow**: Always just calls `window.updateContent()`
- **Self-contained**: Each window manages its own readiness
- **Resilient**: Queue persists through paint/communication issues  
- **Fast steady-state**: Once ready, direct processing (no queue overhead)

#### Detection and Routing Logic

**Why this routing pattern:** Cog messages need different handling than normal terminal output. This separates debug infrastructure from PST terminal functionality cleanly.

```typescript
// SUGGESTED MESSAGE ROUTING (implementation may vary):
// In MainWindow.processRxData()
function processRxData(message: string) {
  if (message.startsWith('Cog')) {
    // Format: "CogN: [content]" where N = 0-7
    handleDebugMessage(message);
  } else {
    // Non-debug message → blue terminal only
    appendToBlueTerminal(message);
  }
}

function handleDebugMessage(message: string) {
  // Step 1: Ensure Debug Logger exists
  if (!debugLoggerWindow) {
    debugLoggerWindow = createDebugLoggerWindow();
    logWindowPlacement(debugLoggerWindow);
  }
  
  // Step 2: Route to debug logger (ALWAYS)
  debugLoggerWindow.appendMessage(message);
  
  // Step 3: Write to log file (ALWAYS)
  debugLogFile.write(message + '\n');
  
  // Step 4: Check for embedded window commands
  const cogId = extractCogId(message);  // 0-7
  const content = message.substring(6); // After "CogN: "
  
  if (content.includes('`')) {
    // Has window command
    parseAndRouteWindowCommand(cogId, content);
  }
}
```

#### Window Command Parsing

**Why this parsing approach:** Embedded backtick commands within Cog messages need extraction before routing. This preserves the message for logging while extracting actionable commands.

```typescript
// SUGGESTED COMMAND PARSING (implementation details flexible):
// Example: "Cog0: `TERM MyTerm SIZE 80 24"
// Example: "Cog0: `MyTerm 'Hello World'"

function parseAndRouteWindowCommand(cogId: number, content: string) {
  const backtickIndex = content.indexOf('`');
  if (backtickIndex === -1) return;
  
  const command = content.substring(backtickIndex + 1);
  const parts = parseCommandParts(command);
  const windowType = parts[0];
  
  if (isWindowType(windowType)) {
    // Creating new window
    const windowName = parts[1];
    const window = createDebugWindow(windowType, parts);
    registerWindow(cogId, windowName, window);
    logWindowPlacement(window);
  } else {
    // Routing to existing window
    const windowName = parts[0];
    const window = findWindow(cogId, windowName);
    if (window) {
      window.processCommand(parts.slice(1));
    }
  }
}
```

### 3. Window Placement System

#### Heads-Up Console Algorithm

**Why this placement strategy:** Prevents window overlap while maximizing screen utilization. Heads-up pattern keeps debug windows visible around primary work areas.

**Multi-Monitor Strategy:** Research Electron screen API for multi-monitor support. If successful, implement cross-monitor placement with user preference for target monitor (default: same as MainWindow). **FALLBACK**: If multi-monitor proves complex or unreliable, fall back to single-monitor placement on the display where MainWindow launched. Add TODO for future multi-monitor enhancement and focus on perfecting single-monitor heads-up console placement.

```typescript
// SUGGESTED PLACEMENT APPROACH (algorithm details flexible):
interface PlacementSlot {
  id: string;
  position: { x: number, y: number };
  occupied: boolean;
}

class WindowPlacer {
  private slots: PlacementSlot[];
  
  constructor() {
    this.calculateSlots();
  }
  
  private calculateSlots() {
    const screen = getScreenDimensions();
    const mainWindow = getMainWindowBounds();
    const loggerWindow = getLoggerWindowBounds();
    
    // Fixed positions
    // MainWindow: bottom-center
    // DebugLogger: bottom-right
    
    // Debug window slots (heads-up pattern)
    this.slots = [
      { id: 'top-center', position: calculateTopCenter(), occupied: false },
      { id: 'left-center', position: calculateLeftCenter(), occupied: false },
      { id: 'right-center', position: calculateRightCenter(), occupied: false },
      { id: 'top-left', position: calculateTopLeft(), occupied: false },
      { id: 'top-right', position: calculateTopRight(), occupied: false },
      { id: 'mid-left', position: calculateMidLeft(), occupied: false },
      { id: 'mid-right', position: calculateMidRight(), occupied: false }
    ];
  }
  
  getNextPosition(windowSize: Size): Position {
    // Find first unoccupied slot
    for (const slot of this.slots) {
      if (!slot.occupied) {
        slot.occupied = true;
        return adjustForWindowSize(slot.position, windowSize);
      }
    }
    // Fallback: cascade from top-left
    return getCascadePosition();
  }
}
```

#### Placement Logging
```typescript
function logWindowPlacement(window: DebugWindow) {
  const bounds = window.getBounds();
  const type = window.getType();
  const name = window.getName();
  
  // Format: [WINDOW] Type_Name placed at (x, y) size WxH
  const logEntry = `[WINDOW] ${type}_${name} placed at (${bounds.x}, ${bounds.y}) size ${bounds.width}x${bounds.height}`;
  
  // Inject into debug logger
  debugLoggerWindow.appendSystemMessage(logEntry);
  
  // Also write to log file
  debugLogFile.write(logEntry + '\n');
}
```

### 4. Settings Integration

#### User Preferences
```typescript
interface DebugLoggerSettings {
  // Theme
  theme: 'green' | 'amber' | 'custom';
  customColors?: {
    foreground: string;
    background: string;
  };
  
  // Display
  fontSize: number;        // 8-24
  fontFamily: string;      // Monospace fonts only
  maxDisplayLines: number; // 1000-50000
  
  // Behavior
  autoScroll: boolean;
  wordWrap: boolean;
  showTimestamps: boolean;
  
  // Position (override auto-placement)
  position?: { x: number, y: number };
  size?: { width: number, height: number };
  
  // Logging
  logDirectory: string;    // Default: './logs'
  maxLogSize: number;      // MB before rotation
  keepLogDays: number;     // Days to retain logs
}
```

## Test Strategy

### Sprint 1 Test Program
```spin2
' Sprint 1 Window Behavior Test
' Tests: Logger creation, window routing, placement logging

CON
  _clkfreq = 200_000_000
  
PUB main() | i
  ' Test 1: Trigger debug logger creation
  debug("Starting Sprint 1 Test")  ' Creates "Cog0: Starting Sprint 1 Test"
  waitms(1000)
  
  ' Test 2: Create TERM window
  debug(`TERM TestTerm SIZE 40 20 POS 100 100)
  debug(`TestTerm "TERM window created")
  debug(`TestTerm 13 10 "Line 2 of TERM")
  waitms(2000)
  
  ' Test 3: Create LOGIC window
  debug(`LOGIC Signals 'CLK' 'DATA' 'CS')
  repeat i from 0 to 100
    debug(`Signals long i)
    waitms(10)
  
  ' Test 4: Close windows
  debug(`TestTerm CLOSE)
  debug(`Signals CLOSE)
  
  ' Test 5: Verify logger still running
  debug("Test complete - logger should still be visible")
```

### Expected Behavior Checklist
- [ ] First "Cog0:" message opens Debug Logger window
- [ ] Debug Logger appears bottom-right, green on black
- [ ] Log files created in `./logs/` directory
- [ ] TERM window creates and auto-places
- [ ] [WINDOW] placement logged for TERM
- [ ] LOGIC window creates and auto-places  
- [ ] [WINDOW] placement logged for LOGIC
- [ ] Windows close when commanded
- [ ] Debug Logger remains open
- [ ] All Cog messages in debug log file
- [ ] No Cog messages in blue terminal

## Implementation Phases

Sprint completed in single sitting with rapid consecutive implementation:

### Phase 1: Core Foundation
- [ ] Study existing window implementations 
- [ ] Create DebugLoggerWindow class
- [ ] Update MainWindow message routing

### Phase 2: Window Management  
- [ ] Implement per-window internal message queuing 
- [ ] Add window placement system
- [ ] Add placement logging

### Phase 3: Polish & Testing
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Bug fixes and documentation

## Sprint Deliverables

All features planned will be implemented. No partial implementations or shortcuts.

### Core Debug Logger Window
- [x] Detailed plan complete
- [ ] Debug Logger window opens automatically on first Cog message
- [ ] Green-on-black theme (default) and amber theme option
- [ ] 80x24 terminal size with Parallax font
- [ ] Status bar showing log file path and message count
- [ ] Auto-scroll with manual scroll override
- [ ] Close button stops ALL debug logging

### Message Routing System  
- [ ] Cog messages route to debug logger (NOT blue terminal)
- [ ] Per-window internal message queuing during creation
- [ ] Window command parsing from embedded backticks
- [ ] Routing to both debug logger AND specific windows

### Window Management
- [ ] Heads-up console auto-placement algorithm
- [ ] Window placement without overlaps
- [ ] [WINDOW] placement logging injection
- [ ] Multi-monitor support via Electron screen API

### Logging System
- [ ] Timestamped log files created in ./logs/ directory
- [ ] Log naming: `<basename>_YYYYMMDD_HHMMSS_debug.log`
- [ ] DTR reset creates new timestamped log
- [ ] Line ending visualization option (←↓┐ symbols)

### Settings Integration
- [ ] Theme selection (green/amber/custom)
- [ ] Font size and display preferences
- [ ] Show line endings toggle
- [ ] Log directory configuration

### Performance & Quality
- [ ] Handle 2 Mbps serial data rate without UI freezing
- [ ] Circular buffer management (10,000 lines)
- [ ] Async file I/O with batching
- [ ] Unit test coverage ≥70% for new code
- [ ] No regressions in existing functionality

## Risk Register

### High Risk
1. **Performance Issues**
   - Mitigation: Implement buffering early
   - Fallback: Reduce update frequency

2. **Electron Window Complexity**
   - Mitigation: Study existing patterns thoroughly
   - Fallback: Simple fixed positioning

### Medium Risk
1. **Breaking Existing Routing**
   - Mitigation: Careful insertion point selection
   - Fallback: Feature flag for new behavior

2. **File I/O Performance**
   - Mitigation: Use async writes
   - Fallback: Larger buffer, less frequent flush

### Low Risk
1. **Visual Design Issues**
   - Mitigation: Well specified already
   - Fallback: Use existing terminal colors

## Implementation Points Discovered

### Message Interception Location
- **File**: `src/classes/mainWindow.ts`
- **Line 241**: Current backtick detection: `if (data.charAt(0) === '`' && !this.waitingForINIT)`
- **Method**: `handleSerialRx()` → `processRxData()` → `handleDebugCommand()`
- **Change needed**: Add Cog detection BEFORE backtick check

### Window Creation Pattern
- **Line 294**: Example: `const scopeDisplay = new DebugScopeWindow(this.context, scopeSpec);`
- **Line 296**: Registration: `this.hookNotifcationsAndRememberWindow(scopeSpec.displayName, scopeDisplay);`
- **Line 419**: Storage: `this.displays[windowName] = windowObject;`
- **Pattern**: Parse spec → Create window instance → Hook notifications → Store in displays hash

### Log File Management
- **Line 48**: `private logFilenameBase: string = 'myapp';`
- **Line 85**: Current naming: `this.logFilenameBase = 'myApp-${currFileTime}.log';`
- **Line 891**: Default path: `./Logs/${this.logFilenameBase}`
- **Line 1120**: Full path: `this.logFileSpec = path.join(logFolder, filename);`
- **Change needed**: Update to our naming convention

### Window Display Storage
- **Line 66**: `private displays: { [key: string]: DebugWindowBase } = {};`
- **Line 273-284**: Routing to existing windows by name
- **Line 419**: Adding new windows to displays hash

## Specific Implementation Details

### DebugLoggerWindow Class Structure
```typescript
// src/classes/debugLoggerWindow.ts

/**
 * Debug Logger Window - High-Performance Debug Message Capture
 * 
 * A specialized output-only terminal window that automatically captures ALL debug
 * messages from Propeller 2 microcontrollers. This window serves as the central
 * logging hub for the three-paradigm system, providing visual feedback while
 * simultaneously writing to persistent log files.
 * 
 * ## Purpose
 * Unlike other debug windows that are created by specific debug commands, the
 * Debug Logger Window is a singleton that auto-creates on the first Cog-prefixed
 * message. It acts as the "Tall Thin Man" - the critical infrastructure that
 * makes the entire debug system work by:
 * - Capturing high-velocity data streams (up to 2 Mbps total from all 8 COGs)
 * - Providing visual confirmation of debug activity
 * - Creating persistent logs for regression testing and analysis
 * - Routing messages to specialized debug windows
 * 
 * ## Features
 * - **Auto-Creation**: Opens automatically on first "CogN:" message
 * - **High-Performance**: Handles 2 Mbps serial data rate via buffering
 * - **Circular Buffer**: Maintains last 10,000 lines in memory (configurable)
 * - **Persistent Logging**: Writes all messages to timestamped log files
 * - **Theme Support**: Green-on-black (default) or amber-on-black themes
 * - **Line Ending Visualization**: Optional display of CR/LF/CRLF symbols
 * - **Auto-Scroll**: Tail follows latest messages with manual scroll override
 * 
 * ## Visual Design
 * - **Size**: 80 columns × 24 rows (standard terminal dimensions)
 * - **Position**: Bottom-right of screen, aligned with MainWindow
 * - **Font**: Parallax.ttf with extended character set for line endings
 * - **Colors**: 
 *   - Green theme: #00FF00 on #000000 (classic debug terminal)
 *   - Amber theme: #FFBF00 on #000000 (vintage terminal)
 * 
 * ## Message Format
 * All Cog-prefixed messages are captured:
 * - `Cog0: Debug message` - Standard debug output
 * - `Cog1: \`TERM MyTerm SIZE 80 24` - Window creation command
 * - `Cog2: \`MyTerm "Hello"` - Window update command
 * 
 * ## Log File Management
 * - **Directory**: `<project-root>/Logs/` (capital L)
 * - **Naming**: `<basename>_YYYYMMDD_HHMMSS.log`
 * - **DTR Behavior**: Closes current log, starts new timestamped log
 * - **Rotation**: New log on each DTR reset or download
 * 
 * ## Performance Characteristics
 * - **Message Queue**: Batches updates every 16ms (60 fps)
 * - **Async I/O**: Non-blocking file writes with 100ms flush interval
 * - **Memory Management**: Removes oldest 10% when buffer full
 * - **Zero Data Loss**: Queues messages during write errors
 * 
 * ## Integration Points
 * - **MainWindow**: Receives all Cog-prefixed messages
 * - **WindowRouter**: Not registered (doesn't receive commands)
 * - **Settings**: Shares theme preferences with MainWindow
 * - **Log Files**: Manages file handles and rotation
 * 
 * ## Special Behaviors
 * - **Window Close**: Closing logger stops ALL debug logging
 * - **Scroll Behavior**: Manual scroll pauses auto-scroll
 * - **Show Line Endings**: Displays ← (CR), ↓ (LF), ┐ (CRLF)
 * - **Placement Logging**: Injects [WINDOW] entries for other windows
 * 
 * ## Example Usage
 * ```spin2
 * ' This automatically opens the Debug Logger
 * debug("Starting program")  ' Becomes "Cog0: Starting program"
 * 
 * ' These messages all go to the logger (and specific windows)
 * debug(\`TERM Display SIZE 40 20)  ' Creates TERM window
 * debug(\`Display "Hello World")     ' Updates Display window
 * debug("Status: Running")           ' Logger only
 * ```
 * 
 * ## Testing Requirements
 * - Unit test coverage: ≥70% (project standard)
 * - Performance: Must handle 2 Mbps sustained (total serial stream)
 * - Edge cases: Disk full, no directory, window creation failure
 * 
 * @see DebugWindowBase - Parent class for all debug windows
 * @see MainWindow - Message routing and Cog detection
 * @see WindowRouter - Manages other debug windows (not this one)
 */
export class DebugLoggerWindow extends DebugWindowBase {
  private displayBuffer: string[] = [];  // Circular buffer
  private maxLines: number = 10000;      // Configurable
  private autoScroll: boolean = true;
  private logFileHandle: fs.WriteStream | null = null;
  private writeQueue: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  
  constructor(context: Context) {
    super(context);
    this.initializeLogger();
    this.applyTheme('green'); // or from settings
    this.openLogFile();
  }
}
```

### MainWindow JSDoc Enhancement
```typescript
// Add comprehensive JSDoc to mainWindow.ts

/**
 * MainWindow - Central Hub for P2 Debug Terminal System
 * 
 * The MainWindow class serves as the primary control center for the PNut-Term-TS
 * application, managing serial communication, message routing, and the three-paradigm
 * debug system (PST terminal, debug windows, and debug logger).
 * 
 * ## Primary Responsibilities
 * - **Serial Communication**: Manages USB serial connection to P2 at up to 2 Mbps
 * - **Message Routing**: Discriminates between Cog-prefixed debug and normal messages
 * - **Window Management**: Creates and tracks all debug windows via displays hash
 * - **File Downloads**: Handles binary downloads to P2 RAM/Flash
 * - **IDE Integration**: Operates in IDE mode or standalone mode
 * 
 * ## Three-Paradigm System
 * 1. **PST Terminal Mode**: Blue terminal with ANSI/cursor control for TUIs
 * 2. **Debug Windows**: Software-defined instrumentation (SCOPE, LOGIC, etc.)
 * 3. **Debug Logger**: High-speed capture with visual feedback (NEW)
 * 
 * ## Message Flow Architecture
 * ```
 * Serial RX → handleSerialRx() → processRxData() → Route Decision:
 *   ├─ Cog prefix? → handleCogMessage() → Debug Logger + Windows
 *   ├─ Backtick? → handleDebugCommand() → Create/Route to Window
 *   └─ Normal → appendLog() → Blue Terminal
 * ```
 * 
 * ## Key Methods Modified for Sprint 1
 * - **processRxData()**: Add Cog detection before backtick check
 * - **handleCogMessage()**: NEW - Routes to debug logger
 * - **createDebugLoggerWindow()**: NEW - Auto-creates logger
 * - **logWindowPlacement()**: NEW - Injects [WINDOW] entries
 * 
 * ## Integration Points
 * - **DebugLoggerWindow**: Auto-created singleton for Cog messages
 * - **WindowRouter**: Manages debug window creation and routing
 * - **Downloader**: Handles P2 binary downloads
 * - **Settings**: User preferences and themes
 * 
 * @see DebugLoggerWindow - Central logging hub
 * @see WindowRouter - Debug window management
 * @see Downloader - P2 binary download handler
 */
export class MainWindow {
  // ... existing code ...
}
```

### Message Router Modification
```typescript
// In mainWindow.ts, modify processRxData() around line 240
private processRxData(data: string) {
  // NEW: Check for Cog prefix first
  if (data.startsWith('Cog') && data.length > 4 && data[3] === ':') {
    this.handleCogMessage(data);
    return; // Don't process further
  }
  
  // Existing backtick handling
  if (data.charAt(0) === '`' && !this.waitingForINIT) {
    this.handleDebugCommand(data);
  } else {
    // Normal terminal output
    this.appendLog(data);
  }
}

private handleCogMessage(message: string) {
  // Ensure debug logger exists
  if (!this.debugLoggerWindow) {
    this.createDebugLoggerWindow();
  }
  
  // Always route to logger
  this.debugLoggerWindow.appendMessage(message);
  
  // Check for embedded commands
  const content = message.substring(6); // After "CogN: "
  if (content.includes('`')) {
    // Extract and handle command
    const commandStart = content.indexOf('`');
    const command = content.substring(commandStart);
    this.handleDebugCommand(command);
  }
}
```

### Edge Cases and Error Handling

#### Log Directory Creation
```typescript
private ensureLogDirectory(): void {
  const logDir = path.join(process.cwd(), 'Logs');
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      // Fall back to temp directory
      this.logDirectory = os.tmpdir();
      this.showError('Could not create Logs directory, using temp');
    }
  }
}
```

#### Disk Full Handling
```typescript
private handleWriteError(error: Error): void {
  if (error.message.includes('ENOSPC')) {
    // Disk full
    this.showError('Disk full - logging suspended');
    this.suspendLogging();
  } else {
    // Other write error
    this.showError(`Log write error: ${error.message}`);
  }
}
```

#### Window Creation Failure
```typescript
private createDebugLoggerWindow(): void {
  try {
    this.debugLoggerWindow = new DebugLoggerWindow(this.context);
    this.hookNotifcationsAndRememberWindow('DebugLogger', this.debugLoggerWindow);
    this.logWindowPlacement(this.debugLoggerWindow);
  } catch (error) {
    // Fall back to console logging
    console.error('Failed to create debug logger window:', error);
    this.useConsoleLogging = true;
  }
}
```

### Performance Optimizations

#### Message Batching
```typescript
private messageQueue: string[] = [];
private batchTimer: NodeJS.Timeout | null = null;

private queueMessage(message: string): void {
  this.messageQueue.push(message);
  
  if (!this.batchTimer) {
    this.batchTimer = setTimeout(() => {
      this.flushMessageQueue();
    }, 16); // 60fps
  }
}

private flushMessageQueue(): void {
  if (this.messageQueue.length > 0) {
    const batch = this.messageQueue.splice(0, 100); // Process up to 100 at once
    this.updateDisplay(batch);
    this.writeToFile(batch);
  }
  this.batchTimer = null;
}
```

#### Circular Buffer Management
```typescript
private addToBuffer(message: string): void {
  this.displayBuffer.push(message);
  
  // Maintain circular buffer
  if (this.displayBuffer.length > this.maxLines) {
    // Remove oldest 10% when full
    const removeCount = Math.floor(this.maxLines * 0.1);
    this.displayBuffer.splice(0, removeCount);
  }
}
```

### Line Ending Handling

#### Detection and Normalization
```typescript
private processLineEndings(data: string): string[] {
  const lines: string[] = [];
  let current = '';
  
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const nextChar = i + 1 < data.length ? data[i + 1] : null;
    
    if (char === '\r' && nextChar === '\n') {
      // CRLF (Windows)
      lines.push(current);
      current = '';
      i++; // Skip the LF
    } else if (char === '\n') {
      // LF only (Linux/Mac)
      lines.push(current);
      current = '';
    } else if (char === '\r') {
      // CR only (old Mac)
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    lines.push(current);
  }
  
  return lines;
}
```

#### Line Ending Visualization
```typescript
interface LineEndingSymbols {
  // Parallax font special characters discovered:
  // - Box drawing: ─│┌┐└┘├┤┬┴┼ (U+2500-254B) for schematics
  // - Arrows: ←↑→↓ (U+2190-2193) for line endings
  // - Triangles: ◀▶ (U+25C0, U+25B6)
  
  // Line ending visualization using Parallax font:
  CR: '\u2190';    // ← (left arrow, U+2190) - carriage return only
  LF: '\u2193';    // ↓ (down arrow, U+2193) - line feed only  
  CRLF: '\u2510';  // ┐ (corner, U+2510) - combines down+left motion
  
  // Alternative options:
  // CR: '\u25C0' (◀ left triangle)
  // CRLF: '↓←' (two characters)
}

private displayWithLineEndings(text: string, showEndings: boolean): string {
  if (!showEndings) return text;
  
  // Replace line endings with visible symbols
  // When using Parallax font, may have better character options
  return text
    .replace(/\r\n/g, '↵\n')  // CRLF
    .replace(/\n/g, '↓\n')     // LF only
    .replace(/\r/g, '←\n');    // CR only
}
```

#### Settings Addition
```typescript
interface DebugLoggerSettings {
  // ... existing settings ...
  
  // Line ending display
  showLineEndings: boolean;      // Default: false
  lineEndingStyle: {
    CRLF: string;  // Default: '↵'
    LF: string;    // Default: '↓'
    CR: string;    // Default: '←'
  };
}
```

#### Implementation Notes
- **For display**: When `showLineEndings` is true, append visualization symbols (←↓┐) to show original line ending type before normalization
- **For terminal rendering**: Always use normalized \n for actual line breaks (the symbols are visual indicators only)
- **For log file**: Write original line endings as received (preserve debug data integrity)
- Both MainWindow and DebugLoggerWindow should support this setting
- Setting should be in UI: "Show Line Endings" checkbox
- Useful for debugging serial communication issues

**Example**: Original "Hello\r\n" → Display shows "Hello←" + newline, log file contains "Hello\r\n"

## Testing & Coverage Requirements

### Coverage Targets (Per Project Standards)
- **Minimum**: 40% coverage for basic functionality
- **Target**: 60% coverage for good quality
- **Goal**: 70%+ coverage for critical components

### Test Files to Create
1. **tests/debugLoggerWindow.test.ts**
   - Window creation and lifecycle
   - Message buffering and display
   - Theme switching
   - Scroll behavior
   - File I/O operations

2. **tests/cogMessageRouting.test.ts**
   - Cog detection in MainWindow
   - Routing to debug logger
   - Window command parsing
   - Message distribution

3. **tests/windowPlacement.test.ts**
   - Auto-placement algorithm
   - Multi-window positioning
   - Placement logging
   - Screen boundary handling

### Test Strategy (From Terminal Window Success)
```javascript
// Mock only external dependencies
jest.mock('electron');
jest.mock('fs');

// Let internal modules run
// NO mocks for: DebugLoggerWindow, WindowRouter, etc.

// Use JSDOM for DOM operations
const setupDOM = () => {
  document.body.innerHTML = '<div id="terminal"></div>';
  // Add canvas, other elements as needed
};
```

### Critical Test Cases
1. **Message Routing**
   ```typescript
   test('routes Cog messages to debug logger', () => {
     const message = 'Cog0: Test message';
     mainWindow.processRxData(message);
     expect(debugLogger.messages).toContain(message);
     expect(blueTerminal.messages).not.toContain(message);
   });
   ```

2. **Window Creation**
   ```typescript
   test('auto-creates debug logger on first Cog message', () => {
     expect(mainWindow.debugLoggerWindow).toBeNull();
     mainWindow.processRxData('Cog0: First');
     expect(mainWindow.debugLoggerWindow).toBeDefined();
   });
   ```

3. **Performance**
   ```typescript
   test('handles 2 Mbps data rate', async () => {
     const messages = generateMessages(1000); // 1K messages (reduced)
     const start = performance.now();
     messages.forEach(m => mainWindow.processRxData(m));
     const duration = performance.now() - start;
     expect(duration).toBeLessThan(500); // Under 0.5 second
   });
   ```

## Detailed Implementation Advice

### Files to Modify
1. **src/classes/mainWindow.ts**
   - Lines 240-244: Add Cog detection before backtick check
   - Line 66: Add debugLoggerWindow property
   - Line 419: Register debug logger in displays hash
   - Line 891: Update log path to use Logs/ (capital L)

2. **src/classes/debugLoggerWindow.ts** (NEW FILE)
   - Extends DebugWindowBase (study debugTermWin.ts as reference)
   - No parseDeclaration needed (singleton window)
   - Override createDebugWindow() for Electron window
   - Implement appendMessage() with buffering

3. **src/utils/settings.ts** (if exists, else create)
   - Add DebugLoggerSettings interface
   - Default: green theme, 10000 lines, show line endings false

### Data Structures Needed
```typescript
// In mainWindow.ts
private debugLoggerWindow: DebugLoggerWindow | null = null;
private debugLogBaseFilename: string = 'debug_capture';
private currentLogFile: fs.WriteStream | null = null;

// In debugLoggerWindow.ts
private messageBuffer: string[] = [];
private displayBuffer: string[] = [];  // Circular
private scrollPosition: number = -1;   // -1 = auto-scroll
private theme: 'green' | 'amber' = 'green';
```

### API Interfaces
```typescript
// Window communication
interface DebugLoggerMessage {
  type: 'append' | 'clear' | 'theme' | 'scroll';
  data: string | number | ThemeConfig;
  timestamp: number;
}

// Settings persistence
interface DebugLoggerPrefs {
  theme: string;
  maxLines: number;
  showLineEndings: boolean;
  defaultBaseName: string;
}
```

### Test Scenarios to Cover
1. **Basic Flow**
   - First Cog message opens logger
   - Non-Cog messages go to blue terminal
   - Cog messages go to logger only

2. **Window Commands**
   - `Cog0: \`TERM Test` creates TERM window
   - `Cog0: \`Test "data"` routes to Test window
   - Both messages also appear in logger

3. **Message Queuing During Creation**
   - Send creation command + 3 data messages rapidly
   - Verify all 4 messages processed when window ready
   - Verify messages processed in correct order
   - Verify no messages lost during window creation

4. **DTR Reset**
   - Logger clears display
   - Old log closes
   - New timestamped log starts

5. **Performance**
   - Send 1000 messages rapidly
   - Verify no UI freeze
   - Check memory usage stable
   - Verify queuing doesn't cause memory leaks

6. **Edge Cases**
   - Close logger (stops all logging)
   - Disk full handling
   - No Logs/ directory
   - Window creation failure (queue handling)

### Performance Considerations
- **Batch Processing**: Update DOM every 16ms max
- **Circular Buffer**: Remove 10% when full
- **Async Writes**: Never block on file I/O
- **Message Queue**: Process up to 100 per batch

### Error Handling Approach
- **Graceful Degradation**: Fall back to console if window fails
- **User Notification**: Status bar shows errors
- **Recovery**: Can restart logging after disk space freed
- **No Data Loss**: Queue messages during write errors

## Architecture Impact

### Changes to Message Flow
```
Before:
Serial RX → processRxData → backtick? → handleDebugCommand
                          ↓
                    appendLog (blue terminal)

After:
Serial RX → processRxData → Cog? → handleCogMessage → debugLogger
                          ↓                         ↘
                    backtick? → handleDebugCommand    specific window
                          ↓
                    appendLog (blue terminal)
```

### New Responsibilities
- **MainWindow**: Cog detection and routing
- **DebugLoggerWindow**: Display and file management
- **Settings**: Logger preferences persistence

### Backward Compatibility
- Non-Cog messages unchanged
- Existing debug windows unaffected
- Backtick parsing preserved
- Blue terminal still available

## Risk Mitigation Details

### High Risk: Performance
- **Mitigation Steps**:
  1. Implement message queue first
  2. Add batching at 60fps
  3. Profile with real data
  4. Optimize if needed
- **Monitoring**: Log batch sizes and timing

### Medium Risk: Electron Complexity
- **Mitigation Steps**:
  1. Copy pattern from debugTermWin.ts
  2. Start with fixed size/position
  3. Add auto-placement later
- **Fallback**: Use fixed bottom-right position

### Low Risk: Theme System
- **Mitigation Steps**:
  1. Start with hardcoded green
  2. Add theme switch method
  3. Integrate settings last
- **Fallback**: Green-only for demo

## Definition of Done Checklist

### Code Complete
- [ ] DebugLoggerWindow class created and tested
- [ ] MainWindow routing modified
- [ ] Log file management working
- [ ] Window placement logging implemented
- [ ] DTR reset behavior correct
- [ ] Close window stops logging

### Testing Complete
- [ ] Manual test with Sprint 1 test program
- [ ] Performance validated at 2 Mbps
- [ ] All edge cases handled
- [ ] No regressions in existing features
- [ ] Unit test coverage ≥70% for new code
- [ ] Integration tests for window creation/routing
- [ ] Performance benchmarks documented

### Documentation Complete
- [ ] Code comments added
- [ ] Architecture diagram updated
- [ ] User guide section written
- [ ] API documented

### Demo Ready
- [ ] Green theme working
- [ ] Auto-scroll smooth
- [ ] Placement logs visible
- [ ] No crashes under load

## Task Generation Advice

### Logical Groupings Observed

**Foundation Group**: Core infrastructure that everything depends on
- DebugLoggerWindow class creation
- Per-window message queuing in DebugWindowBase
- Cog message detection in MainWindow

**Routing Group**: Message flow and window management
- MainWindow routing modification to handle Cog messages
- Window command parsing and routing
- WindowRouter integration with Cog messages

**Placement Group**: Visual window management
- Heads-up console placement algorithm
- Window placement logging with [WINDOW] format
- Multi-monitor support via Electron screen API

**Enhancement Group**: User experience features
- Theme support (green/amber themes)
- Settings UI integration
- Line ending visualization options

**Quality Group**: Testing and performance
- Comprehensive test suite with 70% coverage
- Performance optimization for 2 Mbps data rate
- Integration testing with real P2 data

### Implementation Dependency Advice

**Critical Ordering**: Foundation → Routing → Placement → Enhancement → Quality

**Rationale**: 
- Foundation provides base classes that everything uses
- Routing builds on foundation to enable message flow
- Placement builds on routing to position windows
- Enhancement adds polish to working system
- Quality validates entire system

**Anti-Pattern Warning**: Avoid implementing enhancements before core routing works - leads to rework and integration issues.

## Notes
- This is the most critical sprint - everything depends on it
- User will provide real P2 debug output for testing
- All implementation points have been located in code
- Plan is complete with error handling and performance considerations
- Parallax font characters available for enhanced UI