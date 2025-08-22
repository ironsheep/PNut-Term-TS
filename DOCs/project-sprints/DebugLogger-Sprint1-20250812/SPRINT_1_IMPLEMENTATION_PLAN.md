# Sprint 1 Implementation Plan: Window Behavior

## Implementation Task List

### Phase 0: Code Study & Understanding (1-2 hours)
**Objective**: Fill knowledge gaps before coding begins

#### Task 1: Study Window Creation Pattern
- [ ] Open `DebugTermWindow` class and trace its lifecycle
- [ ] Understand how it extends `DebugWindowBase`
- [ ] Find where Electron BrowserWindow is created
- [ ] Document the IPC communication setup
- [ ] Note how window registers with WindowRouter

**Key Questions to Answer:**
- How does a debug window get created from a debug command?
- What's the inheritance hierarchy?
- Where is the Electron window instantiated?
- How does data flow from MainWindow to debug window?

---

### Phase 1: Create DebugLoggerWindow (2-3 hours)
**Objective**: Build the green-on-black debug logger terminal

#### Task 2: Create DebugLoggerWindow Class
- [ ] Create new file: `src/classes/debugLoggerWindow.ts`
- [ ] Extend DebugWindowBase
- [ ] Define window specifications:
  - 80 columns × 24 rows
  - Green (#00FF00) on black (#000000)
  - Monospace font (Consolas/Courier)
  - Output-only (no input field)
- [ ] Implement constructor with default position (bottom-right)
- [ ] Add status bar showing log filename
- [ ] Implement `appendMessage()` method
- [ ] Add circular buffer for display (10,000 lines)

**Success Criteria:**
- Window can be instantiated
- Shows green text on black background
- Can append and display messages
- Status bar shows current log file

---

### Phase 2: Message Routing System (2-3 hours)
**Objective**: Intercept Cog messages and route appropriately

#### Task 3: Update MainWindow Message Detection
- [ ] Locate `processRxData()` or equivalent in MainWindow
- [ ] Add Cog prefix detection: `if (message.startsWith('Cog'))`
- [ ] Create DebugLoggerWindow on first Cog message
- [ ] Route Cog messages to logger (NOT blue terminal)
- [ ] Preserve non-Cog message routing to blue terminal

**Code Location Targets:**
- `src/classes/mainWindow.ts` - handleSerialRx() and processRxData()
- Find where backtick commands are currently parsed
- Ensure backward compatibility for existing behavior

#### Task 4: Implement Window Placement Logging
- [ ] Create `logWindowPlacement()` function
- [ ] Format: `[WINDOW] Type_Name placed at (x,y) size WxH`
- [ ] Inject into debug logger display
- [ ] Also write to log file
- [ ] Call after each window creation

**Success Criteria:**
- All Cog messages appear in debug logger
- No Cog messages appear in blue terminal
- Placement logs show for all windows
- Non-Cog messages still work normally

---

### Phase 3: Window Command Routing (1-2 hours)
**Objective**: Ensure window creation and updates work

#### Task 5: Verify WindowRouter Integration
- [ ] Ensure WindowRouter creates windows from Cog messages
- [ ] Parse embedded backtick commands correctly
- [ ] Route to BOTH log AND specific window
- [ ] Test window creation: `Cog0: `TERM MyTerm SIZE 80 24`
- [ ] Test window updates: `Cog0: `MyTerm 'Hello'`

**Test Cases:**
- Create multiple window types
- Send updates to named windows
- Verify all messages also go to logger
- Check window close commands work

---

### Phase 4: Auto-Placement Algorithm (1-2 hours)
**Objective**: Implement heads-up console pattern

#### Task 6: Research Electron Screen API
- [ ] Import Electron screen module
- [ ] Get display dimensions and work area
- [ ] Calculate available space for windows
- [ ] Handle multi-monitor detection (if time)

#### Task 7: Implement Placement Algorithm
- [ ] Create WindowPlacer class
- [ ] Define slot positions:
  1. MainWindow: bottom-center (fixed)
  2. DebugLogger: bottom-right (fixed)
  3. First debug: top-center
  4. Second: left-of-center
  5. Third: right-of-center
  6. Continue pattern...
- [ ] Track occupied slots
- [ ] Return next available position
- [ ] Add 20px spacing between windows

**Success Criteria:**
- Windows don't overlap
- Placement follows heads-up pattern
- Works on single monitor
- Logs show correct positions

---

### Phase 5: Theme & Settings (1 hour)
**Objective**: Add configuration options

#### Task 8: Add Theme Support
- [ ] Define theme interface (green/amber/custom)
- [ ] Add theme switching method
- [ ] Store preference in settings
- [ ] Apply on window creation

#### Task 9: Extend Settings UI
- [ ] Add "Debug Logger" section to settings
- [ ] Theme dropdown (Green/Amber)
- [ ] Font size control
- [ ] Buffer size setting
- [ ] Log directory setting

**Success Criteria:**
- Can switch between green and amber themes
- Settings persist between sessions
- UI reflects current settings

---

### Phase 6: Testing & Validation (2 hours)
**Objective**: Verify everything works with real data

#### Task 10: Test with Sprint 1 Demo Program
```spin2
PUB main()
  debug("Starting test")  ' Should open logger
  debug(`TERM TestTerm SIZE 40 20)
  debug(`TestTerm "Hello from TERM")
  waitms(2000)
  debug(`TestTerm CLOSE)
  debug(`LOGIC Signals 'CLK' 'DATA')
  debug(`Signals long value)
  debug("Test complete")
```

**Validation Checklist:**
- [ ] Debug logger opens on first message
- [ ] All Cog messages appear in logger
- [ ] TERM window creates and places
- [ ] LOGIC window creates and places
- [ ] [WINDOW] logs show positions
- [ ] Windows close when commanded
- [ ] Log files created in ./logs/
- [ ] Performance is acceptable

---

## Time Allocation

| Phase | Tasks | Estimated Time | Priority |
|-------|-------|---------------|----------|
| 0 | Study existing code | 1-2 hours | CRITICAL |
| 1 | Create DebugLoggerWindow | 2-3 hours | CRITICAL |
| 2 | Message routing | 2-3 hours | CRITICAL |
| 3 | Window command routing | 1-2 hours | HIGH |
| 4 | Auto-placement | 1-2 hours | HIGH |
| 5 | Theme & settings | 1 hour | MEDIUM |
| 6 | Testing | 2 hours | CRITICAL |
| **Total** | | **10-15 hours** | |

## Current Status
- Planning: COMPLETE ✅
- Ready to begin: Phase 0 (Code Study)
- Blockers: Need to understand existing patterns

## Next Immediate Actions
1. Open and study DebugTermWindow implementation
2. Trace MainWindow message flow
3. Understand WindowRouter registration
4. Document findings
5. Begin DebugLoggerWindow implementation

## Definition of Done
Sprint 1 is complete when:
- [ ] Debug logger window auto-opens on Cog messages
- [ ] All routing works correctly
- [ ] Window placement is clean
- [ ] Logs are being written
- [ ] Real P2 test passes
- [ ] No regressions in existing functionality