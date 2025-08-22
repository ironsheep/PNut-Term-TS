# Interactive Debugger Window Implementation Plan

## Key Decisions Summary (Post-Review)

### Confirmed Approach:
- **Pascal Parity**: Match Pascal behavior exactly for MVP
- **Serial Protocol**: Dual handlers (binary + text) side-by-side
- **Unified Routing**: Single routing system for all window types (efficient, thin, fast)
- **Memory Visualization**: Heat decay is CRITICAL - must include
- **Disassembler**: Full implementation from start, display like Pascal (hex + disasm always)
- **Multi-Window**: Shared manager class for routing using DebuggerID/COG number
- **Window Positioning**: Use Electron if possible, otherwise explicit cascading like Pascal
- **Error Recovery**: Show "lost communication" indicator, auto-resume when possible
- **State Persistence**: Start fresh each time (Pascal behavior confirmed)
- **Keyboard Shortcuts**: Implement Pascal's shortcuts (SPACE=Go, B=Break, D=Debug, I=Init)
- **Testing**: Capture/replay real P2 sessions
- **Font**: Use existing Parallax font
- **Variable Names**: Descriptive with Pascal references in comments

### Action Items Before Implementation:
1. Research Electron window positioning capabilities
2. Research Canvas rendering best practices for 123x77 grids
3. Create test data capture plan with annotated scenarios
4. Design error recovery UI indicators

## Overview
The Debugger window is fundamentally different from all other debug windows. It provides an interactive debugging interface for the Propeller 2 (P2) microcontroller, supporting single-stepping, breakpoints, register inspection, and memory viewing for up to 8 concurrent COGs (processor cores). Unlike other debug windows that passively display data, this window actively communicates bidirectionally with the P2 over the serial port.

## Pascal Source Analysis

### Core Functionality
The Pascal implementation in `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` provides:

1. **Interactive Debugging Features**:
   - Single-step execution (MAIN, INT1, INT2, INT3 modes)
   - Breakpoint management (address and event-based)
   - Register viewing (COG registers 0-511, LUT 512-1023)
   - Memory inspection (COG, LUT, HUB memory)
   - Smart pin monitoring
   - Stack trace display (8 levels)
   - Disassembly with PC tracking (always shows hex + decoded instruction)

2. **Multi-COG Support**:
   - Up to 8 debugger windows can be open simultaneously
   - Each window connects to a specific COG (0-7) using DebuggerID
   - Independent debugging sessions per COG
   - Shared RequestCOGBRK global for breakpoint coordination
   - Window positioning: cascades by `DebuggerID * ChrHeight * 2` pixels

3. **Visual Layout (123x77 character grid)**:
   - Register/LUT memory maps with heat visualization
   - Flags display (C, Z, PC, SKIP, XBYTE, CT)
   - Disassembly window with 16 lines (hex + instruction always shown)
   - Register watch window
   - Special function registers (SFR)
   - Event monitoring
   - Stack display (8 levels)
   - Interrupt status
   - Pointer tracking (PTRA, PTRB, FIFO)
   - Pin states (DIR, OUT, IN)
   - Smart pin watch
   - HUB memory viewer with mini-map
   - Control buttons (BREAK, ADDR, INT1/2/3, DEBUG, INIT, EVENT, MAIN, GO)

4. **Keyboard Shortcuts** (confirmed in Pascal):
   - SPACE = Click Go button
   - B = Click BREAK button
   - D = Toggle DEBUG button
   - I = Right-click INIT button
   - Arrow keys = Navigation
   - PageUp/PageDown = Memory scrolling

5. **State Management**:
   - Always starts fresh (ResetRegWatch, ResetSmartWatch in FormCreate)
   - No persistence between window sessions
   - Breakpoints cleared on window open

### Communication Protocol

#### Message Format (20 longs from P2):
```pascal
const
  mCOGN  = 0;   // COG number and status flags (includes routing info)
  mBRKCZ = 1;   // Break conditions and C/Z flags
  mBRKC  = 2;   // Break C flag detail
  mBRKZ  = 3;   // Break Z flag detail
  mCTH2  = 4;   // CT high 32 bits
  mCTL2  = 5;   // CT low 32 bits
  mSTK0  = 6;   // Stack level 0
  mSTK1  = 7;   // Stack level 1
  mSTK2  = 8;   // Stack level 2
  mSTK3  = 9;   // Stack level 3
  mSTK4  = 10;  // Stack level 4
  mSTK5  = 11;  // Stack level 5
  mSTK6  = 12;  // Stack level 6
  mSTK7  = 13;  // Stack level 7
  mIRET  = 14;  // Interrupt return addresses
  mFPTR  = 15;  // FIFO pointer
  mPTRA  = 16;  // Pointer A
  mPTRB  = 17;  // Pointer B
  mFREQ  = 18;  // Frequency/status
  mCOND  = 19;  // Condition codes
```

#### Communication Flow:
1. **P2 → Debugger** (Initial data):
   - 20-long debugger message (includes COG ID for routing)
   - COG/LUT block CRCs (64 words)
   - HUB block checksums (124 words)

2. **Debugger → P2** (Requests):
   - COG/LUT block requests (bitmap)
   - HUB checksum requests (bitmap)
   - HUB read requests (5 separate reads)
   - COGBRK request (breakpoint control)
   - STALL/BRK command

3. **P2 → Debugger** (Response data):
   - Requested COG/LUT blocks (16 longs each)
   - HUB checksum details
   - HUB data reads
   - Smart pin data (64 pins, selective)

### Key Implementation Details

1. **Checksum-based Updates**:
   - COG/LUT divided into 64 blocks of 16 longs
   - HUB divided into 124 blocks of 4KB
   - Only changed blocks are transmitted
   - Sub-block checksums for HUB (128-byte granularity)

2. **Rendering System**:
   - Triple-buffered bitmap system
   - Anti-aliased shape drawing
   - Gamma-corrected alpha blending
   - Custom character positioning (7-bit fractional)
   - Parallax font usage

3. **Mouse Interaction**:
   - Extensive hit testing for all UI regions
   - Context-sensitive tooltips
   - Click actions for buttons and memory locations
   - Scroll wheel support for memory navigation

4. **Error Handling**:
   - Checksum validation
   - Lost communication detection
   - Auto-resume capability

## TypeScript Implementation Architecture

### File Structure
```
src/classes/
├── debugDebuggerWin.ts         # Main debugger window class
├── shared/
│   ├── debuggerProtocol.ts     # NEW: P2 communication protocol
│   ├── debuggerDataManager.ts  # NEW: Data caching and checksums
│   ├── debuggerRenderer.ts     # NEW: Custom rendering for debugger UI
│   ├── disassembler.ts         # NEW: P2 instruction disassembly
│   ├── debuggerConstants.ts    # NEW: Message formats and layouts
│   └── windowRouter.ts         # NEW: Unified routing system
tests/
├── debugDebuggerWin.test.ts
├── debuggerProtocol.test.ts
├── debuggerDataManager.test.ts
├── disassembler.test.ts
└── windowRouter.test.ts
```

### Class Hierarchy
```
DebugWindowBase
    └── DebugDebuggerWindow
            ├── Uses: WindowRouter (unified message routing)
            ├── Uses: DebuggerProtocol (serial communication)
            ├── Uses: DebuggerDataManager (data caching)
            ├── Uses: DebuggerRenderer (UI rendering)
            ├── Uses: Disassembler (instruction decode)
            ├── Uses: CanvasRenderer (existing)
            ├── Uses: ColorTranslator (existing)
            └── Uses: InputForwarder (existing, minimal use)
```

### NEW Shared Classes

#### 1. WindowRouter
- Unified routing for ALL window types (debugger + debug displays)
- Maps window IDs to active window instances
- Routes binary debugger messages by COG ID
- Routes text DEBUG commands by window type
- Efficient, thin, fast implementation
- Prevents message conflicts between handlers
- **Built-in Recording/Playback System**:
  - Records all window messages with timestamps
  - Supports selective window recording
  - JSON Lines format for streaming
  - Catalog system for test management
  - Enables regression testing for all windows

#### 2. DebuggerProtocol
- Manages bidirectional serial communication
- Dual path support (binary + text coexistence)
- Implements message framing and sequencing
- Handles request/response correlation
- Manages timing and flow control
- Shows "lost communication" on errors

#### 3. DebuggerDataManager
- Caches COG/LUT/HUB memory blocks
- Tracks checksums for change detection
- Manages memory request optimization
- Stores debugger state per COG
- Handles breakpoint management
- Always starts fresh (no persistence)

#### 4. DebuggerRenderer
- Renders register/memory heat maps
- Draws disassembly with syntax highlighting
- Always shows hex + decoded instruction
- Creates interactive button controls
- Manages complex layout grid
- Implements tooltip system
- Uses Parallax font

#### 5. Disassembler
- Decodes P2 instructions
- Formats assembly with operands
- Always displays hex + disassembly
- Tracks PC and execution flow
- Handles SKIP patterns
- Supports all addressing modes

### Implementation Requirements

1. **Serial Protocol**:
   - Dual handlers that don't conflict
   - Binary protocol separate from text protocol
   - Support all windows open simultaneously
   - Unified routing through WindowRouter
   - "Lost communication" indicator with auto-resume

2. **Window Management**:
   - Cascade windows by COG ID if Electron allows
   - Otherwise explicit positioning like Pascal
   - Support up to 8 concurrent debugger windows
   - Fresh state on each window open

3. **Performance**:
   - Efficient checksum computation
   - Minimal memory transfers
   - Fast rendering for responsive UI
   - Smooth scrolling in disassembly
   - Research Canvas best practices for 123x77 grid

4. **User Interface**:
   - Match Pascal's character positioning exactly
   - Use Parallax font (already in system)
   - Implement all keyboard shortcuts
   - Show both hex and disassembly always

## Testing Strategy

**Implementation Order Note**: Phases ordered to minimize rework - build foundation, then protocol, then data layer, then UI, avoiding circular dependencies and repeated refactoring.

### Phase 1: Protocol Testing
- Mock serial communication
- Test message encoding/decoding
- Verify checksum algorithms
- Test request/response correlation
- Test "lost communication" detection

### Phase 2: Data Management Testing
- Test cache invalidation
- Verify memory block updates
- Test breakpoint management
- Verify fresh state on open
- Test error recovery

### Phase 3: Rendering Testing
- Test heat map generation
- Verify button hit testing
- Test tooltip generation
- Verify layout calculations
- Test keyboard shortcuts

### Phase 4: Integration Testing
- Test with simulated P2 responses
- Verify multi-COG coordination
- Test error recovery
- Verify performance targets
- Test window routing

### Phase 5: End-to-End Testing
- Capture real P2 debug sessions
- Create annotated test data
- Replay captured sessions
- Test edge cases and error conditions
- Performance profiling

## Implementation Phases with Time Tracking

### Time Tracking Methodology
Each phase and task will track:
- **Estimated Time**: Initial estimate in hours
- **Actual Time**: Time actually spent (recorded during implementation)
- **Variance**: Difference between estimate and actual
- **Notes**: Reasons for variance, blockers encountered

Format for each task in todo list:
```
Task description [Est: Xh, Act: Yh, Var: +/-Zh]
```

### Phase 0: MainWindow Preparation (NEW)
**Phase Estimate: 12-16 hours (1.5-2 days)**
**Rationale**: Build foundational infrastructure that benefits ALL windows before starting debugger-specific work.

#### Core Components:

1. **WindowRouter Integration** [Est: 4h]
   - Singleton class built into MainWindow
   - Centralized message routing for all window types
   - Binary protocol support (for debugger)
   - Text protocol support (for existing DEBUG windows)
   - Message recording/playback built-in
   - Window registry management
   - Performance: <1ms routing overhead
   - MUST NOT block on logging operations

1a. **Mode Detection Implementation** [Est: 1h]
   - Add `--ide` command-line parameter
   - Store mode in Context
   - Conditional UI element rendering
   - Mode-specific menu items

2. **Recording System** [Est: 4h]
   - JSON Lines format for streaming
   - Catalog management system
   - Recording controls in MainWindow
   - Playback with speed control
   - Step-through debugging mode

3. **MainWindow Enhancements** [Est: 4h]
   - Minimal UI controls (DTR toggle, download RAM/Flash)
   - Native Electron menu bar for professional appearance
   - Enhanced status bar (recording, connection, COGs)
   - Integration with WindowRouter singleton
   - Backward compatibility with existing windows
   - Preserve existing timestamped logging system

4. **Testing & Documentation** [Est: 4h]
   - 100% test coverage for WindowRouter
   - Verify all existing windows work
   - Performance benchmarks
   - Architecture documentation

#### Key Design Decisions:

**WindowRouter Design**:
```typescript
interface WindowRouter {
  // Registration
  registerWindow(windowId: string, windowType: string, handler: WindowHandler): void;
  unregisterWindow(windowId: string): void;
  
  // Routing
  routeMessage(message: SerialMessage): void;
  routeBinaryMessage(data: Uint8Array): void;
  routeTextMessage(text: string): void;
  
  // Recording
  startRecording(metadata: RecordingMetadata): void;
  stopRecording(): void;
  playRecording(filePath: string, speed: number): void;
  
  // Query
  getActiveWindows(): WindowInfo[];
  getRoutingStats(): RoutingStats;
}
```

**Message Routing Logic**:
1. Binary messages (debugger):
   - Extract COG ID from message header
   - Route to debugger-{cogId} window
   - Record if recording enabled
   
2. Text messages (DEBUG commands):
   - Parse window type from command
   - Route to appropriate debug window
   - Support multiple windows of same type
   - Record if recording enabled

**Recording Storage**:
```
tests/recordings/
├── catalog.json                 # Master index
├── sessions/
│   ├── 2025-01-15-001.jsonl    # Session files
│   └── 2025-01-15-002.jsonl
└── metadata/
    └── 2025-01-15-001.json      # Session metadata
```

**MainWindow Menu Structure**:
- **File**: New Recording, Open Recording, Save Recording As, Exit
- **Edit**: Cut, Copy, Paste, Find
- **Debug**: Open Debugger (COG 0-7), Break All, Resume All
- **Tools**: Recording Controls, Performance Monitor, Settings
- **Window**: Cascade, Tile, Show All, Hide All
- **Help**: Documentation, About

#### Benefits of Phase 0:
1. **Clean Architecture**: Unified routing from start
2. **Immediate Testing**: Recording available for all development
3. **No Retrofitting**: Avoid integration work later
4. **All Windows Benefit**: Improved routing for existing windows
5. **Ready for Debugger**: Infrastructure in place

#### Architectural Decisions (Resolved):

1. **WindowRouter Architecture**: 
   - **Decision**: Singleton built into MainWindow
   - **Rationale**: Single serial connection, single MainWindow, simplifies architecture

2. **High-frequency Message Handling**:
   - **Decision**: No throttling - record everything with buffered writes
   - **Implementation**: Batch writes every 100ms or 1000 messages
   - **Optional**: Sampling mode for massive streams (record every Nth message)

3. **Playback Modes**:
   - **Full Playback**: Creates actual windows (default, visual verification)
   - **Headless Playback**: No windows, validates message flow (CI/CD testing)

4. **Menu Implementation**:
   - **Decision**: Native Electron menus
   - **Rationale**: Professional appearance, OS integration, expected behavior

5. **Recording Format**:
   - **Decision**: JSON Lines uncompressed initially
   - **Future**: Optional gzip as post-process if needed

#### Performance Requirements:
- **Logging**: Must NEVER block window operations
- **WindowRouter**: <1ms routing overhead
- **Buffered Writes**: Batch for efficiency
- **Parse Errors**: Preserve in timestamped logs

### Phase 1: Core Infrastructure  
**Phase Estimate: 10-14 hours (1.5-2 days)**
**Note**: WindowRouter moved to Phase 0
1. Create DebugDebuggerWindow class [Est: 4h]
2. Define message formats in DebuggerConstants [Est: 3h]
3. Basic window creation and lifecycle [Est: 3h]
4. Initial test framework setup [Est: 4h]

### Phase 2: Communication Protocol
**Phase Estimate: 16-24 hours (2-3 days)**
1. Implement DebuggerProtocol with dual paths [Est: 6h]
2. Implement P2 message receiving [Est: 4h]
3. Implement request generation [Est: 4h]
4. Handle STALL/BRK commands [Est: 3h]
5. Add "lost communication" detection [Est: 4h]

### Phase 3: Data Management
**Phase Estimate: 16-24 hours (2-3 days)**
1. Implement DebuggerDataManager [Est: 6h]
2. Checksum computation and caching [Est: 4h]
3. Memory block management [Est: 5h]
4. Breakpoint tracking [Est: 3h]
5. Fresh state initialization [Est: 3h]

### Phase 4: Basic UI Rendering
**Phase Estimate: 24-32 hours (3-4 days)**
1. Implement DebuggerRenderer [Est: 6h]
2. Layout grid system (123x77) [Est: 8h]
3. Register/LUT memory maps [Est: 6h]
4. Basic text rendering with Parallax font [Est: 4h]
5. Button rendering [Est: 4h]

### Phase 5: Disassembly
**Phase Estimate: 16-24 hours (2-3 days)**
1. Implement Disassembler class [Est: 8h]
2. Instruction decoding [Est: 6h]
3. Hex + disassembly formatting [Est: 4h]
4. PC tracking and highlighting [Est: 3h]
5. Scrolling support [Est: 3h]

### Phase 6: Interactive Features
**Phase Estimate: 24-32 hours (3-4 days)**
1. Mouse hit testing [Est: 6h]
2. Button click handlers [Est: 4h]
3. Keyboard shortcuts (SPACE, B, D, I, arrows) [Est: 4h]
4. Memory navigation [Est: 5h]
5. Breakpoint setting [Est: 5h]
6. Tooltip system [Est: 6h]

### Phase 7: Advanced Features
**Phase Estimate: 16-24 hours (2-3 days)**
1. Heat map visualization with decay [Est: 5h]
2. Smart pin monitoring [Est: 4h]
3. HUB memory mini-map [Est: 5h]
4. Event tracking [Est: 3h]
5. Stack display (8 levels) [Est: 4h]

### Phase 8: Multi-COG Support
**Phase Estimate: 8-16 hours (1-2 days)**
1. Window instance management [Est: 3h]
2. COG coordination through WindowRouter [Est: 4h]
3. Shared breakpoint handling [Est: 3h]
4. Window positioning (cascade) [Est: 4h]

### Phase 9: Polish and Testing
**Phase Estimate: 16-24 hours (2-3 days)**
1. Complete test coverage [Est: 6h]
2. Performance optimization [Est: 4h]
3. Error handling refinement [Est: 3h]
4. Documentation [Est: 4h]
5. Pascal parity verification [Est: 4h]

**Total Estimated Time: 162-250 hours (20-31 days at 8h/day)**
**Note**: Includes new Phase 0 for MainWindow preparation

### Time Tracking Summary Template
Will be maintained at end of implementation:
```
Phase 1: Est 20h, Act: TBD, Variance: TBD
Phase 2: Est 21h, Act: TBD, Variance: TBD
...
Total: Est 198h, Act: TBD, Efficiency: TBD%
```

## Pascal Parity Checklist

### Critical Behaviors to Match:
- [ ] 20-long message format exactly
- [ ] Checksum algorithms (CRC for COG/LUT, sum for HUB)
- [ ] Memory block sizes (16 longs for COG/LUT, 4KB/128B for HUB)
- [ ] Disassembly formatting (hex + instruction always)
- [ ] Button behavior and states
- [ ] Color scheme (82 defined colors)
- [ ] Character grid layout (123x77)
- [ ] Heat decay rate for memory visualization (HitDecayRate = 2)
- [ ] Scroll behavior in disassembly window
- [ ] Breakpoint types and conditions
- [ ] Keyboard shortcuts (SPACE, B, D, I, arrows, PageUp/Down)
- [ ] Window cascading by COG ID
- [ ] Fresh state on each open (no persistence)

### Visual Elements:
- [ ] Box drawing with rounded corners
- [ ] Anti-aliased shapes
- [ ] Check marks and delta symbols
- [ ] Arrow indicators
- [ ] Binary register display format
- [ ] Hexadecimal formatting
- [ ] Memory heat visualization
- [ ] Button highlighting
- [ ] Parallax font usage

### Exact Values from Pascal:
- DisLines = 16 (disassembly lines)
- PtrBytes = 14 (pointer view width)
- HitDecayRate = 2 (visualization decay)
- StallCmd = $00000800
- CogBlockSize = $10 (16 longs)
- HubBlockSize = $1000 (4KB)
- HubSubBlockSize = $80 (128 bytes)
- Window offset = DebuggerID * ChrHeight * 2

## Risk Mitigation

### Performance Risks:
- **Risk**: Rendering 123x77 character grid may be slow
- **Mitigation**: RESOLVED - Use dirty rectangle tracking with layers (2-5ms typical)

- **Risk**: Serial communication latency
- **Mitigation**: Asynchronous protocol, request batching, efficient routing

- **Risk**: Memory usage with 8 concurrent windows
- **Mitigation**: Shared resources, offscreen canvas reuse, lazy loading

### Compatibility Risks:
- **Risk**: Binary serial protocol vs text-based infrastructure
- **Mitigation**: Dual handler paths through unified WindowRouter
- **Important**: Messages from different windows can be intermixed - router handles this
- **Important**: Binary and text data may arrive simultaneously - careful separation

- **Risk**: Complex mouse interaction requirements
- **Mitigation**: Comprehensive hit testing system, reuse from other windows

### Technical Debt Items:
- Sub-pixel text positioning (attempt to match Pascal's 7-bit fractional if practical)
- Gamma-corrected alpha blending (use Canvas API if available)
- Custom anti-aliasing (defer to Canvas API)
- Canvas performance optimization (implement basic, then optimize)
- Extended keyboard shortcuts beyond Pascal's set

## Success Criteria

### Functional Requirements:
- [ ] Single-step debugging works for all modes
- [ ] Breakpoints trigger correctly
- [ ] Memory display updates in real-time
- [ ] Disassembly tracks PC correctly
- [ ] All buttons functional
- [ ] Multi-COG support works
- [ ] Serial protocol stable
- [ ] Window routing works for all window types
- [ ] "Lost communication" detection and recovery
- [ ] Keyboard shortcuts work (SPACE, B, D, I, etc.)

### Visual Requirements:
- [ ] Layout matches Pascal grid (123x77)
- [ ] Colors match Pascal scheme
- [ ] Text readable and aligned with Parallax font
- [ ] Heat maps display correctly with decay
- [ ] Smooth scrolling works
- [ ] Hex + disassembly always shown
- [ ] Windows cascade by COG ID

### Performance Requirements:
- [ ] < 50ms UI response time
- [ ] < 100ms for full window update
- [ ] Smooth scrolling at 30+ FPS
- [ ] Low CPU usage when idle
- [ ] Efficient message routing

### Test Coverage:
- [ ] 80%+ coverage for main window
- [ ] 100% coverage for WindowRouter
- [ ] 100% coverage for protocol handler
- [ ] 100% coverage for data manager
- [ ] 90%+ coverage for renderer
- [ ] All error paths tested

### Documentation:
- [ ] Comprehensive JSDoc
- [ ] Protocol specification documented
- [ ] Routing system documented
- [ ] Test examples referenced
- [ ] Technical debt documented
- [ ] Usage guide created

## Capture/Playback System Design

### Recording Architecture
The WindowRouter will include comprehensive recording capabilities from the start:

```typescript
interface RecordingMetadata {
  sessionId: string;
  timestamp: number;
  description: string;
  testScenario: string;
  expectedResults: string;
  p2Program: string;
  windowTypes: string[];
}

interface RecordedMessage {
  timestamp: number;
  windowId: string;
  windowType: string;
  direction: 'in' | 'out';
  data: any;
  checksum?: number;
}
```

### Storage Format
JSON Lines (.jsonl) for efficient streaming:
```json
{"type":"metadata","sessionId":"2024-01-15-001","description":"COG0 breakpoint test","p2Program":"test_debug.spin2"}
{"type":"message","timestamp":1234,"windowId":"debugger-0","data":[/* 20 longs */],"direction":"in"}
{"type":"message","timestamp":1235,"windowId":"scope-1","data":"SCOPE TRACE DATA...","direction":"in"}
{"type":"event","timestamp":1236,"event":"breakpoint-hit","cogId":0,"pc":0x1234}
```

### File Organization
```
tests/recordings/
├── catalog.json              # Master index of all recordings
├── debugger/
│   ├── single-step.jsonl     # Basic stepping test
│   ├── breakpoint-addr.jsonl # Address breakpoint test
│   ├── breakpoint-event.jsonl# Event breakpoint test
│   ├── multi-cog.jsonl       # Multi-COG coordination
│   └── error-recovery.jsonl  # Lost communication test
├── scope/
│   ├── trigger-test.jsonl
│   └── continuous.jsonl
├── mixed/
│   ├── full-session.jsonl    # Complete debug session
│   └── stress-test.jsonl     # Performance testing
└── regression/
    └── release-v1.0.jsonl     # Regression baseline
```

### Main Window UI Controls
New recording/playback controls in MainWindow:
1. **Record Button** → Opens dialog:
   - Session name/description
   - Test scenario selection
   - Window type checkboxes
   - P2 program identifier
   - Expected results notes

2. **Playback Button** → Opens catalog browser:
   - Tree view by category
   - Search/filter by keywords
   - Preview metadata
   - Playback speed control (0.5x, 1x, 2x, 5x)
   - Step-through mode for debugging

3. **Status Indicator**:
   - Recording: Red dot with timer
   - Playing: Green arrow with progress
   - File path and session info

### Benefits
- Full regression testing without hardware
- Reproducible bug reports
- Performance benchmarking
- Training/documentation examples
- CI/CD integration possible

## Planning Decisions - MainWindow Phase 0

### Resolved Questions:

1. **Binary File Selection Memory**: Per project/directory ✅
   - Follows VSCode pattern of remembering per workspace
   - More useful for multi-project development
   - Store in `.pnut-term/project.json`

2. **Echo Checkbox Behavior**: RESEARCH NEEDED ⚠️
   - TODO: Research what PST's echo actually does
   - Possibly echoes CR/LF behavior?
   - Must be answered before implementation

3. **Find Scope**: Active window only ✅
   - Searches just the main logging window
   - Special scrolling behavior needed:
     - Normal: Auto-scroll to show newest at bottom
     - When scrolling manually: Pause auto-scroll, keep recording
     - Single-click mechanism to resume auto-scroll
   - Buffer continues recording even when scrolled up

4. **ANSI Support Level**: Full VT100 with option ✅
   - Implement full VT100/ANSI (includes color control)
   - Checkbox option to limit to PST subset (16 control codes)
   - Default to full VT100 for maximum compatibility

5. **Paste Behavior**: Line ending conversion ✅
   - Paste goes into one-line transmit window
   - Settings for line ending conversion:
     - CR only
     - LF only  
     - CRLF
   - Convert to what P2 expects
   - Configurable in Preferences

6. **Recording Playback**: Create actual windows ✅
   - Always create actual windows for full system behavior
   - Essential for demos and teaching (U of Virginia use case)
   - Students can see complete debug system behavior
   - Portable demos - bring recording to customer
   - Cross-platform playback (Windows, Mac, Linux)

## Next Steps After Approval

### Research Findings - COMPLETED

#### 1. Electron Window Positioning - RESOLVED
**Finding**: Electron fully supports programmatic window positioning via BrowserWindow API.
**Implementation**:
```typescript
const debuggerWindow = new BrowserWindow({
  x: baseX + (debuggerId * chrHeight * 2),  // Pascal's cascade formula
  y: baseY + (debuggerId * chrHeight * 2),
  width: 123 * chrWidth,
  height: 77 * chrHeight,
  resizable: false,
  title: `Debugger - Cog ${debuggerId}`
});
```
**Decision**: Use Electron's native positioning - cleaner and more maintainable.

#### 2. Canvas Performance for 123x77 Grid - RESOLVED
**Finding**: Dirty rectangle tracking with layered rendering is optimal.
**Implementation Strategy**:
- **Primary**: Dirty rectangle tracking for changed regions (2-5ms updates)
- **Layers**: Separate static background and dynamic foreground
- **Heat Maps**: Use offscreen canvas for overlay effects
- **Text**: Batch rendering with single font setting
- **Avoid**: Virtual scrolling (unnecessary for 77 rows)

**Performance Expectations**:
- Full redraw: 15-25ms
- Typical update: 2-5ms
- With layers: 5-10ms

**Decision**: Start with dirty rectangles + layers, optimize if needed.

#### 3. Recording System - DESIGNED
- WindowRouter includes recording from start
- MainWindow gets record/playback UI
- JSON Lines format for streaming
- Catalog system for test management
- Enables full regression testing

### Implementation Start:
1. Create detailed task list with hour estimates
2. Set up unified WindowRouter infrastructure
3. Implement dual protocol handlers (binary + text)
4. Begin Phase 1 with research findings incorporated
5. Establish performance benchmarks

### Documentation to Create:
1. Protocol routing specification
2. Test data capture procedures
3. Performance optimization roadmap
4. Pascal parity tracking document
5. Keyboard shortcut reference

## How to Resume Tomorrow Morning

### Recommended Startup Sequence:
1. **Read These Documents** (in order):
   - `tasks/DEBUGGER_IMPLEMENTATION.md` - This complete plan with all decisions
   - `docs/ARCHITECTURE.md` - Project history, P2 capabilities, system design
   - `DOCs/ADDING-NEW-DEBUG-WINDOW.md` - Standard window addition process
   - Note: All research is complete, all decisions made

2. **Start with Phase 0 - MainWindow Infrastructure**:
   - Create detailed todo list for Phase 0 (13 tasks identified)
   - Each task with hour estimates
   - Begin with WindowRouter as foundation
   - This phase benefits ALL windows, not just debugger

3. **Phase 0 Priority Tasks**:
   - WindowRouter singleton implementation
   - --ide flag and adaptive UI
   - Theme system with PST/ANSI themes
   - Menu system implementation
   - Project-based settings (.pnut-term/)
   - Enhanced logging with configurable names
   - Basic recording for regression testing

4. **Then Phase 1-9 - Debugger Implementation**:
   - After Phase 0 complete, begin debugger-specific work
   - 9 phases already planned with time estimates
   - Total estimate: 156-240 hours for full debugger

### Key Documents Reference:
- **This Plan**: `/workspaces/PNut-Term-TS/tasks/DEBUGGER_IMPLEMENTATION.md`
- **Process Guide**: `/workspaces/PNut-Term-TS/DOCs/ADDING-NEW-DEBUG-WINDOW.md`
- **Pascal Source**: `/pascal-source/P2_PNut_Public/DebuggerUnit.pas`
- **Architecture**: `/workspaces/PNut-Term-TS/docs/ARCHITECTURE.md`

### Remember:
- Pascal parity is our north star
- WindowRouter benefits ALL windows
- Recording/playback system is built-in from start
- Time tracking on every task
- Test as we go, not at the end

## Notes on Differences from Other Debug Windows

**Unique Aspects**:
1. **Binary Protocol**: All other windows use text-based DEBUG commands. This uses binary.
2. **Bidirectional**: Other windows receive data only. This sends commands too.
3. **Stateful**: Maintains complex state about COG execution and breakpoints.
4. **Interactive**: Extensive mouse/keyboard interaction for debugging control.
5. **Multi-Instance**: Designed for up to 8 concurrent windows with COG-based routing.
6. **Performance Critical**: Must be responsive for interactive debugging.
7. **Unified Routing**: First window to use the new WindowRouter system.

**Shared Aspects**:
1. Uses CanvasRenderer for basic drawing
2. Uses ColorTranslator for color system
3. Extends DebugWindowBase for window management
4. Uses Electron BrowserWindow
5. Uses Parallax font

This window is essentially a complete debugger IDE within a window, making it the most complex debug window implementation. The unified routing system created for this window will benefit all debug windows by providing centralized, efficient message routing.