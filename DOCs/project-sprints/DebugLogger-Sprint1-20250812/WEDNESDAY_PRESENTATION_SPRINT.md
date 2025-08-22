# Wednesday Presentation Sprint Plan

## Deadline
**Wednesday, 1400 Mountain Time** - Live presentation of PNut-Term-TS

## Revolutionary Feature Decision (FROZEN)
**Keep ALL THREE paradigms available simultaneously:**
1. PST blue terminal (ANSI/cursor control for terminal UIs)
2. Debug windows (software-defined instrumentation)  
3. Debug logger (high-speed logging with visual feedback)

**This is NEW** - No existing tool offers all three together. Users can build terminal UIs AND have debug visualization AND comprehensive logging.

## Critical Path Tasks

### Priority 1: Debug Logger Window Implementation
**Timeline**: Monday evening - Tuesday morning

#### DebugLoggerWindow Specifications
- **Visual**: Themeable (green-on-black default, amber-on-black option)
- **Position**: Bottom-right, aligned with MainWindow top
- **Size**: 80 columns × 24 lines (640×400 pixels)
- **Features**:
  - Output-only (no input field)
  - Status bar with log filename
  - High-performance buffering (handle 16 Mbps aggregate)
  - Batch DOM updates every 16ms
  - Asynchronous file I/O
  - Auto-opens on first "CogN:" message

#### Message Routing Logic
1. **Cog Detection**: When "CogN:" prefix detected
   - Auto-create debug logger if not exists
   - Route ALL Cog messages to logger (NOT blue terminal)
   - Blue terminal remains for non-debug I/O
2. **Window Creation**: Parse Cog content for backtick commands
   - Example: `"Cog0: `TERM MyTerm SIZE 80 24"`
   - Create window and register with router
3. **Message Distribution**: Route to three places
   - Debug logger window (always)
   - Log file (always)
   - Specific debug window (when applicable)

#### Window Placement Logging
- Inject `[WINDOW]` prefixed entries in log
- Format: `[WINDOW] Term_MyDisplay placed at (320, 240) size 800x600`
- User can copy values to debug() POS statements

### Priority 2: Window Auto-Placement System
**Timeline**: Tuesday morning

#### Heads-Up Console Pattern
```
Order:  [4]     [1]     [5]
        [6]     [2]     [7]
                [3]
        [Main]      [Logger]
```

#### Placement Rules
- **MainWindow**: Bottom-center of display
- **Debug Logger**: Bottom-right (80×24)
- **Debug Windows**: Fan out from top-center
  1. Top-center (most important)
  2. Left-of-center
  3. Top-right
  4. Top-left
  5. Right-of-center (row 2)
  6. Left-of-center (row 2)
  7. Bottom-center

#### Multi-Monitor Support (Research)
- Use Electron's `screen` API
- Detect all displays and boundaries
- Enable monitor preference specification

### Priority 3: Spectro Window Port
**Timeline**: Tuesday afternoon
1. Port from Pascal source (DebugDisplayUnit.pas)
2. Implement spectrogram display
   - 4-2048 point FFT
   - Windowed results
   - Phase coloring
   - Log scale mode
3. Add to window router registration
4. Test with sample data

### Priority 3: Flash Download Support (If Time Permits)
**Timeline**: Wednesday morning (if ahead of schedule)
1. Implement flash download protocol in Downloader class
2. Add menu option and keyboard shortcut
3. Test with actual P2 hardware

## Development Strategy

### Monday (Today)
- Evening: Start debug logger window implementation
- Focus on getting CogN: message detection working

### Tuesday (Full Day)
- Morning: Complete debug logger and routing
- Afternoon: Port Spectro window
- Evening: Integration testing, bug fixes

### Wednesday Morning
- Final testing and polish
- Flash download if time available
- Prepare for 1400 presentation

## Risk Mitigation
- Flash download is "nice to have" - can demo with RAM download
- Spectro window can be shown as "in progress" if needed
- Debug logger is CRITICAL - this shows the architecture working correctly

## Success Criteria
1. ✅ Debug messages route to separate debug logger window
2. ✅ All CogN: prefixed messages logged to files
3. ✅ Specialized debug windows still work (TERM, SCOPE, etc.)
4. ✅ Clear visual distinction between PST and Debug modes
5. ⭕ Spectro window functional (stretch)
6. ⭕ Flash download working (stretch)