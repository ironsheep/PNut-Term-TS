# Sprint 3: Flash Download and Demo Wrap-up

## Sprint Overview
**Focus**: Flash download support + comprehensive demo validation
**Timeline**: Wednesday morning (if time permits)
**Goal**: Polish for 1400 Mountain Time presentation
**Priority**: Demo readiness over feature completeness

## Sprint Components

### Component 1: Flash Download Support (Optional)

#### Why Flash Matters
- Shows complete download capability (RAM + Flash)
- Enables persistent programs on P2
- Professional feature for production use
- But NOT required for successful demo

#### Implementation Tasks
1. **Downloader Class Enhancement**
   - Add flash protocol support
   - Implement flash write sequence
   - Handle verification
   
2. **UI Integration**
   - Menu option: "Download to Flash (F10)"
   - Keyboard shortcut: Ctrl+F
   - Progress indication
   
3. **Testing**
   - Verify flash write works
   - Confirm program runs after power cycle
   - Test with demo programs

### Component 2: Cog Output Splitter Feature (NEW)

#### Overview
A powerful multi-cog debugging feature that automatically splits Cog-prefixed messages into separate windows for each of the 8 cogs, providing clear isolation of each cog's output stream.

#### Feature Design
- **Activation**: Toggle button in main toolbar (same importance as Record button): "Split Cog Output"
- **Window Layout**: Fixed 2x4 grid (4 columns × 2 rows)
  - Row 1: Cog 0, Cog 1, Cog 2, Cog 3
  - Row 2: Cog 4, Cog 5, Cog 6, Cog 7
- **Window Sizing**: 
  - Height: Half the height of Debug Logger window
  - Width: Same as Debug Logger, or shrink to fit 4 columns (e.g., 64 chars wide)
  - Auto-calculate based on screen real estate
- **Window Creation**: On-demand - windows only appear when messages from that cog are detected
- **Ghost Windows**: Optional placeholder windows for inactive cogs
  - Shows "No traffic received from Cog N" or "Window hidden"
  - Setting: "Show ghost windows for inactive cogs"
  - Ghost windows have close buttons

#### Implementation Details

##### Window Management
- Windows are lightweight with minimal menu
- Auto-create on first message from a cog
- Fixed position in grid based on cog number
- On close, dialog asks: "Close for this session only, or hide until new traffic?"
  - Session close: Won't reopen this run
  - Hide: Will reopen when new messages arrive
- "Close All Cog Windows" button in main toolbar
- Each window has own message queue for independent throttling

##### Message Routing
- Parse "CogN:" prefix from incoming messages
- Route to appropriate window (0-7)
- Keep raw "CogN:" prefix in display (visual confirmation)
- Continue routing to main Debug Logger for complete audit trail
- Debug Logger remains unchanged - full log of everything

##### Performance Optimization
- Each window has its own message queue
- Windows manage their own throttling independently
- Batch updates every 16ms (60fps)
- Circular buffer per window (5000 lines default, configurable)
- Minimal DOM updates using diff algorithm
- Suspend updates for minimized/hidden windows

##### Visual Design
- Window titles: "Cog 0 Debug Output", "Cog 1 Debug Output", etc.
  - Clearly indicates filtered/isolated nature
- Color coding: Each cog gets a distinct color theme
  - Cog 0: Blue theme
  - Cog 1: Green theme
  - Cog 2: Orange theme
  - Cog 3: Purple theme
  - Cog 4: Cyan theme
  - Cog 5: Yellow theme
  - Cog 6: Red theme
  - Cog 7: Magenta theme
- Minimal menu with key functions:
  - Clear buffer
  - Dump to log (saves entire history with filename: `Cog0_YYYYMMDD_HHMMSS.log`)
  - Scrollback lines setting (default 5000, configurable per window)
  - Line numbers toggle
- Global controls in main window:
  - Show/hide entire cog window array
  - Show/hide ghost windows for inactive cogs

##### User Experience
```
When disabled (default):
┌─────────────────────────────┐
│      Debug Logger           │
│ Cog0: Init complete         │
│ Cog1: Sensor reading: 42    │
│ Cog0: Processing...         │
│ Cog2: Motor started         │
└─────────────────────────────┘

When enabled:
┌──────┬──────┬──────┬──────┐
│ Cog0 │ Cog1 │ Cog2 │ Cog3 │
│Init  │Sensor│Motor │      │
│comp. │read: │start │      │
│Proc..│42    │      │      │
└──────┴──────┴──────┴──────┘
┌──────┬──────┬──────┬──────┐
│ Cog4 │ Cog5 │ Cog6 │ Cog7 │
│      │      │      │      │
└──────┴──────┴──────┴──────┘
```

#### Benefits
- **Clear Separation**: Each cog's output isolated for easy analysis
- **Pattern Recognition**: Easier to spot patterns in individual cog behavior
- **Debugging Multi-Cog**: Essential for complex multi-cog applications
- **Performance**: No interleaved message confusion
- **Optional**: Can be toggled on/off based on debugging needs

### Component 3: Universal Logging Standards

#### Overview
Establish consistent logging standards across all features that write log files, ensuring clarity and organization.

#### Logging File Naming Convention
All log files must follow this pattern:
```
{ContextPrefix}_{YYYYMMDD}_{HHMMSS}.log
```

#### Context Prefixes by Feature
- **Debug Logger**: `DebugCapture_YYYYMMDD_HHMMSS.log`
- **Cog Windows**: `Cog0_YYYYMMDD_HHMMSS.log` through `Cog7_YYYYMMDD_HHMMSS.log`
- **Recording/Playback**: `Recording_YYYYMMDD_HHMMSS.jsonl`
- **Terminal Windows**: `Term_{WindowName}_YYYYMMDD_HHMMSS.log`
- **Scope Windows**: `Scope_{WindowName}_YYYYMMDD_HHMMSS.csv`
- **Logic Windows**: `Logic_{WindowName}_YYYYMMDD_HHMMSS.vcd`
- **Error Logs**: `Error_YYYYMMDD_HHMMSS.log`
- **Performance Logs**: `Performance_YYYYMMDD_HHMMSS.log`

#### Timestamp Requirements
- **File Creation**: Include timestamp in filename (as shown above)
- **Log Entries**: Each line must start with timestamp
  - Format: `[YYYY-MM-DD HH:MM:SS.mmm]` for millisecond precision
  - Alternative: `[HH:MM:SS.mmm]` for same-day logs where date is in filename
- **Session Markers**: Start and end of logging sessions marked with:
  ```
  [2025-08-14 09:30:45.123] * LOG_START - {reason}
  [2025-08-14 10:45:22.789] * LOG_END - {reason}
  ```

#### Log Directory Organization
```
Logs/
├── DebugCapture_20250814_093045.log      # Main debug logger
├── Cog0_20250814_094512.log              # Cog-specific dump
├── Cog1_20250814_094515.log              # Cog-specific dump
├── Recording_20250814_095000.jsonl        # Session recording
└── archive/                               # Older logs moved here
    └── DebugCapture_20250813_143022.log
```

#### Implementation Requirements
- All features that create logs must use these standards
- Log creation functions should be centralized in a LogFileManager class
- Settings should allow customizing the Logs/ directory location
- Automatic archiving of logs older than N days (configurable)

### Component 4: ANSI Keyword Highlighting

#### Overview
Enhance ANSI terminal mode with user-configurable keyword highlighting that automatically colors specific words or patterns in the output stream for immediate visual recognition.

#### Feature Design
- **Purpose**: Draw immediate attention to important keywords like errors, warnings, successes
- **Activation**: Only active when terminal is in ANSI mode
- **Configuration**: User-editable list of keywords with associated colors

#### Implementation Details

##### Keyword Configuration
- **Default Keywords**:
  - `ERROR`, `error`, `Error` → Red (#FF0000)
  - `WARNING`, `warning`, `Warning` → Yellow (#FFD700)
  - `PASS`, `pass`, `Pass`, `SUCCESS`, `success` → Green (#00FF00)
  - `FAIL`, `fail`, `Fail`, `FAILURE`, `failure` → Red (#FF0000)
  - `INFO`, `info`, `Info` → Cyan (#00FFFF)
  - `DEBUG`, `debug`, `Debug` → Magenta (#FF00FF)
  - `NOTE`, `note`, `Note` → Blue (#0080FF)
  - `TODO`, `todo`, `Todo` → Orange (#FFA500)
  - `FIXME`, `fixme`, `Fixme` → Red background with white text
  - `HACK`, `hack`, `Hack` → Yellow background with black text

##### Settings Dialog Integration
- **New Tab**: "ANSI Keywords" tab in settings dialog
- **UI Elements**:
  ```
  ┌─────────────────────────────────────────┐
  │ ANSI Keyword Highlighting Configuration │
  ├─────────────────────────────────────────┤
  │ Keyword List:                           │
  │ ┌───────────────────────────────────┐  │
  │ │ ERROR     [Red    ▼] [Delete]     │  │
  │ │ WARNING   [Yellow ▼] [Delete]     │  │
  │ │ PASS      [Green  ▼] [Delete]     │  │
  │ │ custom1   [Blue   ▼] [Delete]     │  │
  │ └───────────────────────────────────┘  │
  │                                         │
  │ Add New Keyword:                       │
  │ [___________] [Color ▼] [Add]         │
  │                                         │
  │ Options:                                │
  │ ☑ Case sensitive matching               │
  │ ☑ Whole word matching only             │
  │ ☑ Enable keyword highlighting          │
  │                                         │
  │ [Reset to Defaults]                    │
  └─────────────────────────────────────────┘
  ```

##### Color Options
- Predefined color palette with semantic names:
  - Red, Green, Blue, Yellow, Cyan, Magenta, Orange
  - Light/Dark variants of each
  - Background highlight options
- Custom RGB color picker for advanced users

##### Storage Format
**PROJECT-SPECIFIC**: Keywords are stored per-project in `.pnut-term-ts.json` at project root
```json
{
  "ansiKeywords": [
    {
      "pattern": "ERROR",
      "color": "#FF0000",
      "background": false,
      "caseSensitive": false,
      "wholeWord": true
    },
    {
      "pattern": "WARNING",
      "color": "#FFD700",
      "background": false,
      "caseSensitive": false,
      "wholeWord": true
    }
  ],
  "ansiKeywordEnabled": true,
  "ansiKeywordCaseSensitive": false,
  "ansiKeywordWholeWord": true
}
```

##### Project-Specific Behavior
- Keywords are **per-project**, not global
- Each project maintains its own `.pnut-term-ts.json` file
- First time setup: Copy global defaults to project
- "Reset to Defaults" button restores factory defaults for THIS project
- Projects can have completely different keyword sets based on their needs:
  - Sensor project: "TEMP", "HUMIDITY", "PRESSURE" 
  - Motor control: "RPM", "STALL", "OVERCURRENT"
  - Game project: "COLLISION", "SPAWN", "GAMEOVER"

##### Processing Algorithm
1. When in ANSI mode, scan incoming text for keywords
2. Apply color codes before rendering
3. Preserve existing ANSI codes in the stream
4. Handle overlapping keywords (first match wins)
5. Optimize for performance with caching

##### User Experience
- Keywords highlighted in real-time as data streams in
- Visual feedback in settings when adding/removing keywords
- Import/Export keyword sets for sharing
- Preset themes (Development, Testing, Production)

### Component 5: Settings Dialog UX Improvements

#### Overview
Fix the settings dialog layout issues and improve overall dialog UX across the application.

#### Settings Dialog Fix
- **Problem**: OK/Cancel buttons scroll with content instead of staying fixed
- **Solution**: 
  ```css
  .settings-dialog {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 20px;
  }
  .settings-buttons {
    position: sticky;
    bottom: 0;
    background: white;
    border-top: 1px solid #ccc;
    padding: 10px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  ```

#### Dialog Audit Plan
1. **Inventory All Dialogs**:
   - Settings Dialog (make live)
   - About Dialog
   - Error Dialogs
   - Confirmation Dialogs
   - File Dialogs
   
2. **Consistent Look & Feel**:
   - Standardize button placement (OK always right)
   - Consistent padding/margins
   - Uniform color scheme
   - Consistent font sizes
   - Proper tab order for keyboard navigation

3. **Improvements**:
   - Add keyboard shortcuts (Enter = OK, Escape = Cancel)
   - Proper focus management
   - Responsive sizing
   - Dark mode support where applicable
   - Loading states for async operations

### Component 6: Download Mode Persistence

#### Overview
Add RAM/FLASH download mode persistence to project settings JSON file with UI controls in settings dialog.

#### Implementation
- **Settings File**: `.pnut-term-ts.json` in project directory
- **Setting Structure**:
  ```json
  {
    "downloadMode": "RAM" | "FLASH",
    "terminalFont": "default" | "parallax" | "ibm3270" | etc,
    "terminalMode": "PST" | "ANSI",
    "cogSplitterEnabled": false,
    "ansiKeywords": [...],
    "windowPlacements": { ... }
  }
  ```
- **UI Integration**: 
  - Settings dialog with download mode radio buttons
  - Font selector dropdown (already implemented in toolbar)
  - Terminal mode toggle (PST vs ANSI)
  - Cog splitter checkbox
  - ANSI keywords configuration tab
- **Persistence**: Save on change, load on startup

### Component 7: Comprehensive Window Testing

#### Test All 10 Debug Windows
```spin2
' Comprehensive debug window test
PUB demo_all_windows()
  ' Create each window type
  debug(`TERM Term1 SIZE 40 20 POS 100 100)
  debug(`SCOPE Scope1 SIZE 256 200 SAMPLES 512)
  debug(`LOGIC Logic1 SAMPLES 64 'CLK' 'DATA')
  debug(`PLOT Plot1 SIZE 300 300)
  debug(`BITMAP Bitmap1 SIZE 128 128 DEPTH 8)
  debug(`FFT FFT1 SAMPLES 256)
  debug(`SPECTRO Spectro1 SAMPLES 512)  ' If implemented
  debug(`MIDI Midi1 KEYS 88)
  debug(`SCOPE_XY XY1 SIZE 256 256)
  ' Note: DEBUGGER windows are created differently
  
  ' Update each with sample data
  repeat 100
    debug(`Term1 "Count: ", udec(cnt))
    debug(`Scope1 word sin(cnt))
    debug(`Logic1 long cnt)
    ' ... etc for each window
    waitms(50)
```

#### Validation Points
- All windows create successfully
- Auto-placement creates "heads-up console"
- No window overlaps
- [WINDOW] logs for each placement
- All windows update correctly
- Performance remains smooth

### Component 3: Demo Polish

#### Performance Optimization
- Ensure 16 Mbps data rate handling
- Verify no UI freezing
- Check memory usage
- Optimize any bottlenecks

#### Visual Polish
- Window positioning perfect
- Theme switching smooth
- Log file formatting clean
- Status displays accurate

#### Error Handling
- Graceful handling of bad commands
- Recovery from window errors
- Clear error messages
- No crashes during demo

### Component 4: Demo Script Preparation

#### Scenario 1: Basic Debug Logging
1. Connect to P2
2. DTR reset to start from flash
3. Show debug logger auto-opening
4. Display Cog messages streaming
5. Show log file being written

#### Scenario 2: Window Creation
1. Run TERM + LOGIC demo
2. Show auto-placement
3. Point out [WINDOW] logs
4. Copy placement values
5. Show hardcoded positioning

#### Scenario 3: Multiple Windows
1. Run all-windows demo
2. Show heads-up console formation
3. Demonstrate no overlaps
4. Show each window updating
5. Highlight performance

#### Scenario 4: Three Paradigms
1. Show PST blue terminal (cursor control)
2. Show debug windows (instrumentation)
3. Show debug logger (high-speed capture)
4. Explain revolutionary combination

## Success Criteria

### Must Have (Demo Critical)
- [ ] All implemented windows work
- [ ] Auto-placement is clean
- [ ] No crashes or freezes
- [ ] Performance is smooth
- [ ] Logs are capturing correctly
- [ ] Settings dialog OK/Cancel buttons stay visible

### Should Have
- [ ] Flash download works
- [ ] All 10 windows demonstrated
- [ ] Theme switching shown
- [ ] Multi-monitor support shown
- [ ] ANSI keyword highlighting functional
- [ ] Cog Output Splitter working
- [ ] Dialog UX consistency achieved

### Nice to Have
- [ ] Spectro window complete
- [ ] Advanced placement options
- [ ] Settings persistence
- [ ] Session recording/playback
- [ ] Full ANSI keyword configuration UI
- [ ] Import/Export keyword sets

## Risk Mitigation

### Risk: Flash Download Not Ready
- **Impact**: Minor - can demo with RAM only
- **Mitigation**: Focus on RAM download
- **Message**: "Flash coming in next release"

### Risk: Performance Issues
- **Impact**: Major - bad demo experience
- **Mitigation**: Test with real P2 early
- **Fallback**: Reduce data rate for demo

### Risk: Window Placement Bugs
- **Impact**: Moderate - looks unprofessional
- **Mitigation**: Test all combinations
- **Fallback**: Manual placement option

### Risk: Time Constraint
- **Impact**: Major - incomplete demo
- **Mitigation**: Focus on Sprint 1 first
- **Fallback**: Show what works, roadmap rest

## Demo Day Checklist

### Technical Setup
- [ ] P2 hardware connected and tested
- [ ] Flash programmed with demo code
- [ ] PNut-Term-TS built and ready
- [ ] Backup computer prepared
- [ ] Screen recording software ready

### Demo Programs Ready
- [ ] Simple TERM + LOGIC demo
- [ ] All windows demo
- [ ] Performance stress test
- [ ] Terminal UI example (PST mode)

### Presentation Materials
- [ ] Architecture slides
- [ ] Live demo script
- [ ] Backup video of working system
- [ ] Feature comparison chart
- [ ] Roadmap slide

### Contingency Plans
- [ ] If P2 fails: Use recorded video
- [ ] If software crashes: Have backup build
- [ ] If windows misplace: Show manual positioning
- [ ] If performance lags: Explain optimization coming

## Post-Demo Tasks
- Gather feedback
- Prioritize fixes
- Plan next release
- Update documentation
- Prepare for community release

## Definition of Done

### Sprint 3 Complete When:
1. Demo runs without crashes
2. All test scenarios work
3. Presentation materials ready
4. Backup plans in place
5. Team confident in demo

### Demo Success Metrics:
- Audience understands three paradigms
- Revolutionary nature is clear
- Technical achievement recognized
- Path forward is defined
- Community excitement generated