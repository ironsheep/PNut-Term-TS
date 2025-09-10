# External Test Package - 2025-09-08T03:24:00

## Package Details
- **Version**: 0.1.0
- **Build Date**: 2025-09-08T03:24:00 UTC
- **Package Size**: 257MB
- **Format**: electron-ready-macos.tar.gz
- **Location**: `/workspaces/PNut-Term-TS/release/electron-ready-macos.tar.gz`

## Critical Routing Fixes Included

This build contains **critical window creation and message routing fixes** that address the following issues identified in external testing:

### ✅ Fixed: Debug Logger BACKTICK_WINDOW Message Routing
- **Issue**: Debug logger was missing all BACKTICK_WINDOW messages (window creation and update messages)
- **Fix**: Added `debugLogger` destination to BACKTICK_WINDOW message routing in `messageRouter.ts:482`
- **Expected Result**: Debug logger should now show ALL backtick messages including:
  - `LOGIC MyLogic SAMPLES 32`
  - `TERM MyTerm SIZE 9 1 TEXTSIZE 40`
  - `SCOPE MyScope SIZE 254 84 SAMPLES 128`
  - All update messages: `MyLogic 0-35+`, `MyTerm 1 'Temp = 50/51/52'`, `MyScope 0-8+`

### ✅ Fixed: Window Creation Pipeline
- **Issue**: Window creation messages were detected but no actual debug windows were being created
- **Fix**: Fixed backtick prefix handling in `mainWindow.ts:375` - now adds missing backtick prefix to commands
- **Expected Result**: Creation messages should now trigger actual window creation:
  - `LOGIC MyLogic SAMPLES 32` → Creates DebugLogicWindow
  - `TERM MyTerm SIZE 9 1 TEXTSIZE 40` → Creates DebugTermWindow  
  - `SCOPE MyScope SIZE 254 84 SAMPLES 128` → Creates DebugScopeWindow

### ✅ Fixed: Message Pool Memory Leaks
- **Issue**: Pooled messages were never being released, causing potential memory exhaustion
- **Fix**: Added proper message pool release calls in all destination handlers
- **Expected Result**: No message pool leaks, stable memory usage during long testing sessions

## Test Scenarios to Verify

### Primary Test Scenario
1. **Connect P2 hardware** and run a program that creates debug windows
2. **Check Debug Logger** - should now show:
   - All window creation messages (LOGIC, TERM, SCOPE)
   - All subsequent update messages
   - Complete message stream logging
3. **Verify Windows Created** - should see actual debug windows appear:
   - Logic Analyzer windows for logic data
   - Terminal windows for terminal output
   - Oscilloscope windows for scope data
4. **Check Window Updates** - created windows should receive and display their data:
   - Logic windows showing signal transitions
   - Terminal windows showing text output
   - Scope windows showing waveform data

### Secondary Verification
- **Performance**: No memory leaks during extended operation
- **Message Pool**: Proper cleanup of message objects
- **Routing**: All message types properly delivered to correct destinations

## Installation Instructions

1. **Extract**: `tar -xzf electron-ready-macos.tar.gz`
2. **Setup**: Double-click `SETUP.command` to install Electron runtime
3. **Launch**: Double-click `LAUNCH.command` to run PNut-Term-TS
4. **Test**: Use `TEST.command` for basic functionality verification

## Expected Differences from Previous Build

**BEFORE** (Broken):
- Debug logger showed only COG messages
- Window creation messages detected but no windows appeared
- Console showed "routing to Debug Logger" but messages never arrived
- Message pool potentially leaked memory

**AFTER** (Fixed):
- Debug logger shows ALL message types including BACKTICK_WINDOW
- Window creation messages properly create actual debug windows
- Update messages route to both logger AND created windows  
- Proper message pool cleanup prevents memory issues

## Build Verification

✅ Clean build completed successfully  
✅ TypeScript compilation with no errors  
✅ Core routing tests pass (no regressions)  
✅ Package created with all routing fixes included  
✅ Package size: 257MB (reasonable for full application bundle)  

---
**Build Ready for External Testing** - Contains all critical routing fixes for window creation and message delivery pipeline.