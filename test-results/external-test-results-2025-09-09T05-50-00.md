# External Test Results - 2025-09-09T05:50:00

## Test Session Information
- **Date**: September 9, 2025
- **Time**: 05:50:00 UTC
- **Build**: SCOPE window deferred creation fix
- **Package**: electron-ready-macos.tar.gz (created at 05:51 UTC)
- **Context**: Testing SCOPE with proper deferred window creation

## Fixes Applied Since Last Test

### 1. Reverted Immediate Window Creation
- **File**: `debugScopeWin.ts`
- **Change**: Removed immediate `createDebugWindow()` from constructor
- **Reason**: Window needs channel definitions to size correctly

### 2. Restored Deferred Window Creation
- **File**: `debugScopeWin.ts`  
- **Change**: Window creates after first numeric data (line 1020)
- **Reason**: By then, channel definitions have been processed

### 3. Kept Message Queue Fix
- **File**: `debugScopeWin.ts`
- **Change**: Still calling `onWindowReady()` in did-finish-load
- **Impact**: Messages will process once window is ready

## Test Results

### Window Flash Issue
- **Mystery Window**: ❌ Window flashed and disappeared at app start
- **Timing**: Right at beginning of app
- **Pattern**: Has been happening routinely

### System Stability
- **JavaScript Errors**: [AWAITING]
- **Window Crashes**: [AWAITING]
- **Unhandled Rejections**: [AWAITING]

### Device Connection
- **Status**: [AWAITING]
- **Device**: [AWAITING]
- **Connection**: [AWAITING]

### Window Creation
- **LOGIC Window**: N/A - Disabled for testing
- **TERM Window**: N/A - Disabled for testing
- **SCOPE Window**: ❌ NO WINDOW APPEARED
- **Debug Logger**: [AWAITING]

### Data Display
- **LOGIC Data Visible**: N/A - Disabled
- **TERM Data Visible**: N/A - Disabled
- **SCOPE Data Visible**: N/A - No window
- **Data Flow**: All data went to end (no window to receive it)

### Critical Issue
- **SCOPE window never created** - Back to original problem
- **Data processing continued** to completion without window

## Console Log Analysis/Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/TEST.command ; exit;
🔍 Looking for serial devices...

Available devices:
/dev/tty.usbserial-P9cektn7

✅ Found device: P9cektn7

🚀 Launching with device P9cektn7...
   (Toggle DTR on your P2 to trigger debug messages)

=========================================
Debug output will appear below:
=========================================
PNut-Term-TS: Storing dumps inside:  /Users/stephen/Library/Application Support/pnut-term-ts/Crashpad
* Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC.
* Version 0.1.0, Build date: 9/9/2025

* pnut-term-ts /Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/Resources/app -p P9cektn7 --verbose
** process.argv=[/Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/MacOS/Electron, /Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/Resources/app, -p, P9cektn7, --verbose], this.argsArray=[[]] inContainer=[false]
- -------------------------------- -
arguments: [ [length]: 0 ]
combArguments: [
  '/Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/MacOS/Electron',
  '/Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/Resources/app',
  '-p',
  'P9cektn7',
  '--verbose',
  [length]: 5
]
options: { plug: 'P9cektn7', verbose: true, debug: false, quiet: false }
- -------------------------------- -
[STARTUP] Electron detected, version: 0.1.0
[STARTUP] Decision: hasElectron=true, startMainWindow=true
[CircularBuffer] Initialized with 1048576 bytes (1024.0KB)
[MessagePool] Initialized with 100 pre-allocated messages
[TWO-TIER] 🔧 Setting up SerialProcessor event handlers...
[TWO-TIER] 🚀 Starting SerialMessageProcessor...
[Processor] Started serial message processing
[TWO-TIER] ✅ SerialMessageProcessor started successfully
[TWO-TIER] ✅ SerialProcessor event handlers setup complete
[WINDOW CREATION] 🎧 Setting up WindowRouter event listeners
[WINDOW CREATION] ✅ WindowRouter event listeners setup complete
* initialize()
[STARTUP] MainWindow.initialize() called
[STARTUP] Device specified: /dev/tty.usbserial-P9cektn7
[STARTUP] Electron app object found, calling whenReady()
[STARTUP] Electron app is ready, creating window
[STARTUP] Native theme set to light mode
[STARTUP] createAppWindow() called
* create App Window()
work area size: 2560 x 1415
     char size (default): 12 x 18
window geom: 960x450 @800,915
[MENU SETUP] IDE Mode: false, Setting up menu: true
[MENU SETUP] Starting createApplicationMenu()
[MENU SETUP] ✅ macOS system menu set
[MENU SETUP] Standalone Mode - HTML menu bar will be used
[IPC] All menu handlers registered
2025-09-09T05:49:02.480Z [INFO ] STARTUP: WindowRouter initialized
[MENU] Injecting menu setup after window load...
[MENU] Starting programmatic menu initialization...
[DEBUG LOGGER] Creating debug logger window for auto-logging...
[DEBUG LOGGER] Positioning at bottom-right: 1720, 913
[DEBUG LOGGER] Setting up did-finish-load event handler...
Base: - New e window
[DEBUG LOGGER] Registering with WindowRouter immediately...
Base: - Registered with WindowRouter: DebugLogger (logger)
Base: - Window marked as ready for logger
Base: - Transitioning to IMMEDIATE processing (no batching delays)
Base: - Immediate processing active (zero delay)
[DEBUG LOGGER] Successfully registered with WindowRouter (immediate)
[DEBUG LOGGER] Auto-created successfully - logging started immediately
[DEBUG LOGGER] Connected to performance monitor for warnings
[PERF DISPLAY] Performance monitoring started after DOM ready
[PERF DISPLAY] Performance monitoring timer started
[MENU] Menu injection result: Menu initialized
* getFontMetrics() -> (13.328125x11.4765625)
[FONT METRICS] Measured after window ready: 13.328125 x 11.4765625
2025-09-09T05:49:02.669Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger). Can receive messages to queue.
2025-09-09T05:49:02.677Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1
[DEBUG LOGGER] Window did-finish-load event fired!
[DEBUG LOGGER] Window shown and focused
?Base?: Debug Logger window ready
[DEBUG LOGGER] Verified still registered: DebugLogger
[DEBUG LOGGER] Creating logs directory at: /Users/stephen/logs
[UTIL] Log folder already exists at: /Users/stephen/logs
[DEBUG LOGGER] Log file path: /Users/stephen/logs/debug_250908-2349.log
[DEBUG LOGGER] Write stream created successfully
[DEBUG LOGGER] Log file initialized successfully at: /Users/stephen/logs/debug_250908-2349.log
[DEBUG LOGGER] Started new log: /Users/stephen/logs/debug_250908-2349.log
[DEBUG LOGGER] Write stream opened with fd: 59
[DEBUG LOGGER] Log file header written and flushed
[DEBUG LOGGER] Log file synced to disk
[SERIAL RX 651689480053µs] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 0ms)
[SERIAL RX 651689484912µs] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $46 $35 $43 $20 $24 $30  $30 $30 $30 $5F $32 $32 $37 $38   _0F5C $0000_2278
  0020: $20 $6A $75 $6D $70 $0D $0A $43  $6F $67 $30 $20 $20 $2A $20 $64    jump..Cog0  * d
  0030: $65 $6D $6F $20 $77 $69 $6E $64  $6F $77 $73 $20 $2D $20 $74 $68   emo windows - th
  0040: $72 $65 $65 $20 $6F $66 $20 $74  $68 $65 $6D $0D $0A $60 $4C $4F   ree of them..`LO
  0050: $47 $49 $43 $20 $4D $79 $4C $6F  $67 $69 $63 $20 $53 $41 $4D $50   GIC MyLogic SAMP
  0060: $4C $45 $53 $20 $33 $32 $20 $27  $4C $6F $77 $27 $20 $33 $20 $27   LES 32 'Low' 3 '
  0070: $4D $69 $64 $27 $20 $32 $20 $27  $48 $69 $67 $68                   Mid' 2 'High
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX 651689499054µs] Received 51 bytes
[SERIAL RX HEX/ASCII]:
  0000: $27 $0D $0A $60 $4D $79 $4C $6F  $67 $69 $63 $20 $54 $52 $49 $47   '..`MyLogic TRIG
  0010: $47 $45 $52 $20 $24 $30 $37 $20  $24 $30 $34 $20 $48 $4F $4C $44   GER $07 $04 HOLD
  0020: $4F $46 $46 $20 $32 $0D $0A $60  $4D $79 $4C $6F $67 $69 $63 $20   OFF 2..`MyLogic
  0030: $30 $0D $0A                                                        0..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 51 bytes, running: true
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 37 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #99 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 37 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 INIT $0000_0000 $0000_0000 load
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 37 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #99 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 37 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 INIT $0000_0F5C $0000_2278 jump
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 36 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #99 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 36 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 * demo windows - three of them
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 48 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`LOGIC MyLogic SAMPLES 32 'Low' 3 'Mid' 2 'High']: lineParts=[`LOGIC | MyLogic | SAMPLES | 32 | 'Low' | 3 | 'Mid' | 2 | 'High'](9)
[TWO-TIER] Window creation - possibleName=[LOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [LOGIC] in command: `LOGIC MyLogic SAMPLES 32 'Low' 3 'Mid' 2 'High'
[TWO-TIER] UNHANDLED window command: `LOGIC MyLogic SAMPLES 32 'Low' 3 'Mid' 2 'High'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 48 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `LOGIC MyLogic SAMPLES 32 'Low'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 34 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic TRIGGER $07 $04 HOLDOFF 2]: lineParts=[`MyLogic | TRIGGER | $07 | $04 | HOLDOFF | 2](6)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic TRIGGER $07 $04 HOLDOFF 2
[TWO-TIER] UNHANDLED window command: `MyLogic TRIGGER $07 $04 HOLDOFF 2
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 34 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic TRIGGER $07 $04 HOLDOFF
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 0]: lineParts=[`MyLogic | 0](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 0
[TWO-TIER] UNHANDLED window command: `MyLogic 0
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 0
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 64 bytes to log file
[DEBUG LOGGER] Flushed 64 bytes to log file
[DEBUG LOGGER] Flushed 63 bytes to log file
[DEBUG LOGGER] Flushed 94 bytes to log file
[DEBUG LOGGER] Flushed 80 bytes to log file
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651689515132µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $0D $0A                   `MyLogic 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[DEBUG LOGGER] Sending batch of 6 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 1]: lineParts=[`MyLogic | 1](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 1
[TWO-TIER] UNHANDLED window command: `MyLogic 1
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 1
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651689546961µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $0D $0A                   `MyLogic 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651689562901µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $0D $0A                   `MyLogic 3..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 2]: lineParts=[`MyLogic | 2](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 2
[TWO-TIER] UNHANDLED window command: `MyLogic 2
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 2
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 3]: lineParts=[`MyLogic | 3](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 3
[TWO-TIER] UNHANDLED window command: `MyLogic 3
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 3
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689594993µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $0D $0A                   `MyLogic 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[SERIAL RX 651689611105µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $0D $0A                   `MyLogic 5..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 4]: lineParts=[`MyLogic | 4](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 4
[TWO-TIER] UNHANDLED window command: `MyLogic 4
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 5]: lineParts=[`MyLogic | 5](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 5
[TWO-TIER] UNHANDLED window command: `MyLogic 5
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 5
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689643006µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $0D $0A                   `MyLogic 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[SERIAL RX 651689658887µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $37 $0D $0A                   `MyLogic 7..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 6]: lineParts=[`MyLogic | 6](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 6
[TWO-TIER] UNHANDLED window command: `MyLogic 6
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 6
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 7]: lineParts=[`MyLogic | 7](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 7
[TWO-TIER] UNHANDLED window command: `MyLogic 7
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 7
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689690979µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $38 $0D $0A                   `MyLogic 8..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 8]: lineParts=[`MyLogic | 8](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 8
[TWO-TIER] UNHANDLED window command: `MyLogic 8
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 8
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651689722813µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $39 $0D $0A                   `MyLogic 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651689739504µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $30 $0D $0A               `MyLogic 10..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 9]: lineParts=[`MyLogic | 9](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 9
[TWO-TIER] UNHANDLED window command: `MyLogic 9
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 9
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 10]: lineParts=[`MyLogic | 10](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 10
[TWO-TIER] UNHANDLED window command: `MyLogic 10
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 10
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689770955µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $31 $0D $0A               `MyLogic 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651689787012µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $32 $0D $0A               `MyLogic 12..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 11]: lineParts=[`MyLogic | 11](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 11
[TWO-TIER] UNHANDLED window command: `MyLogic 11
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 11
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 12]: lineParts=[`MyLogic | 12](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 12
[TWO-TIER] UNHANDLED window command: `MyLogic 12
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 12
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689819338µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $33 $0D $0A               `MyLogic 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651689835475µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $34 $0D $0A               `MyLogic 14..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 13]: lineParts=[`MyLogic | 13](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 13
[TWO-TIER] UNHANDLED window command: `MyLogic 13
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 13
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 14]: lineParts=[`MyLogic | 14](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 14
[TWO-TIER] UNHANDLED window command: `MyLogic 14
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 14
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689866539µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $35 $0D $0A               `MyLogic 15..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 15]: lineParts=[`MyLogic | 15](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 15
[TWO-TIER] UNHANDLED window command: `MyLogic 15
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 15
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651689898887µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $36 $0D $0A               `MyLogic 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651689914786µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $37 $0D $0A               `MyLogic 17..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 16]: lineParts=[`MyLogic | 16](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 16
[TWO-TIER] UNHANDLED window command: `MyLogic 16
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 16
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 17]: lineParts=[`MyLogic | 17](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 17
[TWO-TIER] UNHANDLED window command: `MyLogic 17
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 17
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689946592µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $38 $0D $0A               `MyLogic 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651689963022µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $39 $0D $0A               `MyLogic 19..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 18]: lineParts=[`MyLogic | 18](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 18
[TWO-TIER] UNHANDLED window command: `MyLogic 18
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 18
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 19]: lineParts=[`MyLogic | 19](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 19
[TWO-TIER] UNHANDLED window command: `MyLogic 19
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 19
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651689994855µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $30 $0D $0A               `MyLogic 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651690010547µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $31 $0D $0A               `MyLogic 21..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 20]: lineParts=[`MyLogic | 20](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 20
[TWO-TIER] UNHANDLED window command: `MyLogic 20
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 20
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 21]: lineParts=[`MyLogic | 21](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 21
[TWO-TIER] UNHANDLED window command: `MyLogic 21
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 21
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690043034µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $32 $0D $0A               `MyLogic 22..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 22]: lineParts=[`MyLogic | 22](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 22
[TWO-TIER] UNHANDLED window command: `MyLogic 22
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 22
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690074868µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $33 $0D $0A               `MyLogic 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690090732µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $34 $0D $0A               `MyLogic 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 23]: lineParts=[`MyLogic | 23](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 23
[TWO-TIER] UNHANDLED window command: `MyLogic 23
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 23
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 24]: lineParts=[`MyLogic | 24](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 24
[TWO-TIER] UNHANDLED window command: `MyLogic 24
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 24
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690122968µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $35 $0D $0A               `MyLogic 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651690138978µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $36 $0D $0A               `MyLogic 26..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 25]: lineParts=[`MyLogic | 25](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 25
[TWO-TIER] UNHANDLED window command: `MyLogic 25
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 25
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 26]: lineParts=[`MyLogic | 26](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 26
[TWO-TIER] UNHANDLED window command: `MyLogic 26
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 26
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690170990µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $37 $0D $0A               `MyLogic 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651690186941µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $38 $0D $0A               `MyLogic 28..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 27]: lineParts=[`MyLogic | 27](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 27
[TWO-TIER] UNHANDLED window command: `MyLogic 27
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 27
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 28]: lineParts=[`MyLogic | 28](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 28
[TWO-TIER] UNHANDLED window command: `MyLogic 28
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 28
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690218899µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $39 $0D $0A               `MyLogic 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 29]: lineParts=[`MyLogic | 29](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 29
[TWO-TIER] UNHANDLED window command: `MyLogic 29
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690250953µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $30 $0D $0A               `MyLogic 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690266887µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $31 $0D $0A               `MyLogic 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 30]: lineParts=[`MyLogic | 30](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 30
[TWO-TIER] UNHANDLED window command: `MyLogic 30
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
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 31
[TWO-TIER] UNHANDLED window command: `MyLogic 31
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690298853µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $32 $0D $0A               `MyLogic 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651690314913µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $33 $0D $0A               `MyLogic 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 32]: lineParts=[`MyLogic | 32](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 32
[TWO-TIER] UNHANDLED window command: `MyLogic 32
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
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 33
[TWO-TIER] UNHANDLED window command: `MyLogic 33
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690347059µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $34 $0D $0A               `MyLogic 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651690362911µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $35 $0D $0A               `MyLogic 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 34]: lineParts=[`MyLogic | 34](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 34
[TWO-TIER] UNHANDLED window command: `MyLogic 34
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
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 35
[TWO-TIER] UNHANDLED window command: `MyLogic 35
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690394615µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $36 $0D $0A               `MyLogic 36..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 36]: lineParts=[`MyLogic | 36](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 36
[TWO-TIER] UNHANDLED window command: `MyLogic 36
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 36
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690426392µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $37 $0D $0A               `MyLogic 37..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690442437µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $38 $0D $0A               `MyLogic 38..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 37]: lineParts=[`MyLogic | 37](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 37
[TWO-TIER] UNHANDLED window command: `MyLogic 37
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
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 38
[TWO-TIER] UNHANDLED window command: `MyLogic 38
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 38
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690474497µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $39 $0D $0A               `MyLogic 39..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651690490415µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $30 $0D $0A               `MyLogic 40..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 39]: lineParts=[`MyLogic | 39](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 39
[TWO-TIER] UNHANDLED window command: `MyLogic 39
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
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 40
[TWO-TIER] UNHANDLED window command: `MyLogic 40
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 40
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690522517µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $31 $0D $0A               `MyLogic 41..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 46 msg/s, processing: 1ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 41]: lineParts=[`MyLogic | 41](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 41
[TWO-TIER] UNHANDLED window command: `MyLogic 41
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 41
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690538594µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $32 $0D $0A               `MyLogic 42..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 42]: lineParts=[`MyLogic | 42](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 42
[TWO-TIER] UNHANDLED window command: `MyLogic 42
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 42
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690570533µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $33 $0D $0A               `MyLogic 43..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 43]: lineParts=[`MyLogic | 43](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 43
[TWO-TIER] UNHANDLED window command: `MyLogic 43
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 43
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690586632µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $34 $0D $0A               `MyLogic 44..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 44]: lineParts=[`MyLogic | 44](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 44
[TWO-TIER] UNHANDLED window command: `MyLogic 44
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 44
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690618519µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $35 $0D $0A               `MyLogic 45..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 45]: lineParts=[`MyLogic | 45](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 45
[TWO-TIER] UNHANDLED window command: `MyLogic 45
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 45
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690650692µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $36 $0D $0A               `MyLogic 46..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 46]: lineParts=[`MyLogic | 46](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 46
[TWO-TIER] UNHANDLED window command: `MyLogic 46
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 46
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690666694µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $37 $0D $0A               `MyLogic 47..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 47]: lineParts=[`MyLogic | 47](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 47
[TWO-TIER] UNHANDLED window command: `MyLogic 47
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 47
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690698600µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $38 $0D $0A               `MyLogic 48..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 48]: lineParts=[`MyLogic | 48](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 48
[TWO-TIER] UNHANDLED window command: `MyLogic 48
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 48
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690714865µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $39 $0D $0A               `MyLogic 49..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 49]: lineParts=[`MyLogic | 49](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 49
[TWO-TIER] UNHANDLED window command: `MyLogic 49
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 49
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690746813µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $30 $0D $0A               `MyLogic 50..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 50]: lineParts=[`MyLogic | 50](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 50
[TWO-TIER] UNHANDLED window command: `MyLogic 50
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 50
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690762609µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $31 $0D $0A               `MyLogic 51..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 51]: lineParts=[`MyLogic | 51](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 51
[TWO-TIER] UNHANDLED window command: `MyLogic 51
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 51
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690794758µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $32 $0D $0A               `MyLogic 52..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 52]: lineParts=[`MyLogic | 52](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 52
[TWO-TIER] UNHANDLED window command: `MyLogic 52
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 52
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690826815µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $33 $0D $0A               `MyLogic 53..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 53]: lineParts=[`MyLogic | 53](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 53
[TWO-TIER] UNHANDLED window command: `MyLogic 53
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 53
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690843029µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $34 $0D $0A               `MyLogic 54..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 54]: lineParts=[`MyLogic | 54](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 54
[TWO-TIER] UNHANDLED window command: `MyLogic 54
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 54
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651690874749µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $35 $0D $0A               `MyLogic 55..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 55]: lineParts=[`MyLogic | 55](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 55
[TWO-TIER] UNHANDLED window command: `MyLogic 55
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 55
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690890781µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $36 $0D $0A               `MyLogic 56..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 56]: lineParts=[`MyLogic | 56](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 56
[TWO-TIER] UNHANDLED window command: `MyLogic 56
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 56
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690923006µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $37 $0D $0A               `MyLogic 57..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 57]: lineParts=[`MyLogic | 57](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 57
[TWO-TIER] UNHANDLED window command: `MyLogic 57
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 57
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651690938828µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $38 $0D $0A               `MyLogic 58..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 58]: lineParts=[`MyLogic | 58](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 58
[TWO-TIER] UNHANDLED window command: `MyLogic 58
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 58
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651690970819µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $39 $0D $0A               `MyLogic 59..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 59]: lineParts=[`MyLogic | 59](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 59
[TWO-TIER] UNHANDLED window command: `MyLogic 59
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 59
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691002792µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $30 $0D $0A               `MyLogic 60..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 60]: lineParts=[`MyLogic | 60](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 60
[TWO-TIER] UNHANDLED window command: `MyLogic 60
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 60
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691018754µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $31 $0D $0A               `MyLogic 61..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 61]: lineParts=[`MyLogic | 61](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 61
[TWO-TIER] UNHANDLED window command: `MyLogic 61
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 61
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691050895µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $32 $0D $0A               `MyLogic 62..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 62]: lineParts=[`MyLogic | 62](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 62
[TWO-TIER] UNHANDLED window command: `MyLogic 62
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 62
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691066753µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $33 $0D $0A               `MyLogic 63..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 63]: lineParts=[`MyLogic | 63](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 63
[TWO-TIER] UNHANDLED window command: `MyLogic 63
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 63
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691098868µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $30 $0D $0A                   `MyLogic 0..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 0]: lineParts=[`MyLogic | 0](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 0
[TWO-TIER] UNHANDLED window command: `MyLogic 0
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 0
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691115024µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $0D $0A                   `MyLogic 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 1]: lineParts=[`MyLogic | 1](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 1
[TWO-TIER] UNHANDLED window command: `MyLogic 1
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 1
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691147021µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $0D $0A                   `MyLogic 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 2]: lineParts=[`MyLogic | 2](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 2
[TWO-TIER] UNHANDLED window command: `MyLogic 2
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 2
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691179057µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $0D $0A                   `MyLogic 3..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 3]: lineParts=[`MyLogic | 3](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 3
[TWO-TIER] UNHANDLED window command: `MyLogic 3
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 3
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691195078µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $0D $0A                   `MyLogic 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 4]: lineParts=[`MyLogic | 4](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 4
[TWO-TIER] UNHANDLED window command: `MyLogic 4
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691226827µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $0D $0A                   `MyLogic 5..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 5]: lineParts=[`MyLogic | 5](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 5
[TWO-TIER] UNHANDLED window command: `MyLogic 5
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 5
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691242851µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $0D $0A                   `MyLogic 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 6]: lineParts=[`MyLogic | 6](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 6
[TWO-TIER] UNHANDLED window command: `MyLogic 6
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 6
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691274736µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $37 $0D $0A                   `MyLogic 7..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 7]: lineParts=[`MyLogic | 7](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 7
[TWO-TIER] UNHANDLED window command: `MyLogic 7
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 7
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691290734µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $38 $0D $0A                   `MyLogic 8..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 8]: lineParts=[`MyLogic | 8](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 8
[TWO-TIER] UNHANDLED window command: `MyLogic 8
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 8
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691322895µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $39 $0D $0A                   `MyLogic 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 9]: lineParts=[`MyLogic | 9](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 9
[TWO-TIER] UNHANDLED window command: `MyLogic 9
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 9
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651691338924µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $30 $0D $0A               `MyLogic 10..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 10]: lineParts=[`MyLogic | 10](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 10
[TWO-TIER] UNHANDLED window command: `MyLogic 10
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 10
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691370884µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $31 $0D $0A               `MyLogic 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 11]: lineParts=[`MyLogic | 11](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 11
[TWO-TIER] UNHANDLED window command: `MyLogic 11
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 11
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691402878µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $32 $0D $0A               `MyLogic 12..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 12]: lineParts=[`MyLogic | 12](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 12
[TWO-TIER] UNHANDLED window command: `MyLogic 12
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 12
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691418839µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $33 $0D $0A               `MyLogic 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 13]: lineParts=[`MyLogic | 13](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 13
[TWO-TIER] UNHANDLED window command: `MyLogic 13
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 13
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691450957µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $34 $0D $0A               `MyLogic 14..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 14]: lineParts=[`MyLogic | 14](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 14
[TWO-TIER] UNHANDLED window command: `MyLogic 14
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 14
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691466828µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $35 $0D $0A               `MyLogic 15..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 15]: lineParts=[`MyLogic | 15](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 15
[TWO-TIER] UNHANDLED window command: `MyLogic 15
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 15
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691498860µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $36 $0D $0A               `MyLogic 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 16]: lineParts=[`MyLogic | 16](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 16
[TWO-TIER] UNHANDLED window command: `MyLogic 16
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 16
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691514785µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $37 $0D $0A               `MyLogic 17..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 17]: lineParts=[`MyLogic | 17](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 17
[TWO-TIER] UNHANDLED window command: `MyLogic 17
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 17
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691546756µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $38 $0D $0A               `MyLogic 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 18]: lineParts=[`MyLogic | 18](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 18
[TWO-TIER] UNHANDLED window command: `MyLogic 18
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 18
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691578850µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $39 $0D $0A               `MyLogic 19..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 19]: lineParts=[`MyLogic | 19](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 19
[TWO-TIER] UNHANDLED window command: `MyLogic 19
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 19
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691595046µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $30 $0D $0A               `MyLogic 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 20]: lineParts=[`MyLogic | 20](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 20
[TWO-TIER] UNHANDLED window command: `MyLogic 20
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 20
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691626833µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $31 $0D $0A               `MyLogic 21..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 21]: lineParts=[`MyLogic | 21](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 21
[TWO-TIER] UNHANDLED window command: `MyLogic 21
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 21
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691643202µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $32 $0D $0A               `MyLogic 22..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 22]: lineParts=[`MyLogic | 22](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 22
[TWO-TIER] UNHANDLED window command: `MyLogic 22
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 22
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691675007µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $33 $0D $0A               `MyLogic 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 23]: lineParts=[`MyLogic | 23](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 23
[TWO-TIER] UNHANDLED window command: `MyLogic 23
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 23
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691690450µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $34 $0D $0A               `MyLogic 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 24]: lineParts=[`MyLogic | 24](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 24
[TWO-TIER] UNHANDLED window command: `MyLogic 24
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 24
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691722690µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $35 $0D $0A               `MyLogic 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 25]: lineParts=[`MyLogic | 25](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 25
[TWO-TIER] UNHANDLED window command: `MyLogic 25
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 25
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691754771µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $36 $0D $0A               `MyLogic 26..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 26]: lineParts=[`MyLogic | 26](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 26
[TWO-TIER] UNHANDLED window command: `MyLogic 26
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 26
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691770953µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $37 $0D $0A               `MyLogic 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 27]: lineParts=[`MyLogic | 27](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 27
[TWO-TIER] UNHANDLED window command: `MyLogic 27
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 27
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691803105µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $38 $0D $0A               `MyLogic 28..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 28]: lineParts=[`MyLogic | 28](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 28
[TWO-TIER] UNHANDLED window command: `MyLogic 28
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 28
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691818934µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $39 $0D $0A               `MyLogic 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 29]: lineParts=[`MyLogic | 29](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 29
[TWO-TIER] UNHANDLED window command: `MyLogic 29
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691851137µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $30 $0D $0A               `MyLogic 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 30]: lineParts=[`MyLogic | 30](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 30
[TWO-TIER] UNHANDLED window command: `MyLogic 30
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 30
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691866857µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $31 $0D $0A               `MyLogic 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 31]: lineParts=[`MyLogic | 31](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 31
[TWO-TIER] UNHANDLED window command: `MyLogic 31
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691899124µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $32 $0D $0A               `MyLogic 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 32]: lineParts=[`MyLogic | 32](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 32
[TWO-TIER] UNHANDLED window command: `MyLogic 32
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 32
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651691930549µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $33 $0D $0A               `MyLogic 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 33]: lineParts=[`MyLogic | 33](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 33
[TWO-TIER] UNHANDLED window command: `MyLogic 33
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651691946592µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $34 $0D $0A               `MyLogic 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 34]: lineParts=[`MyLogic | 34](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 34
[TWO-TIER] UNHANDLED window command: `MyLogic 34
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 34
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651691978597µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $35 $0D $0A               `MyLogic 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic 35]: lineParts=[`MyLogic | 35](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic 35
[TWO-TIER] UNHANDLED window command: `MyLogic 35
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693003651µs] Received 58 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $54 $45 $52 $4D $20 $4D $79  $54 $65 $72 $6D $20 $53 $49 $5A   `TERM MyTerm SIZ
  0010: $45 $20 $39 $20 $31 $20 $54 $45  $58 $54 $53 $49 $5A $45 $20 $34   E 9 1 TEXTSIZE 4
  0020: $30 $0D $0A $60 $4D $79 $54 $65  $72 $6D $20 $31 $20 $27 $54 $65   0..`MyTerm 1 'Te
  0030: $6D $70 $20 $3D $20 $35 $30 $27  $0D $0A                           mp = 50'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 58 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 18 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 33 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`TERM MyTerm SIZE 9 1 TEXTSIZE 40]: lineParts=[`TERM | MyTerm | SIZE | 9 | 1 | TEXTSIZE | 40](7)
[TWO-TIER] Window creation - possibleName=[TERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [TERM] in command: `TERM MyTerm SIZE 9 1 TEXTSIZE 40
[TWO-TIER] UNHANDLED window command: `TERM MyTerm SIZE 9 1 TEXTSIZE 40
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 33 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `TERM MyTerm SIZE 9 1 TEXTSIZE 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 50']: lineParts=[`MyTerm | 1 | 'Temp | = | 50'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 50'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 50'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 50'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 79 bytes to log file
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651693099132µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $31 $27 $0D $0A                                        = 51'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 51']: lineParts=[`MyTerm | 1 | 'Temp | = | 51'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 51'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 51'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 51'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693195420µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $32 $27 $0D $0A                                        = 52'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 52']: lineParts=[`MyTerm | 1 | 'Temp | = | 52'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 52'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 52'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 52'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693306917µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $30 $27 $0D $0A                                        = 50'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 50']: lineParts=[`MyTerm | 1 | 'Temp | = | 50'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 50'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 50'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 50'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693403392µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $31 $27 $0D $0A                                        = 51'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 51']: lineParts=[`MyTerm | 1 | 'Temp | = | 51'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 51'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 51'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 51'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693499055µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $32 $27 $0D $0A                                        = 52'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 52']: lineParts=[`MyTerm | 1 | 'Temp | = | 52'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 52'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 52'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 52'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693595525µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $30 $27 $0D $0A                                        = 50'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 50']: lineParts=[`MyTerm | 1 | 'Temp | = | 50'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 50'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 50'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 50'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693707006µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $31 $27 $0D $0A                                        = 51'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 51']: lineParts=[`MyTerm | 1 | 'Temp | = | 51'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 51'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 51'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 51'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651693803103µs] Received 23 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $54 $65 $72 $6D $20  $31 $20 $27 $54 $65 $6D $70 $20   `MyTerm 1 'Temp
  0010: $3D $20 $35 $32 $27 $0D $0A                                        = 52'..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 23 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm 1 'Temp = 52']: lineParts=[`MyTerm | 1 | 'Temp | = | 52'](5)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm 1 'Temp = 52'
[TWO-TIER] UNHANDLED window command: `MyTerm 1 'Temp = 52'
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm 1 'Temp = 52'
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 67 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651694892559µs] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $53 $43 $4F $50 $45 $20 $4D  $79 $53 $63 $6F $70 $65 $20 $53   `SCOPE MyScope S
  0010: $49 $5A $45 $20 $32 $35 $34 $20  $38 $34 $20 $53 $41 $4D $50 $4C   IZE 254 84 SAMPL
  0020: $45 $53 $20 $31 $32 $38 $0D $0A  $60 $4D $79 $53 $63 $6F $70 $65   ES 128..`MyScope
  0030: $20 $27 $53 $61 $77 $74 $6F $6F  $74 $68 $27 $20 $30 $20            'Sawtooth' 0
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX 651694907862µs] Received 28 bytes
[SERIAL RX HEX/ASCII]:
  0000: $36 $33 $20 $36 $34 $20 $31 $30  $20 $25 $31 $31 $31 $31 $0D $0A   63 64 10 %1111..
  0010: $60 $4D $79 $53 $63 $6F $70 $65  $20 $30 $0D $0A                   `MyScope 0..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 28 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 38 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`SCOPE MyScope SIZE 254 84 SAMPLES 128]: lineParts=[`SCOPE | MyScope | SIZE | 254 | 84 | SAMPLES | 128](7)
[TWO-TIER] Window creation - possibleName=[SCOPE], windowType=[SCOPE]
[TWO-TIER] Creating SCOPE window for: `SCOPE MyScope SIZE 254 84 SAMPLES 128
[TWO-TIER] SCOPE parse result: isValid=true
[TWO-TIER] ✅ SCOPE window 'MyScope' created successfully
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 38 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `SCOPE MyScope SIZE 254 84 SAMPL
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 36 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 'Sawtooth' 0 63 64 10 %1111]: lineParts=[`MyScope | 'Sawtooth' | 0 | 63 | 64 | 10 | %1111](7)
scoW: - Queued message for scope (1 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 36 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 'Sawtooth' 0 63 64 10 %
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 0]: lineParts=[`MyScope | 0](2)
scoW: - Queued message for scope (2 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 0
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 84 bytes to log file
[DEBUG LOGGER] Flushed 82 bytes to log file
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 3 messages to window
2025-09-09T05:49:10.327Z [INFO ] REGISTER_INSTANCE: Window instance registered: scope-1757396950327 (scope). Can receive messages to queue.
[SERIAL RX 651694956078µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $0D $0A                   `MyScope 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 10 msg/s, processing: 4ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 1]: lineParts=[`MyScope | 1](2)
scoW: - Queued message for scope (3 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 1
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695003997µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $0D $0A                   `MyScope 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 10 msg/s, processing: 1ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 2]: lineParts=[`MyScope | 2](2)
scoW: - Queued message for scope (4 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 2
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695051882µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $0D $0A                   `MyScope 3..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 3]: lineParts=[`MyScope | 3](2)
scoW: - Queued message for scope (5 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 3
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695099807µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $0D $0A                   `MyScope 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 4]: lineParts=[`MyScope | 4](2)
scoW: - Queued message for scope (6 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695147905µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $0D $0A                   `MyScope 5..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 5]: lineParts=[`MyScope | 5](2)
scoW: - Queued message for scope (7 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 5
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695195974µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $0D $0A                   `MyScope 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 6]: lineParts=[`MyScope | 6](2)
scoW: - Queued message for scope (8 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 6
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695243871µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $37 $0D $0A                   `MyScope 7..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 7]: lineParts=[`MyScope | 7](2)
scoW: - Queued message for scope (9 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 7
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695307773µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $38 $0D $0A                   `MyScope 8..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 8]: lineParts=[`MyScope | 8](2)
scoW: - Queued message for scope (10 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 8
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695355808µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $39 $0D $0A                   `MyScope 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 9]: lineParts=[`MyScope | 9](2)
scoW: - Queued message for scope (11 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 9
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695403743µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $30 $0D $0A               `MyScope 10..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 10]: lineParts=[`MyScope | 10](2)
scoW: - Queued message for scope (12 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 10
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695451810µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $31 $0D $0A               `MyScope 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 11]: lineParts=[`MyScope | 11](2)
scoW: - Queued message for scope (13 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 11
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695499853µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $32 $0D $0A               `MyScope 12..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 12]: lineParts=[`MyScope | 12](2)
scoW: - Queued message for scope (14 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 12
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695547998µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $33 $0D $0A               `MyScope 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 13]: lineParts=[`MyScope | 13](2)
scoW: - Queued message for scope (15 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 13
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695595866µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $34 $0D $0A               `MyScope 14..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 14]: lineParts=[`MyScope | 14](2)
scoW: - Queued message for scope (16 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 14
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695643894µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $35 $0D $0A               `MyScope 15..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 15]: lineParts=[`MyScope | 15](2)
scoW: - Queued message for scope (17 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 15
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695708024µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $36 $0D $0A               `MyScope 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 16]: lineParts=[`MyScope | 16](2)
scoW: - Queued message for scope (18 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 16
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695755906µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $37 $0D $0A               `MyScope 17..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 17]: lineParts=[`MyScope | 17](2)
scoW: - Queued message for scope (19 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 17
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695803749µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $38 $0D $0A               `MyScope 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 18]: lineParts=[`MyScope | 18](2)
scoW: - Queued message for scope (20 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 18
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695851913µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $39 $0D $0A               `MyScope 19..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 19]: lineParts=[`MyScope | 19](2)
scoW: - Queued message for scope (21 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 19
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695899868µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $30 $0D $0A               `MyScope 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 22 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 20]: lineParts=[`MyScope | 20](2)
scoW: - Queued message for scope (22 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 20
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695947925µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $31 $0D $0A               `MyScope 21..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 21]: lineParts=[`MyScope | 21](2)
scoW: - Queued message for scope (23 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 21
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651695995965µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $32 $0D $0A               `MyScope 22..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 22]: lineParts=[`MyScope | 22](2)
scoW: - Queued message for scope (24 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 22
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696060042µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $33 $0D $0A               `MyScope 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 23]: lineParts=[`MyScope | 23](2)
scoW: - Queued message for scope (25 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 23
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696108023µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $34 $0D $0A               `MyScope 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 24]: lineParts=[`MyScope | 24](2)
scoW: - Queued message for scope (26 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 24
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696156279µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $35 $0D $0A               `MyScope 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 25]: lineParts=[`MyScope | 25](2)
scoW: - Queued message for scope (27 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 25
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696204032µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $36 $0D $0A               `MyScope 26..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 26]: lineParts=[`MyScope | 26](2)
scoW: - Queued message for scope (28 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 26
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696251961µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $37 $0D $0A               `MyScope 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 27]: lineParts=[`MyScope | 27](2)
scoW: - Queued message for scope (29 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 27
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696299863µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $38 $0D $0A               `MyScope 28..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 28]: lineParts=[`MyScope | 28](2)
scoW: - Queued message for scope (30 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 28
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696347818µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $39 $0D $0A               `MyScope 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 29]: lineParts=[`MyScope | 29](2)
scoW: - Queued message for scope (31 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696395892µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $30 $0D $0A               `MyScope 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 30]: lineParts=[`MyScope | 30](2)
scoW: - Queued message for scope (32 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 30
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696460014µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $31 $0D $0A               `MyScope 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 31]: lineParts=[`MyScope | 31](2)
scoW: - Queued message for scope (33 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696508026µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $32 $0D $0A               `MyScope 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 32]: lineParts=[`MyScope | 32](2)
scoW: - Queued message for scope (34 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 32
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696558258µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $33 $0D $0A               `MyScope 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 33]: lineParts=[`MyScope | 33](2)
scoW: - Queued message for scope (35 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696604010µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $34 $0D $0A               `MyScope 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 34]: lineParts=[`MyScope | 34](2)
scoW: - Queued message for scope (36 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 34
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696652155µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $35 $0D $0A               `MyScope 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 35]: lineParts=[`MyScope | 35](2)
scoW: - Queued message for scope (37 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696700082µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $36 $0D $0A               `MyScope 36..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 36]: lineParts=[`MyScope | 36](2)
scoW: - Queued message for scope (38 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 36
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696747884µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $37 $0D $0A               `MyScope 37..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 37]: lineParts=[`MyScope | 37](2)
scoW: - Queued message for scope (39 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 37
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696796005µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $38 $0D $0A               `MyScope 38..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 38]: lineParts=[`MyScope | 38](2)
scoW: - Queued message for scope (40 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 38
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696859862µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $39 $0D $0A               `MyScope 39..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 39]: lineParts=[`MyScope | 39](2)
scoW: - Queued message for scope (41 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 39
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696907925µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $30 $0D $0A               `MyScope 40..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 20 msg/s, processing: 1ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 40]: lineParts=[`MyScope | 40](2)
scoW: - Queued message for scope (42 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 40
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651696955998µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $31 $0D $0A               `MyScope 41..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 41]: lineParts=[`MyScope | 41](2)
scoW: - Queued message for scope (43 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 41
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697003999µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $32 $0D $0A               `MyScope 42..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 42]: lineParts=[`MyScope | 42](2)
scoW: - Queued message for scope (44 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 42
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697052007µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $33 $0D $0A               `MyScope 43..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 43]: lineParts=[`MyScope | 43](2)
scoW: - Queued message for scope (45 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 43
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697099957µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $34 $0D $0A               `MyScope 44..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 44]: lineParts=[`MyScope | 44](2)
scoW: - Queued message for scope (46 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 44
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697148057µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $35 $0D $0A               `MyScope 45..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 45]: lineParts=[`MyScope | 45](2)
scoW: - Queued message for scope (47 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 45
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697196017µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $36 $0D $0A               `MyScope 46..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 46]: lineParts=[`MyScope | 46](2)
scoW: - Queued message for scope (48 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 46
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697259817µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $37 $0D $0A               `MyScope 47..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 47]: lineParts=[`MyScope | 47](2)
scoW: - Queued message for scope (49 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 47
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697307782µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $38 $0D $0A               `MyScope 48..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 48]: lineParts=[`MyScope | 48](2)
scoW: - Queued message for scope (50 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 48
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697356004µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $39 $0D $0A               `MyScope 49..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 49]: lineParts=[`MyScope | 49](2)
scoW: - Queued message for scope (51 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 49
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697403950µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $30 $0D $0A               `MyScope 50..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 50]: lineParts=[`MyScope | 50](2)
scoW: - Queued message for scope (52 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 50
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697452022µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $31 $0D $0A               `MyScope 51..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 51]: lineParts=[`MyScope | 51](2)
scoW: - Queued message for scope (53 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 51
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697499954µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $32 $0D $0A               `MyScope 52..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 52]: lineParts=[`MyScope | 52](2)
scoW: - Queued message for scope (54 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 52
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697547920µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $33 $0D $0A               `MyScope 53..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 53]: lineParts=[`MyScope | 53](2)
scoW: - Queued message for scope (55 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 53
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697612062µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $34 $0D $0A               `MyScope 54..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 54]: lineParts=[`MyScope | 54](2)
scoW: - Queued message for scope (56 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 54
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697660044µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $35 $0D $0A               `MyScope 55..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 55]: lineParts=[`MyScope | 55](2)
scoW: - Queued message for scope (57 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 55
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697707857µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $36 $0D $0A               `MyScope 56..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 56]: lineParts=[`MyScope | 56](2)
scoW: - Queued message for scope (58 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 56
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697756054µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $37 $0D $0A               `MyScope 57..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 57]: lineParts=[`MyScope | 57](2)
scoW: - Queued message for scope (59 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 57
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697803941µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $38 $0D $0A               `MyScope 58..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 58]: lineParts=[`MyScope | 58](2)
scoW: - Queued message for scope (60 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 58
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697852025µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $39 $0D $0A               `MyScope 59..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 59]: lineParts=[`MyScope | 59](2)
scoW: - Queued message for scope (61 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 59
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697899989µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $30 $0D $0A               `MyScope 60..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 60]: lineParts=[`MyScope | 60](2)
scoW: - Queued message for scope (62 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 60
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651697947929µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $31 $0D $0A               `MyScope 61..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 21 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 61]: lineParts=[`MyScope | 61](2)
scoW: - Queued message for scope (63 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 61
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698011958µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $32 $0D $0A               `MyScope 62..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 62]: lineParts=[`MyScope | 62](2)
scoW: - Queued message for scope (64 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 62
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698060092µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $33 $0D $0A               `MyScope 63..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 63]: lineParts=[`MyScope | 63](2)
scoW: - Queued message for scope (65 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 63
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698107854µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $30 $0D $0A                   `MyScope 0..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 0]: lineParts=[`MyScope | 0](2)
scoW: - Queued message for scope (66 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 0
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698155848µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $0D $0A                   `MyScope 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 1]: lineParts=[`MyScope | 1](2)
scoW: - Queued message for scope (67 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 1
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698203976µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $0D $0A                   `MyScope 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 2]: lineParts=[`MyScope | 2](2)
scoW: - Queued message for scope (68 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 2
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698252015µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $0D $0A                   `MyScope 3..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 3]: lineParts=[`MyScope | 3](2)
scoW: - Queued message for scope (69 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 3
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698300007µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $0D $0A                   `MyScope 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 4]: lineParts=[`MyScope | 4](2)
scoW: - Queued message for scope (70 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698347969µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $0D $0A                   `MyScope 5..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 5]: lineParts=[`MyScope | 5](2)
scoW: - Queued message for scope (71 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 5
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698412052µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $0D $0A                   `MyScope 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 6]: lineParts=[`MyScope | 6](2)
scoW: - Queued message for scope (72 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 6
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698459814µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $37 $0D $0A                   `MyScope 7..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 7]: lineParts=[`MyScope | 7](2)
scoW: - Queued message for scope (73 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 7
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698507880µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $38 $0D $0A                   `MyScope 8..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 8]: lineParts=[`MyScope | 8](2)
scoW: - Queued message for scope (74 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 8
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698556038µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $39 $0D $0A                   `MyScope 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 9]: lineParts=[`MyScope | 9](2)
scoW: - Queued message for scope (75 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 9
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698604094µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $30 $0D $0A               `MyScope 10..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 10]: lineParts=[`MyScope | 10](2)
scoW: - Queued message for scope (76 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 10
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698652194µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $31 $0D $0A               `MyScope 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 11]: lineParts=[`MyScope | 11](2)
scoW: - Queued message for scope (77 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 11
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698699978µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $32 $0D $0A               `MyScope 12..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 12]: lineParts=[`MyScope | 12](2)
scoW: - Queued message for scope (78 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 12
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698764017µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $33 $0D $0A               `MyScope 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 13]: lineParts=[`MyScope | 13](2)
scoW: - Queued message for scope (79 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 13
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698812070µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $34 $0D $0A               `MyScope 14..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 14]: lineParts=[`MyScope | 14](2)
scoW: - Queued message for scope (80 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 14
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698859996µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $35 $0D $0A               `MyScope 15..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 15]: lineParts=[`MyScope | 15](2)
scoW: - Queued message for scope (81 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 15
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698907872µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $36 $0D $0A               `MyScope 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 16]: lineParts=[`MyScope | 16](2)
scoW: - Queued message for scope (82 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 16
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651698956109µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $37 $0D $0A               `MyScope 17..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 20 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 17]: lineParts=[`MyScope | 17](2)
scoW: - Queued message for scope (83 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 17
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699003992µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $38 $0D $0A               `MyScope 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 18]: lineParts=[`MyScope | 18](2)
scoW: - Queued message for scope (84 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 18
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699052150µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $39 $0D $0A               `MyScope 19..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 19]: lineParts=[`MyScope | 19](2)
scoW: - Queued message for scope (85 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 19
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699099994µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $30 $0D $0A               `MyScope 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 20]: lineParts=[`MyScope | 20](2)
scoW: - Queued message for scope (86 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 20
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699164117µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $31 $0D $0A               `MyScope 21..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 21]: lineParts=[`MyScope | 21](2)
scoW: - Queued message for scope (87 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 21
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699212086µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $32 $0D $0A               `MyScope 22..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 22]: lineParts=[`MyScope | 22](2)
scoW: - Queued message for scope (88 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 22
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699259804µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $33 $0D $0A               `MyScope 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 23]: lineParts=[`MyScope | 23](2)
scoW: - Queued message for scope (89 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 23
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699307809µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $34 $0D $0A               `MyScope 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 24]: lineParts=[`MyScope | 24](2)
scoW: - Queued message for scope (90 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 24
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699356003µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $35 $0D $0A               `MyScope 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 25]: lineParts=[`MyScope | 25](2)
scoW: - Queued message for scope (91 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 25
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699404024µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $36 $0D $0A               `MyScope 26..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 26]: lineParts=[`MyScope | 26](2)
scoW: - Queued message for scope (92 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 26
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699451974µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $37 $0D $0A               `MyScope 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 27]: lineParts=[`MyScope | 27](2)
scoW: - Queued message for scope (93 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 27
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699499981µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $38 $0D $0A               `MyScope 28..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 28]: lineParts=[`MyScope | 28](2)
scoW: - Queued message for scope (94 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 28
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699564038µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $39 $0D $0A               `MyScope 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 29]: lineParts=[`MyScope | 29](2)
scoW: - Queued message for scope (95 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699612113µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $30 $0D $0A               `MyScope 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 30]: lineParts=[`MyScope | 30](2)
scoW: - Queued message for scope (96 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 30
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699659786µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $31 $0D $0A               `MyScope 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 31]: lineParts=[`MyScope | 31](2)
scoW: - Queued message for scope (97 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699707802µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $32 $0D $0A               `MyScope 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 32]: lineParts=[`MyScope | 32](2)
scoW: - Queued message for scope (98 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 32
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699756020µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $33 $0D $0A               `MyScope 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 33]: lineParts=[`MyScope | 33](2)
scoW: - Queued message for scope (99 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699804010µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $34 $0D $0A               `MyScope 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 34]: lineParts=[`MyScope | 34](2)
scoW: - Queued message for scope (100 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 34
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651699852015µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $35 $0D $0A               `MyScope 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 35]: lineParts=[`MyScope | 35](2)
scoW: - Queued message for scope (101 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651702908445µs] Received 47 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $63 $6C $6F $73 $65 $0D $0A   `MyLogic close..
  0010: $60 $4D $79 $54 $65 $72 $6D $20  $63 $6C $6F $73 $65 $0D $0A $60   `MyTerm close..`
  0020: $4D $79 $53 $63 $6F $70 $65 $20  $63 $6C $6F $73 $65 $0D $0A       MyScope close..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 47 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 14 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyLogic close]: lineParts=[`MyLogic | close](2)
[TWO-TIER] Window creation - possibleName=[MYLOGIC], windowType=[LOGIC]
[TWO-TIER] ERROR: Unsupported window type [MYLOGIC] in command: `MyLogic close
[TWO-TIER] UNHANDLED window command: `MyLogic close
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 14 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyLogic close
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 13 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyTerm close]: lineParts=[`MyTerm | close](2)
[TWO-TIER] Window creation - possibleName=[MYTERM], windowType=[TERM]
[TWO-TIER] ERROR: Unsupported window type [MYTERM] in command: `MyTerm close
[TWO-TIER] UNHANDLED window command: `MyTerm close
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 13 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyTerm close
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 14 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope close]: lineParts=[`MyScope | close](2)
scoW: - Queued message for scope (102 in queue)
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 14 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope close
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 60 bytes to log file
[DEBUG LOGGER] Flushed 59 bytes to log file
[DEBUG LOGGER] Flushed 60 bytes to log file
[DEBUG LOGGER] Sending batch of 3 messages to window
