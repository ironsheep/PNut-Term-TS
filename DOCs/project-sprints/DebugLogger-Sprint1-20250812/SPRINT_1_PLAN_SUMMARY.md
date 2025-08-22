# Sprint 1 Plan Summary: Window Behavior Implementation

## Executive Summary
**Goal**: Implement the "Tall Thin Man" - the debug logger window and message routing system that makes everything work.
**Timeline**: Monday evening - Tuesday afternoon  
**Criticality**: HIGHEST - Without this, nothing else can be validated

## What We're Building

### The Three-Paradigm System
1. **PST Blue Terminal** (existing) - ANSI cursor control for terminal UIs
2. **Debug Windows** (existing) - Software-defined instrumentation (TERM, SCOPE, etc.)
3. **Debug Logger** (NEW) - High-speed logging terminal with visual feedback

### Core Components

#### 1. DebugLoggerWindow (NEW)
- **Visual**: Green (#00FF00) on black (#000000), 80x24 characters
- **Position**: Bottom-right of screen, aligned with MainWindow top
- **Behavior**: Auto-opens on first "CogN:" message
- **Features**: Output-only, shows log filename in status bar, high-performance buffering
- **Performance**: Must handle 16 Mbps aggregate (8 COGs × 2 Mbps each)

#### 2. Message Routing Logic (MODIFY)
- **Detection**: Intercept messages starting with "CogN:" (where N = 0-7)
- **Routing**: 
  - ALL Cog messages → Debug Logger (always)
  - ALL Cog messages → Log file (always)  
  - Cog messages with backticks → Specific debug windows
- **Key Change**: Cog messages NO LONGER go to blue terminal

#### 3. Window Placement System (NEW)
- **Algorithm**: Heads-up console pattern
- **Order**: MainWindow (bottom-center) → Logger (bottom-right) → Debug windows (fan from top)
- **Logging**: Inject `[WINDOW] Type_Name placed at (x,y) size WxH` entries
- **Purpose**: User can copy placement values for hardcoding in Spin2

## What We Know ✅

### From Code Analysis
- Message flow: `handleSerialRx()` → `rxQueue` → `processRxData()`
- Window base class: `DebugWindowBase` provides framework
- Router exists: `WindowRouter` handles registration
- Logger exists: `Logger` class for file I/O
- Command formats documented in class headers

### From Planning
- Exact visual specifications (colors, size, position)
- Performance requirements and buffering strategy
- Test program and expected behavior
- Message format: `"CogN: [content with possible backticks]"`

## What We Need to Verify 🔍

### Critical Unknowns

1. **Electron Window Creation**
   - [ ] How exactly do we create a new Electron BrowserWindow?
   - [ ] Where is the IPC communication set up?
   - [ ] How do we position relative to MainWindow?

2. **Message Interception Point**
   - [ ] Exact location in MainWindow to add Cog detection
   - [ ] How to prevent Cog messages from reaching blue terminal
   - [ ] Current backtick parsing location and method

3. **Window Registration**
   - [ ] How does WindowRouter track windows?
   - [ ] Window naming/ID strategy for routing
   - [ ] Lifecycle management (close, cleanup)

4. **File Logging**
   - [ ] Current log file location and naming
   - [ ] Async write implementation
   - [ ] Log rotation strategy

5. **Settings Integration**
   - [ ] How themes are stored and applied
   - [ ] Where to add logger preferences
   - [ ] Settings persistence mechanism

## Implementation Sequence

### Phase 0: Research (1-2 hours)
1. Study DebugTermWindow as reference implementation
2. Trace message flow in MainWindow
3. Understand WindowRouter registration
4. Check Electron window creation pattern

### Phase 1: DebugLoggerWindow (2-3 hours)
1. Create class extending DebugWindowBase
2. Implement green-on-black terminal display
3. Add output-only behavior (no input field)
4. Set up status bar with log filename

### Phase 2: Message Routing (2-3 hours)
1. Add Cog detection in MainWindow
2. Create/show DebugLoggerWindow on first Cog
3. Route Cog messages to logger
4. Maintain backtick parsing for debug windows

### Phase 3: Window Placement (1-2 hours)
1. Implement placement algorithm
2. Add [WINDOW] log injection
3. Test with multiple windows

### Phase 4: Performance & Polish (1-2 hours)
1. Add message buffering
2. Implement async file writes
3. Add theme support
4. Settings integration

## Test Strategy

### Test Program (Spin2)
```spin2
PUB main()
  debug(`TERM TestTerm SIZE 40 20)
  debug(`TestTerm "Hello from TERM window")
  waitms(2000)
  debug(`TestTerm CLOSE)
  
  debug(`LOGIC Signals 'CLK' 'DATA' 'CS')
  debug(`Signals long_value)
  waitms(2000)
  debug(`Signals CLOSE)
```

### Expected Results
1. DTR press starts execution
2. First "Cog0:" message opens Debug Logger window
3. TERM window auto-places at top-center
4. [WINDOW] log shows placement
5. Messages route correctly
6. Windows close as commanded

## Risk Assessment

### High Risk
- **Performance at 16 Mbps**: May need aggressive buffering
- **Electron API complexity**: Window positioning might be tricky

### Medium Risk  
- **Breaking existing routing**: Need careful testing
- **Multi-monitor support**: May need to defer

### Low Risk
- **Visual design**: Well specified
- **Message format**: Well understood

## Missing Details Analysis 🚨

### CRITICAL GAPS
1. **We don't know how to create an Electron window**
   - Need to study existing window creation
   - Find the IPC setup pattern

2. **We don't know the exact interception point**
   - Need to trace processRxData() in detail
   - Find where to add our Cog check

3. **We don't know how WindowRouter assigns IDs**
   - Need to understand window naming strategy
   - How to route "Cog0: `TestTerm" to the right window

### SHOULD KNOW
- Log file naming convention
- Settings storage format
- Theme application mechanism

### NICE TO KNOW
- Multi-monitor API
- Advanced placement options
- Performance optimization techniques

## Readiness Assessment

### Ready ✅
- Design specifications
- Test strategy
- Visual requirements
- Message formats

### Not Ready ❌
- Electron window creation pattern
- Exact code insertion points
- Window ID/routing strategy

## Next Actions Before Implementation

1. **MUST DO**: Study one complete window implementation (e.g., DebugTermWindow)
2. **MUST DO**: Trace MainWindow message processing to find insertion point
3. **MUST DO**: Understand WindowRouter registration and routing
4. **SHOULD DO**: Check Logger class for async writes
5. **SHOULD DO**: Find theme/settings patterns

## Go/No-Go Decision

**Current Status**: NOT READY for implementation

**Blocking Issues**:
1. Don't know how to create Electron windows
2. Don't know exact message interception point
3. Don't know window routing strategy

**Time to Ready**: 1-2 hours of code study

**Recommendation**: Spend next 1-2 hours studying existing code to fill critical gaps, then begin implementation.