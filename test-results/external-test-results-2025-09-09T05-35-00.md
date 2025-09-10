# External Test Results - 2025-09-09T05:35:00

## Test Session Information
- **Date**: September 9, 2025
- **Time**: 05:35:00 UTC
- **Build**: Post-crash-fix build (removed JavaScript injection)
- **Package**: electron-ready-macos.tar.gz (created at 05:33 UTC)
- **Context**: Testing after removing problematic JavaScript injection and keeping CR/LF fix

## Fixes Applied Since Last Test

### 1. Removed JavaScript Injection (CRITICAL)
- **File**: `debugLoggerWin.ts`
- **Lines Removed**: 310-329 (executeJavaScript calls)
- **Reason**: Was causing continuous unhandled promise rejections and window crashes
- **Impact**: Should eliminate JavaScript errors and window instability

### 2. Simplified Scrollbar Logic
- **File**: `debugLoggerWin.ts`
- **Changes**:
  - Removed complex event handlers (visibilitychange, load)
  - Simplified to just call `scrollToBottom()` after each message
  - Removed `requestAnimationFrame` wrapper
- **Approach**: Simple is better - just scroll after adding content

### 3. CR/LF Stripping (Still Active)
- **File**: `messageExtractor.ts`
- **Method**: `stripEOLCharacters()`
- **Scope**: COG_MESSAGE and BACKTICK_WINDOW only
- **Status**: Working correctly based on logs

## Test Results

### System Stability
- **JavaScript Errors**: ❌ STILL OCCURRING - Continuous script execution failures
- **Rejection IDs**: 145-585+ (continuing to increment)
- **Window Crashes**: No longer crashing/disappearing
- **Unhandled Rejections**: ❌ MANY - rejection ids continuing

### Device Connection
- **Status**: ✅ Connected
- **Device**: /dev/tty.usbserial (from logs)
- **Connection**: Working, data flowing

### Window Creation
- **LOGIC Window**: ✅ Created (MyLogic)
- **TERM Window**: ✅ Created
- **SCOPE Window**: ❌ NEVER APPEARED
- **Debug Logger**: ✅ Created

### Data Display
- **LOGIC Data Visible**: ❌ NO DATA UPDATES
- **TERM Data Visible**: ❌ NO DATA UPDATES
- **SCOPE Data Visible**: N/A - Window never created
- **Data Parsing**: ✅ WORKING - `isSpinNumber(29): isValid=(true)`

### Debug Logger Behavior
- **Initial Position**: ✅ CORRECTLY AT BOTTOM
- **Scrolls to Bottom**: ✅ WORKING
- **Stays at Bottom**: ✅ WORKING
- **Performance Warning**: ⚠️ Displayed at bottom

### Critical Issues

#### 1. NO DATA UPDATES IN ANY WINDOW
- Despite successful parsing in logs
- Windows appear but remain empty
- Messages are queuing (102 in SCOPE queue)
- Windows do respond to close commands

#### 2. JavaScript Execution Errors Continue
- Still getting "Script failed to execute" errors
- Rejection IDs: 145-585+ and climbing
- Despite removing the problematic injection code

#### 3. SCOPE Window Never Appears
- Has 102 messages queued that never process
- Window creation fails silently

## Console Log Analysis
*Awaiting console log data to be provided*

## Summary
- **PARTIAL SUCCESS**: Debug logger scrollbar now working correctly
- **CRITICAL FAILURE**: No data reaching any windows despite successful parsing
- **MYSTERY**: JavaScript errors continue despite code removal
- **MISSING**: SCOPE window never creates

---
*Test session needs console log analysis for complete diagnosis*    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 145)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 146)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 147)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 148)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 149)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 150)
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 649808773619µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $39 $0D $0A               `MyLogic 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 29]: lineParts=[`MyLogic | 29](2)
lcgW: at updateContent(`MyLogic 29)
lcgW:   -- at [29] in lineParts[1]
Base: isSpinNumber(29): isValid=(true)  -> (29)
lcgW: at recordSampleToChannels(0b011101) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#26) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #26 currSample=(1,#26) @ rc=[3,200], prev=[18,192]
lcgW: at updateLogicChannelData(data-1, w/#26) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #26 currSample=(0,#26) @ rc=[18,200], prev=[18,192]
lcgW: at updateLogicChannelData(data-2, w/#26) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #26 currSample=(1,#26) @ rc=[3,200], prev=[3,192]
lcgW: at updateLogicChannelData(data-3, w/#26) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #26 currSample=(1,#26) @ rc=[3,200], prev=[3,192]
lcgW: at updateLogicChannelData(data-4, w/#26) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #26 currSample=(1,#26) @ rc=[3,200], prev=[3,192]
lcgW: at updateLogicChannelData(data-5, w/#26) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #26 currSample=(0,#26) @ rc=[18,200], prev=[18,192]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 151)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 152)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 153)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 154)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 155)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 156)
[SERIAL RX 649808805590µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $30 $0D $0A               `MyLogic 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 649808821590µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $31 $0D $0A               `MyLogic 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 30]: lineParts=[`MyLogic | 30](2)
lcgW: at updateContent(`MyLogic 30)
lcgW:   -- at [30] in lineParts[1]
Base: isSpinNumber(30): isValid=(true)  -> (30)
lcgW: at recordSampleToChannels(0b011110) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#27) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #27 currSample=(0,#27) @ rc=[18,208], prev=[3,200]
lcgW: at updateLogicChannelData(data-1, w/#27) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #27 currSample=(1,#27) @ rc=[3,208], prev=[18,200]
lcgW: at updateLogicChannelData(data-2, w/#27) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #27 currSample=(1,#27) @ rc=[3,208], prev=[3,200]
lcgW: at updateLogicChannelData(data-3, w/#27) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #27 currSample=(1,#27) @ rc=[3,208], prev=[3,200]
lcgW: at updateLogicChannelData(data-4, w/#27) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #27 currSample=(1,#27) @ rc=[3,208], prev=[3,200]
lcgW: at updateLogicChannelData(data-5, w/#27) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #27 currSample=(0,#27) @ rc=[18,208], prev=[18,200]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 30
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 31]: lineParts=[`MyLogic | 31](2)
lcgW: at updateContent(`MyLogic 31)
lcgW:   -- at [31] in lineParts[1]
Base: isSpinNumber(31): isValid=(true)  -> (31)
lcgW: at recordSampleToChannels(0b011111) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#28) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #28 currSample=(1,#28) @ rc=[3,216], prev=[18,208]
lcgW: at updateLogicChannelData(data-1, w/#28) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #28 currSample=(1,#28) @ rc=[3,216], prev=[3,208]
lcgW: at updateLogicChannelData(data-2, w/#28) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #28 currSample=(1,#28) @ rc=[3,216], prev=[3,208]
lcgW: at updateLogicChannelData(data-3, w/#28) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #28 currSample=(1,#28) @ rc=[3,216], prev=[3,208]
lcgW: at updateLogicChannelData(data-4, w/#28) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #28 currSample=(1,#28) @ rc=[3,216], prev=[3,208]
lcgW: at updateLogicChannelData(data-5, w/#28) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #28 currSample=(0,#28) @ rc=[18,216], prev=[18,208]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 157)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 158)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 159)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 160)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 161)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 162)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 163)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 164)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 165)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 166)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 167)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 168)
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 649808853560µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $32 $0D $0A               `MyLogic 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 649808869322µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $33 $0D $0A               `MyLogic 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 32]: lineParts=[`MyLogic | 32](2)
lcgW: at updateContent(`MyLogic 32)
lcgW:   -- at [32] in lineParts[1]
Base: isSpinNumber(32): isValid=(true)  -> (32)
lcgW: at recordSampleToChannels(0b100000) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#29) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #29 currSample=(0,#29) @ rc=[18,224], prev=[3,216]
lcgW: at updateLogicChannelData(data-1, w/#29) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #29 currSample=(0,#29) @ rc=[18,224], prev=[3,216]
lcgW: at updateLogicChannelData(data-2, w/#29) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #29 currSample=(0,#29) @ rc=[18,224], prev=[3,216]
lcgW: at updateLogicChannelData(data-3, w/#29) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #29 currSample=(0,#29) @ rc=[18,224], prev=[3,216]
lcgW: at updateLogicChannelData(data-4, w/#29) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #29 currSample=(0,#29) @ rc=[18,224], prev=[3,216]
lcgW: at updateLogicChannelData(data-5, w/#29) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #29 currSample=(1,#29) @ rc=[3,224], prev=[18,216]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 32
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 33]: lineParts=[`MyLogic | 33](2)
lcgW: at updateContent(`MyLogic 33)
lcgW:   -- at [33] in lineParts[1]
Base: isSpinNumber(33): isValid=(true)  -> (33)
lcgW: at recordSampleToChannels(0b100001) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#30) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #30 currSample=(1,#30) @ rc=[3,232], prev=[18,224]
lcgW: at updateLogicChannelData(data-1, w/#30) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #30 currSample=(0,#30) @ rc=[18,232], prev=[18,224]
lcgW: at updateLogicChannelData(data-2, w/#30) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #30 currSample=(0,#30) @ rc=[18,232], prev=[18,224]
lcgW: at updateLogicChannelData(data-3, w/#30) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #30 currSample=(0,#30) @ rc=[18,232], prev=[18,224]
lcgW: at updateLogicChannelData(data-4, w/#30) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #30 currSample=(0,#30) @ rc=[18,232], prev=[18,224]
lcgW: at updateLogicChannelData(data-5, w/#30) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #30 currSample=(1,#30) @ rc=[3,232], prev=[3,224]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 169)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 170)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 171)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 172)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 173)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 174)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 175)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 176)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 177)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 178)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 179)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 180)
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 649808901382µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $34 $0D $0A               `MyLogic 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 649808917606µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $35 $0D $0A               `MyLogic 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 34]: lineParts=[`MyLogic | 34](2)
lcgW: at updateContent(`MyLogic 34)
lcgW:   -- at [34] in lineParts[1]
Base: isSpinNumber(34): isValid=(true)  -> (34)
lcgW: at recordSampleToChannels(0b100010) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#31) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #31 currSample=(0,#31) @ rc=[18,240], prev=[3,232]
lcgW: at updateLogicChannelData(data-1, w/#31) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #31 currSample=(1,#31) @ rc=[3,240], prev=[18,232]
lcgW: at updateLogicChannelData(data-2, w/#31) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #31 currSample=(0,#31) @ rc=[18,240], prev=[18,232]
lcgW: at updateLogicChannelData(data-3, w/#31) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #31 currSample=(0,#31) @ rc=[18,240], prev=[18,232]
lcgW: at updateLogicChannelData(data-4, w/#31) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #31 currSample=(0,#31) @ rc=[18,240], prev=[18,232]
lcgW: at updateLogicChannelData(data-5, w/#31) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #31 currSample=(1,#31) @ rc=[3,240], prev=[3,232]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 34
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 35]: lineParts=[`MyLogic | 35](2)
lcgW: at updateContent(`MyLogic 35)
lcgW:   -- at [35] in lineParts[1]
Base: isSpinNumber(35): isValid=(true)  -> (35)
lcgW: at recordSampleToChannels(0b100011) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#32) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-1, w/#32) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-2, w/#32) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-3, w/#32) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-4, w/#32) sample(s), didScroll=(false)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-5, w/#32) sample(s), didScroll=(false)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 181)
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 182)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 183)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 184)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 185)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 186)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 187)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 188)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 189)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 190)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 191)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 192)
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 649808949572µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $36 $0D $0A               `MyLogic 36..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 0 msg/s, processing: 4ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 36]: lineParts=[`MyLogic | 36](2)
lcgW: at updateContent(`MyLogic 36)
lcgW:   -- at [36] in lineParts[1]
Base: isSpinNumber(36): isValid=(true)  -> (36)
lcgW: at recordSampleToChannels(0b100100) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-1, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-2, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-3, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-4, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-5, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 36
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 193)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 194)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 195)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 196)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 197)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 198)
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 649808981532µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $37 $0D $0A               `MyLogic 37..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 1ms)
[SERIAL RX 649808997621µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $38 $0D $0A               `MyLogic 38..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 37]: lineParts=[`MyLogic | 37](2)
lcgW: at updateContent(`MyLogic 37)
lcgW:   -- at [37] in lineParts[1]
Base: isSpinNumber(37): isValid=(true)  -> (37)
lcgW: at recordSampleToChannels(0b100101) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-1, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-2, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-3, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-4, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-5, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 37
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 38]: lineParts=[`MyLogic | 38](2)
lcgW: at updateContent(`MyLogic 38)
lcgW:   -- at [38] in lineParts[1]
Base: isSpinNumber(38): isValid=(true)  -> (38)
lcgW: at recordSampleToChannels(0b100110) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-1, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-2, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-3, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-4, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-5, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 38
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 199)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 200)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 201)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 202)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 203)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 204)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 205)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 206)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 207)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 208)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 209)
(node:92157) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:92157) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 210)
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 649809029505µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $39 $0D $0A               `MyLogic 39..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 649809045448µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $30 $0D $0A               `MyLogic 40..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 39]: lineParts=[`MyLogic | 39](2)
lcgW: at updateContent(`MyLogic 39)
lcgW:   -- at [39] in lineParts[1]
Base: isSpinNumber(39): isValid=(true)  -> (39)
lcgW: at recordSampleToChannels(0b100111) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-1, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-2, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-3, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-4, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-5, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 39
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 40]: lineParts=[`MyLogic | 40](2)
lcgW: at updateContent(`MyLogic 40)
lcgW:   -- at [40] in lineParts[1]
Base: isSpinNumber(40): isValid=(true)  -> (40)
lcgW: at recordSampleToChannels(0b101000) w/6 channels
lcgW: at updateLogicChannelData(data-0, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-1, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-2, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[3,240]
lcgW: at updateLogicChannelData(data-3, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-4, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=1, prevInvSample=1
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(0,#32) @ rc=[18,248], prev=[18,240]
lcgW: at updateLogicChannelData(data-5, w/#32) sample(s), didScroll=(true)
lcgW:   -- currInvSample=0, prevInvSample=0
lcgW:   -- DRAW size=(256,15), offset=(0,3)
lcgW:   -- #32 currSample=(1,#32) @ rc=[3,248], prev=[3,240]
[TWO-TIER] Routed to existing window: MyLogic
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 40
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
