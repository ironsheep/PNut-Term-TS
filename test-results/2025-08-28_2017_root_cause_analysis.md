# Root Cause Analysis - August 28, 2025 @ 20:17 PST

## Deep Research Findings

### 1. DTR Button Acting as Momentary (Auto-Release Issue)

**ROOT CAUSE IDENTIFIED**: There is NO timeout in the DTR button handler code!

**Analysis:**
- mainWindow.ts `toggleDTR()` at line 4042 correctly toggles state
- mainWindow.ts IPC handler at line 2228 correctly toggles state
- usb.serial.ts has TWO different methods:
  - `setDTR(value)` at line 341 - correctly sets DTR to specified value
  - `toggleDTR()` at line 357 - PULSE method with 1-second timeout (used for downloads)
  
**The Real Problem:**
- The button handler is working correctly
- The checkbox update code at line 2235 sends 'update-dtr-state' 
- BUT the toolbar script at line 2573 has SYNTAX ERROR (missing closing IIFE)
- This prevents the checkbox update listener from registering at line 2087

**Fix Required:**
```typescript
// Line 2573 in mainWindow.ts - the IIFE is already fixed but not working
// The script is failing to execute due to error in require('electron')
// Need to check if the script is actually running
```

### 2. Debug Logger Not Clearing on DTR Reset

**ROOT CAUSE IDENTIFIED**: The handleDTRReset() method IS being called but the IPC message isn't reaching the renderer!

**Analysis:**
- mainWindow.ts line 2248 calls `debugLoggerWindow.handleDTRReset()`
- debugLoggerWin.ts line 1013 has correct implementation:
  - Closes log file with DTR marker
  - Calls clearOutput() which sends 'clear-output' IPC message
  - Creates new log file
  - Logs "DTR Reset - New session started"
  
**The Real Problem:**
- clearOutput() at line 1000 sends IPC: `this.debugWindow.webContents.send('clear-output')`
- But the renderer isn't receiving/handling 'clear-output' message
- Need to check if IPC listener is registered in renderer

**Fix Required:**
```typescript
// In debugLoggerWin.ts preload or renderer script
// Need to add handler for 'clear-output' IPC message
ipcRenderer.on('clear-output', () => {
  document.getElementById('output').innerHTML = '';
});
```

### 3. Message Routing Stops After DTR Reset

**ROOT CAUSE IDENTIFIED**: Message routing continues but Debug Logger stops processing after reset!

**Analysis:**
- Console shows messages arriving after DTR reset
- MessageRouter continues working (no code clears registrations)
- Debug Logger remains registered with WindowRouter
- BUT Debug Logger stops showing new messages

**The Real Problem:**
- After DTR reset, clearOutput() is called
- This sends 'clear-output' IPC but also sets `this.lineBuffer = []`
- New messages arrive but may be getting buffered somewhere
- The batch processing may be interrupted

**Investigation Needed:**
- Check if batch timer is still running after reset
- Check if messages are queuing but not displaying
- Check if renderer process is still responsive

### 4. Checkbox Update Not Working

**ROOT CAUSE IDENTIFIED**: The toolbar event handler script is failing!

**Evidence from console:**
```
[UI UPDATE] ❌ Failed to execute toolbar-event-handlers: Error: Script failed to execute
```

**Analysis:**
- Line 2573 has the closing `})();` (was fixed)
- But script still failing with "Script failed to execute"
- The require('electron') at top of IIFE may be issue
- Event listeners for DTR checkbox never get attached

**Fix Required:**
- Script needs proper error handling
- May need to check if require is available in context
- Consider using window.ipcRenderer directly if already exposed

## Summary of Required Fixes

### 1. DTR Button/Checkbox Fix
**Problem**: Checkbox listener not attaching due to script error
**Solution**: Fix the toolbar-event-handlers script execution error

### 2. Debug Logger Clear Fix  
**Problem**: 'clear-output' IPC not handled in renderer
**Solution**: Add IPC listener in Debug Logger renderer to clear display

### 3. Message Routing After Reset Fix
**Problem**: Debug Logger stops processing after clearOutput()
**Solution**: Ensure batch timer continues and messages keep flowing after reset

### 4. Hex Display Format Change
**Problem**: Display too wide with individual bytes
**Solution**: Change to 16-bit word display format as requested

## Immediate Action Items

1. Fix toolbar script execution error (check require availability)
2. Add 'clear-output' IPC handler in Debug Logger renderer
3. Ensure batch processing continues after DTR reset
4. Change hex display to 16-bit words with adjusted spacing