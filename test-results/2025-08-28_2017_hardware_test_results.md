# Hardware Test Results - August 28, 2025 @ 20:17 PST

## Test Environment
- Device: /dev/tty.usbserial-P9cektn7 (Parallax Prop Plug)
- Build: Version 0.1.0, Build date: 8/28/2025
- Platform: macOS
- Test Duration: ~5 minutes with multiple DTR reset attempts

## Positive Results ✅

### 1. DTR Signal Reaching Hardware
**FIRST SUCCESS**: DTR is actually getting through to the USB device and resetting the processor
- This is the first time DTR has successfully reset the P2 hardware
- Console shows new message traffic after DTR press
- Hardware responds correctly to the DTR signal

### 2. Debugger Message Formatting Working
- 80-byte debugger packets displaying correctly in Debug Logger
- Format: 32 bytes per line with 3-digit hex offsets
- Proper spacing: single space after 8 bytes, double space after 16 bytes
- No ASCII interpretation (as requested)
- Example output shows Cog 1 debugger data formatted perfectly

### 3. Message Routing Partially Working
- COG messages routing to Debug Logger successfully
- DEBUGGER_80BYTE packets routing to 2 destinations (debugger + logger)
- Initial messages displaying in Debug Logger with timestamps

## Critical Issues ❌

### 1. DTR Button Behavior Wrong
**Current (WRONG) Behavior:**
- Acts as momentary button
- Asserts DTR on press
- Times out and auto-releases DTR
- Checkbox state not changing

**Expected Behavior:**
- Toggle button (not momentary)
- First press: Assert DTR + check checkbox
- Second press: De-assert DTR + uncheck checkbox
- DTR should STAY asserted until manually toggled off

### 2. Debug Logger Not Handling DTR Reset
**Missing Behaviors:**
- Debug Logger not clearing on DTR reset
- Not completing current log and starting new log file
- Not displaying "DTR was pressed" comment at top
- After 3 processor resets, no new messages appeared in Debug Logger

**Console Evidence:**
- Console shows new message traffic after DTR
- Messages NOT reaching Debug Logger window
- Routing failure after DTR reset

### 3. Menu Still Not Displaying
- HTML menu bar remains invisible
- Toolbar script errors continuing

### 4. Checkbox IPC Not Working
- DTR checkbox state not updating when button pressed
- IPC communication for checkbox state appears broken

## Console Errors

```
[UI UPDATE] ❌ Failed to execute toolbar-event-handlers: Error: Script failed to execute
```

## Analysis of Root Causes

### DTR Button Issue
The DTR implementation has auto-timeout logic that needs removal. Looking at mainWindow.ts lines 2244-2253, the current code likely has setTimeout() releasing DTR automatically. Need to:
1. Remove any setTimeout() for auto-release
2. Implement proper toggle state tracking
3. Update checkbox via IPC when state changes

### Debug Logger Reset Issue
The Debug Logger has handleDTRReset() and handleRTSReset() methods but they're not being called when DTR occurs. The routing stops working after DTR reset because:
1. DTR/RTS reset events not propagating to Debug Logger
2. Message routing may be interrupted by reset
3. Debug Logger not re-registering after reset

### Message Routing After Reset
Console shows messages arriving but Debug Logger not receiving them. Possible causes:
1. WindowRouter losing window reference after DTR
2. Message queue being cleared inappropriately
3. Debug Logger not maintaining registration after reset event

## Next Priority Fixes

1. **Fix DTR Toggle Behavior** (mainWindow.ts)
   - Remove auto-release timeout
   - Implement toggle state variable
   - Update checkbox on state change

2. **Fix DTR Reset Propagation** (debugLoggerWin.ts)
   - Ensure handleDTRReset() is called
   - Clear display and complete log
   - Add "DTR RESET" marker to new log

3. **Fix Post-Reset Routing**
   - Maintain window registration after reset
   - Ensure message routing continues after DTR

## Test Session Summary
- **Progress**: DTR finally reaching hardware! Formatting perfect!
- **Regression**: DTR behavior wrong, reset handling missing
- **Critical Path**: Fix DTR toggle → Fix reset propagation → Fix post-reset routing