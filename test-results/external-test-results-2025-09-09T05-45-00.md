# External Test Results - 2025-09-09T05:45:00

## Test Session Information
- **Date**: September 9, 2025
- **Time**: 05:45:00 UTC
- **Build**: SCOPE window isolation test (LOGIC/TERM disabled)
- **Package**: electron-ready-macos.tar.gz (created at 05:42 UTC)
- **Context**: Testing SCOPE window creation and data display

## Fixes Applied Since Last Test

### 1. SCOPE Window Immediate Creation
- **File**: `debugScopeWin.ts`
- **Change**: Added `createDebugWindow()` to constructor (line 220)
- **Impact**: Window creates immediately instead of waiting for numeric data

### 2. Fixed Message Queue Processing
- **File**: `debugScopeWin.ts`  
- **Change**: Added `onWindowReady()` to did-finish-load handler (line 652)
- **Impact**: Critical fix - messages now process instead of queuing forever

### 3. Removed Duplicate Window Creation
- **File**: `debugScopeWin.ts`
- **Change**: Removed duplicate `createDebugWindow()` call on first numeric data
- **Impact**: Prevents double window creation attempts

### 4. Temporarily Disabled Other Windows
- **File**: `mainWindow.ts`
- **Change**: Commented out LOGIC and TERM window creation
- **Impact**: Isolates SCOPE window for testing

## Test Results

### System Stability
- **JavaScript Errors**: [AWAITING]
- **Window Crashes**: None
- **Unhandled Rejections**: [AWAITING]

### Device Connection
- **Status**: ✅ Connected
- **Device**: /dev/tty.usbserial
- **Connection**: Working, data flowing

### Window Creation
- **LOGIC Window**: N/A - Disabled for testing
- **TERM Window**: N/A - Disabled for testing
- **SCOPE Window**: ✅ APPEARED! 
- **Debug Logger**: ✅ Created and working

### Data Display
- **LOGIC Data Visible**: N/A - Disabled
- **TERM Data Visible**: N/A - Disabled
- **SCOPE Data Visible**: ❌ NO DATA/TRACES DISPLAYED
- **Data Parsing**: ✅ Working

### Debug Logger Behavior
- **Initial Position**: ✅ CORRECTLY AT BOTTOM
- **Scrolls to Bottom**: ✅ WORKING
- **Stays at Bottom**: ✅ WORKING
- **Performance**: ✅ Good

### SCOPE Window Issues
- **Window Size**: ❌ INCORRECT SIZE
- **Data Display**: ❌ NO TRACES VISIBLE
- **Window Appears**: ✅ YES - Progress!

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
2025-09-09T05:42:42.580Z [INFO ] STARTUP: WindowRouter initialized
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
2025-09-09T05:42:42.777Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger). Can receive messages to queue.
2025-09-09T05:42:42.785Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1
[DEBUG LOGGER] Window did-finish-load event fired!
[DEBUG LOGGER] Window shown and focused
?Base?: Debug Logger window ready
[DEBUG LOGGER] Verified still registered: DebugLogger
[DEBUG LOGGER] Creating logs directory at: /Users/stephen/logs
[UTIL] Log folder already exists at: /Users/stephen/logs
[DEBUG LOGGER] Log file path: /Users/stephen/logs/debug_250908-2342.log
[DEBUG LOGGER] Write stream created successfully
[DEBUG LOGGER] Log file initialized successfully at: /Users/stephen/logs/debug_250908-2342.log
[DEBUG LOGGER] Started new log: /Users/stephen/logs/debug_250908-2342.log
[DEBUG LOGGER] Write stream opened with fd: 59
[DEBUG LOGGER] Log file header written and flushed
[DEBUG LOGGER] Log file synced to disk
[SERIAL RX 651309593606µs] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 0ms)
[SERIAL RX 651309599186µs] Received 124 bytes
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
[SERIAL RX 651309609495µs] Received 51 bytes
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
[SERIAL RX 651309625195µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $0D $0A                   `MyLogic 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 0 msg/s, processing: 4ms)
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
[DEBUG LOGGER] Sending batch of 7 messages to window
[SERIAL RX 651309657103µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $0D $0A                   `MyLogic 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 1ms)
[SERIAL RX 651309673054µs] Received 12 bytes
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
[SERIAL RX 651309705126µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $0D $0A                   `MyLogic 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[SERIAL RX 651309721321µs] Received 12 bytes
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
[SERIAL RX 651309753276µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $0D $0A                   `MyLogic 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[SERIAL RX 651309769286µs] Received 12 bytes
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
[SERIAL RX 651309801181µs] Received 12 bytes
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
[SERIAL RX 651309833139µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $39 $0D $0A                   `MyLogic 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651309849185µs] Received 13 bytes
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
[SERIAL RX 651309881205µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $31 $0D $0A               `MyLogic 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651309897244µs] Received 13 bytes
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
[SERIAL RX 651309929152µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $33 $0D $0A               `MyLogic 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651309945569µs] Received 13 bytes
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
[SERIAL RX 651309977456µs] Received 13 bytes
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
[SERIAL RX 651310009303µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $36 $0D $0A               `MyLogic 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651310026409µs] Received 13 bytes
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
[SERIAL RX 651310057233µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $38 $0D $0A               `MyLogic 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310073282µs] Received 13 bytes
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
[SERIAL RX 651310105409µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $30 $0D $0A               `MyLogic 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310121627µs] Received 13 bytes
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
[SERIAL RX 651310153324µs] Received 13 bytes
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
[SERIAL RX 651310185091µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $33 $0D $0A               `MyLogic 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651310201304µs] Received 13 bytes
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
[SERIAL RX 651310233213µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $35 $0D $0A               `MyLogic 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310249302µs] Received 13 bytes
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
[SERIAL RX 651310281221µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $37 $0D $0A               `MyLogic 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310297155µs] Received 13 bytes
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
[SERIAL RX 651310329113µs] Received 13 bytes
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
[SERIAL RX 651310361196µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $30 $0D $0A               `MyLogic 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651310377144µs] Received 13 bytes
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
[SERIAL RX 651310409214µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $32 $0D $0A               `MyLogic 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310425248µs] Received 13 bytes
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
[SERIAL RX 651310457268µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $34 $0D $0A               `MyLogic 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310473376µs] Received 13 bytes
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
[SERIAL RX 651310505233µs] Received 13 bytes
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
[SERIAL RX 651310537064µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $37 $0D $0A               `MyLogic 37..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651310553301µs] Received 13 bytes
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
[SERIAL RX 651310585270µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $39 $0D $0A               `MyLogic 39..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[SERIAL RX 651310601264µs] Received 13 bytes
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
[SERIAL RX 651310633403µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $31 $0D $0A               `MyLogic 41..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 46 msg/s, processing: 0ms)
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
[SERIAL RX 651310649275µs] Received 13 bytes
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
[SERIAL RX 651310681279µs] Received 13 bytes
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
[SERIAL RX 651310697352µs] Received 13 bytes
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
[SERIAL RX 651310729298µs] Received 13 bytes
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
[SERIAL RX 651310761395µs] Received 13 bytes
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
[SERIAL RX 651310777230µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $34 $37 $0D $0A               `MyLogic 47..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651310809266µs] Received 13 bytes
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
[SERIAL RX 651310825242µs] Received 13 bytes
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
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651310857148µs] Received 13 bytes
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
[SERIAL RX 651310873047µs] Received 13 bytes
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
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651310905297µs] Received 13 bytes
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
[SERIAL RX 651310937200µs] Received 13 bytes
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
[SERIAL RX 651310953393µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $34 $0D $0A               `MyLogic 54..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651310985215µs] Received 13 bytes
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
[SERIAL RX 651311001175µs] Received 13 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651311033149µs] Received 13 bytes
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
[SERIAL RX 651311049321µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $35 $38 $0D $0A               `MyLogic 58..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
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
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651311081053µs] Received 13 bytes
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
[SERIAL RX 651311113048µs] Received 13 bytes
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
[SERIAL RX 651311129218µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $31 $0D $0A               `MyLogic 61..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651311161174µs] Received 13 bytes
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
[SERIAL RX 651311177278µs] Received 13 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651311209255µs] Received 12 bytes
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
[SERIAL RX 651311225171µs] Received 12 bytes
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
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651311257186µs] Received 12 bytes
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
[SERIAL RX 651311289092µs] Received 12 bytes
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
[SERIAL RX 651311305003µs] Received 12 bytes
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
[SERIAL RX 651311337031µs] Received 12 bytes
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
[SERIAL RX 651311353006µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $36 $0D $0A                   `MyLogic 6..
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651311385106µs] Received 12 bytes
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
[SERIAL RX 651311401268µs] Received 12 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 56 bytes to log file
[SERIAL RX 651311433145µs] Received 12 bytes
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
[SERIAL RX 651311449006µs] Received 11 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $31 $30                       `MyLogic 10
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 11 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651311465006µs] Received 2 bytes
[SERIAL RX HEX/ASCII]:
  0000: $0D $0A                                                            ..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 2 bytes, running: true
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
[SERIAL RX 651311481102µs] Received 13 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651311513136µs] Received 13 bytes
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
[SERIAL RX 651311529163µs] Received 13 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651311561279µs] Received 13 bytes
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
[SERIAL RX 651311577257µs] Received 13 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651311609295µs] Received 13 bytes
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
[SERIAL RX 651311625212µs] Received 13 bytes
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
[SERIAL RX 651311657278µs] Received 13 bytes
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
[SERIAL RX 651311689319µs] Received 13 bytes
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
[SERIAL RX 651311705460µs] Received 13 bytes
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
[SERIAL RX 651311737407µs] Received 13 bytes
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
[SERIAL RX 651311753283µs] Received 13 bytes
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
[SERIAL RX 651311785201µs] Received 13 bytes
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
[SERIAL RX 651311801319µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $34 $0D $0A               `MyLogic 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
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
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651311833171µs] Received 13 bytes
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
[SERIAL RX 651311865369µs] Received 13 bytes
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
[SERIAL RX 651311881344µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $32 $37 $0D $0A               `MyLogic 27..
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[DEBUG LOGGER] Flushed 57 bytes to log file
[SERIAL RX 651311913208µs] Received 13 bytes
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
[SERIAL RX 651311929129µs] Received 13 bytes
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
[DEBUG LOGGER] Sending batch of 2 messages to window
[SERIAL RX 651311961320µs] Received 13 bytes
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
[SERIAL RX 651311980403µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $4C $6F $67 $69 $63  $20 $33 $31 $0D $0A               `MyLogic 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
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
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651312009205µs] Received 13 bytes
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
[SERIAL RX 651312041371µs] Received 13 bytes
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
[SERIAL RX 651312057270µs] Received 13 bytes
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
[SERIAL RX 651312089193µs] Received 13 bytes
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
[SERIAL RX 651313113782µs] Received 58 bytes
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
[SERIAL RX 651313209264µs] Received 23 bytes
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
[SERIAL RX 651313305429µs] Received 23 bytes
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
[SERIAL RX 651313417270µs] Received 23 bytes
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
[SERIAL RX 651313513508µs] Received 23 bytes
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
[SERIAL RX 651313609489µs] Received 23 bytes
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
[SERIAL RX 651313705534µs] Received 23 bytes
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
[SERIAL RX 651313817391µs] Received 23 bytes
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
[SERIAL RX 651313913531µs] Received 23 bytes
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
[SERIAL RX 651315003761µs] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $53 $43 $4F $50 $45 $20 $4D  $79 $53 $63 $6F $70 $65 $20 $53   `SCOPE MyScope S
  0010: $49 $5A $45 $20 $32 $35 $34 $20  $38 $34 $20 $53 $41 $4D $50 $4C   IZE 254 84 SAMPL
  0020: $45 $53 $20 $31 $32 $38 $0D $0A  $60 $4D $79 $53 $63 $6F $70 $65   ES 128..`MyScope
  0030: $20 $27 $53 $61 $77 $74 $6F $6F  $74 $68 $27 $20 $30 $20            'Sawtooth' 0
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX 651315020859µs] Received 28 bytes
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
scoW: Creating SCOPE window immediately for MyScope
scoW: at createDebugWindow() SCOPE
scoW: at createDebugWindow() SCOPE with NO channels!
scoW: at createDebugWindow() SCOPE set up done... w/0 canvase(s)
scoW:   -- SCOPE using auto-placement: 1982,45
scoW:   -- SCOPE window size: 276x84 @1982,45
scoW: - New DebugScopeWindow window
scoW: at createDebugWindow() SCOPE with htmlContent length: 5241
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
[SERIAL RX 651315069410µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $0D $0A                   `MyScope 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[MessageRouter] Adaptive timer: 2ms (velocity: 10 msg/s, processing: 32ms)
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
[DEBUG LOGGER] Sending batch of 4 messages to window
scoW: * Scope window shown
2025-09-09T05:42:50.437Z [INFO ] REGISTER_INSTANCE: Window instance registered: scope-1757396570437 (scope). Can receive messages to queue.
[SERIAL RX 651315115183µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $0D $0A                   `MyScope 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 10 msg/s, processing: 0ms)
scoW: * Scope window title updated
scoW: at did-finish-load
scoW: - Window marked as ready for scope
scoW: - Processing 3 queued messages
scoW: at updateContent() with lineParts=[`MyScope, 'Sawtooth', 0, 63, 64, 10, %1111]
scoW: isSpinNumber(0): isValid=(true)  -> (0)
scoW: isSpinNumber(63): isValid=(true)  -> (63)
scoW: isSpinNumber(64): isValid=(true)  -> (64)
scoW: isSpinNumber(10): isValid=(true)  -> (10)
scoW: at updateContent() w/[`MyScope 'Sawtooth' 0 63 64 10 %1111]
scoW: at updateContent() with channelSpec: {
  "name": "Sawtooth",
  "minValue": 0,
  "maxValue": 63,
  "ySize": 64,
  "yBaseOffset": 10,
  "lgndShowMax": true,
  "lgndShowMin": true,
  "lgndShowMaxLine": true,
  "lgndShowMinLine": true,
  "color": "#00ff00",
  "gridColor": "#006600",
  "textColor": "#00cc00"
}
scoW: at updateContent() with lineParts=[`MyScope, 0]
scoW: at updateContent() with numeric data: [`MyScope,0](2)
scoW: isSpinNumber(0): isValid=(true)  -> (0)
scoW: at calculateAutoTriggerAndScale()
scoW: at initChannelSamples()
scoW:   -- [[
  {
    "samples": []
  }
]]
scoW: isSpinNumber(0): isValid=(true)  -> (0)
scoW: * UPD-INFO channels=1, samples=1, samples=[0]
scoW: * UPD-INFO recorded sample 0 for channel 0, channelSamples[0].samples.length=1
scoW: at updateScopeChannelData(channel-0, w/#1) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(0) => (0->63) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(0) => (0->63) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #1 currSample=(0->63) @ rc=[74,0], prev=[74,-2]
scoW: at updateContent() with lineParts=[`MyScope, 1]
scoW: at updateContent() with numeric data: [`MyScope,1](2)
scoW: isSpinNumber(1): isValid=(true)  -> (1)
scoW: isSpinNumber(1): isValid=(true)  -> (1)
scoW: * UPD-INFO channels=1, samples=1, samples=[1]
scoW: * UPD-INFO recorded sample 1 for channel 0, channelSamples[0].samples.length=2
scoW: at updateScopeChannelData(channel-0, w/#2) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(1) => (1->62) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(0) => (0->63) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #2 currSample=(1->62) @ rc=[73,2], prev=[74,0]
scoW: - Transitioning to IMMEDIATE processing (no batching delays)
scoW: - Immediate processing active (zero delay)
scoW: at updateScopeChannelLabel(Sawtooth, #00ff00)
scoW: at drawHorizontalLineAndValue(channel-0, 63, #006600, #00cc00)
scoW:   -- atTop=(true), lineY=(9), valueText=[+63 ]
scoW: at drawHorizontalLineAndValue(channel-0, 0, #006600, #00cc00)
scoW:   -- atTop=(false), lineY=(76), valueText=[+0 ]
scoW: * Scope window will show...
scoW: at ready-to-show
scoW: - Registered with WindowRouter: scope-1757396570437 (scope)
scoW: - Window already marked as ready
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 2]: lineParts=[`MyScope | 2](2)
scoW: at updateContent() with lineParts=[`MyScope, 2]
scoW: at updateContent() with numeric data: [`MyScope,2](2)
scoW: isSpinNumber(2): isValid=(true)  -> (2)
scoW: isSpinNumber(2): isValid=(true)  -> (2)
scoW: * UPD-INFO channels=1, samples=1, samples=[2]
scoW: * UPD-INFO recorded sample 2 for channel 0, channelSamples[0].samples.length=3
scoW: at updateScopeChannelData(channel-0, w/#3) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(2) => (2->61) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(1) => (1->62) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #3 currSample=(2->61) @ rc=[72,4], prev=[73,2]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 2
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
(node:4143) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(Use `Electron --trace-warnings ...` to show where the warning was created)
(node:4143) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 1)
(node:4143) UnhandledPromiseRejectionWarning: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
(node:4143) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 2)
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315163278µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $0D $0A                   `MyScope 3..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
2025-09-09T05:42:50.547Z [INFO ] REGISTER: Window registered: scope-1757396570437 (scope). Active windows: 2
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 3]: lineParts=[`MyScope | 3](2)
scoW: at updateContent() with lineParts=[`MyScope, 3]
scoW: at updateContent() with numeric data: [`MyScope,3](2)
scoW: isSpinNumber(3): isValid=(true)  -> (3)
scoW: isSpinNumber(3): isValid=(true)  -> (3)
scoW: * UPD-INFO channels=1, samples=1, samples=[3]
scoW: * UPD-INFO recorded sample 3 for channel 0, channelSamples[0].samples.length=4
scoW: at updateScopeChannelData(channel-0, w/#4) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(3) => (3->60) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(2) => (2->61) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #4 currSample=(3->60) @ rc=[71,6], prev=[72,4]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 3
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315211094µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $0D $0A                   `MyScope 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 4]: lineParts=[`MyScope | 4](2)
scoW: at updateContent() with lineParts=[`MyScope, 4]
scoW: at updateContent() with numeric data: [`MyScope,4](2)
scoW: isSpinNumber(4): isValid=(true)  -> (4)
scoW: isSpinNumber(4): isValid=(true)  -> (4)
scoW: * UPD-INFO channels=1, samples=1, samples=[4]
scoW: * UPD-INFO recorded sample 4 for channel 0, channelSamples[0].samples.length=5
scoW: at updateScopeChannelData(channel-0, w/#5) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(4) => (4->59) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(3) => (3->60) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #5 currSample=(4->59) @ rc=[70,8], prev=[71,6]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315259212µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $0D $0A                   `MyScope 5..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 5]: lineParts=[`MyScope | 5](2)
scoW: at updateContent() with lineParts=[`MyScope, 5]
scoW: at updateContent() with numeric data: [`MyScope,5](2)
scoW: isSpinNumber(5): isValid=(true)  -> (5)
scoW: isSpinNumber(5): isValid=(true)  -> (5)
scoW: * UPD-INFO channels=1, samples=1, samples=[5]
scoW: * UPD-INFO recorded sample 5 for channel 0, channelSamples[0].samples.length=6
scoW: at updateScopeChannelData(channel-0, w/#6) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(5) => (5->58) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(4) => (4->59) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #6 currSample=(5->58) @ rc=[69,10], prev=[70,8]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 5
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315307313µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $0D $0A                   `MyScope 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 6]: lineParts=[`MyScope | 6](2)
scoW: at updateContent() with lineParts=[`MyScope, 6]
scoW: at updateContent() with numeric data: [`MyScope,6](2)
scoW: isSpinNumber(6): isValid=(true)  -> (6)
scoW: isSpinNumber(6): isValid=(true)  -> (6)
scoW: * UPD-INFO channels=1, samples=1, samples=[6]
scoW: * UPD-INFO recorded sample 6 for channel 0, channelSamples[0].samples.length=7
scoW: at updateScopeChannelData(channel-0, w/#7) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(6) => (6->57) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(5) => (5->58) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #7 currSample=(6->57) @ rc=[68,12], prev=[69,10]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 6
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315355180µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $37 $0D $0A                   `MyScope 7..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 7]: lineParts=[`MyScope | 7](2)
scoW: at updateContent() with lineParts=[`MyScope, 7]
scoW: at updateContent() with numeric data: [`MyScope,7](2)
scoW: isSpinNumber(7): isValid=(true)  -> (7)
scoW: isSpinNumber(7): isValid=(true)  -> (7)
scoW: * UPD-INFO channels=1, samples=1, samples=[7]
scoW: * UPD-INFO recorded sample 7 for channel 0, channelSamples[0].samples.length=8
scoW: at updateScopeChannelData(channel-0, w/#8) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(7) => (7->56) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(6) => (6->57) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #8 currSample=(7->56) @ rc=[67,14], prev=[68,12]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 7
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315419295µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $38 $0D $0A                   `MyScope 8..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 8]: lineParts=[`MyScope | 8](2)
scoW: at updateContent() with lineParts=[`MyScope, 8]
scoW: at updateContent() with numeric data: [`MyScope,8](2)
scoW: isSpinNumber(8): isValid=(true)  -> (8)
scoW: isSpinNumber(8): isValid=(true)  -> (8)
scoW: * UPD-INFO channels=1, samples=1, samples=[8]
scoW: * UPD-INFO recorded sample 8 for channel 0, channelSamples[0].samples.length=9
scoW: at updateScopeChannelData(channel-0, w/#9) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(8) => (8->55) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(7) => (7->56) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #9 currSample=(8->55) @ rc=[66,16], prev=[67,14]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 8
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315467302µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $39 $0D $0A                   `MyScope 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 9]: lineParts=[`MyScope | 9](2)
scoW: at updateContent() with lineParts=[`MyScope, 9]
scoW: at updateContent() with numeric data: [`MyScope,9](2)
scoW: isSpinNumber(9): isValid=(true)  -> (9)
scoW: isSpinNumber(9): isValid=(true)  -> (9)
scoW: * UPD-INFO channels=1, samples=1, samples=[9]
scoW: * UPD-INFO recorded sample 9 for channel 0, channelSamples[0].samples.length=10
scoW: at updateScopeChannelData(channel-0, w/#10) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(9) => (9->54) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(8) => (8->55) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #10 currSample=(9->54) @ rc=[65,18], prev=[66,16]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 9
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315515250µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $30 $0D $0A               `MyScope 10..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 10]: lineParts=[`MyScope | 10](2)
scoW: at updateContent() with lineParts=[`MyScope, 10]
scoW: at updateContent() with numeric data: [`MyScope,10](2)
scoW: isSpinNumber(10): isValid=(true)  -> (10)
scoW: isSpinNumber(10): isValid=(true)  -> (10)
scoW: * UPD-INFO channels=1, samples=1, samples=[10]
scoW: * UPD-INFO recorded sample 10 for channel 0, channelSamples[0].samples.length=11
scoW: at updateScopeChannelData(channel-0, w/#11) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(10) => (10->53) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(9) => (9->54) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #11 currSample=(10->53) @ rc=[64,20], prev=[65,18]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 10
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315563190µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $31 $0D $0A               `MyScope 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 11]: lineParts=[`MyScope | 11](2)
scoW: at updateContent() with lineParts=[`MyScope, 11]
scoW: at updateContent() with numeric data: [`MyScope,11](2)
scoW: isSpinNumber(11): isValid=(true)  -> (11)
scoW: isSpinNumber(11): isValid=(true)  -> (11)
scoW: * UPD-INFO channels=1, samples=1, samples=[11]
scoW: * UPD-INFO recorded sample 11 for channel 0, channelSamples[0].samples.length=12
scoW: at updateScopeChannelData(channel-0, w/#12) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(11) => (11->52) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(10) => (10->53) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #12 currSample=(11->52) @ rc=[63,22], prev=[64,20]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 11
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315611261µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $32 $0D $0A               `MyScope 12..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 12]: lineParts=[`MyScope | 12](2)
scoW: at updateContent() with lineParts=[`MyScope, 12]
scoW: at updateContent() with numeric data: [`MyScope,12](2)
scoW: isSpinNumber(12): isValid=(true)  -> (12)
scoW: isSpinNumber(12): isValid=(true)  -> (12)
scoW: * UPD-INFO channels=1, samples=1, samples=[12]
scoW: * UPD-INFO recorded sample 12 for channel 0, channelSamples[0].samples.length=13
scoW: at updateScopeChannelData(channel-0, w/#13) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(12) => (12->51) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(11) => (11->52) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #13 currSample=(12->51) @ rc=[62,24], prev=[63,22]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 12
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315659378µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $33 $0D $0A               `MyScope 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 13]: lineParts=[`MyScope | 13](2)
scoW: at updateContent() with lineParts=[`MyScope, 13]
scoW: at updateContent() with numeric data: [`MyScope,13](2)
scoW: isSpinNumber(13): isValid=(true)  -> (13)
scoW: isSpinNumber(13): isValid=(true)  -> (13)
scoW: * UPD-INFO channels=1, samples=1, samples=[13]
scoW: * UPD-INFO recorded sample 13 for channel 0, channelSamples[0].samples.length=14
scoW: at updateScopeChannelData(channel-0, w/#14) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(13) => (13->50) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(12) => (12->51) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #14 currSample=(13->50) @ rc=[61,26], prev=[62,24]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 13
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315707384µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $34 $0D $0A               `MyScope 14..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 14]: lineParts=[`MyScope | 14](2)
scoW: at updateContent() with lineParts=[`MyScope, 14]
scoW: at updateContent() with numeric data: [`MyScope,14](2)
scoW: isSpinNumber(14): isValid=(true)  -> (14)
scoW: isSpinNumber(14): isValid=(true)  -> (14)
scoW: * UPD-INFO channels=1, samples=1, samples=[14]
scoW: * UPD-INFO recorded sample 14 for channel 0, channelSamples[0].samples.length=15
scoW: at updateScopeChannelData(channel-0, w/#15) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(14) => (14->49) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(13) => (13->50) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #15 currSample=(14->49) @ rc=[60,28], prev=[61,26]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 14
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315755461µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $35 $0D $0A               `MyScope 15..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 15]: lineParts=[`MyScope | 15](2)
scoW: at updateContent() with lineParts=[`MyScope, 15]
scoW: at updateContent() with numeric data: [`MyScope,15](2)
scoW: isSpinNumber(15): isValid=(true)  -> (15)
scoW: isSpinNumber(15): isValid=(true)  -> (15)
scoW: * UPD-INFO channels=1, samples=1, samples=[15]
scoW: * UPD-INFO recorded sample 15 for channel 0, channelSamples[0].samples.length=16
scoW: at updateScopeChannelData(channel-0, w/#16) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(15) => (15->48) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(14) => (14->49) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #16 currSample=(15->48) @ rc=[59,30], prev=[60,28]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 15
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315819321µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $36 $0D $0A               `MyScope 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 16]: lineParts=[`MyScope | 16](2)
scoW: at updateContent() with lineParts=[`MyScope, 16]
scoW: at updateContent() with numeric data: [`MyScope,16](2)
scoW: isSpinNumber(16): isValid=(true)  -> (16)
scoW: isSpinNumber(16): isValid=(true)  -> (16)
scoW: * UPD-INFO channels=1, samples=1, samples=[16]
scoW: * UPD-INFO recorded sample 16 for channel 0, channelSamples[0].samples.length=17
scoW: at updateScopeChannelData(channel-0, w/#17) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(16) => (16->47) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(15) => (15->48) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #17 currSample=(16->47) @ rc=[58,32], prev=[59,30]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 16
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315867329µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $37 $0D $0A               `MyScope 17..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 17]: lineParts=[`MyScope | 17](2)
scoW: at updateContent() with lineParts=[`MyScope, 17]
scoW: at updateContent() with numeric data: [`MyScope,17](2)
scoW: isSpinNumber(17): isValid=(true)  -> (17)
scoW: isSpinNumber(17): isValid=(true)  -> (17)
scoW: * UPD-INFO channels=1, samples=1, samples=[17]
scoW: * UPD-INFO recorded sample 17 for channel 0, channelSamples[0].samples.length=18
scoW: at updateScopeChannelData(channel-0, w/#18) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(17) => (17->46) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(16) => (16->47) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #18 currSample=(17->46) @ rc=[57,34], prev=[58,32]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 17
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315915249µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $38 $0D $0A               `MyScope 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 18]: lineParts=[`MyScope | 18](2)
scoW: at updateContent() with lineParts=[`MyScope, 18]
scoW: at updateContent() with numeric data: [`MyScope,18](2)
scoW: isSpinNumber(18): isValid=(true)  -> (18)
scoW: isSpinNumber(18): isValid=(true)  -> (18)
scoW: * UPD-INFO channels=1, samples=1, samples=[18]
scoW: * UPD-INFO recorded sample 18 for channel 0, channelSamples[0].samples.length=19
scoW: at updateScopeChannelData(channel-0, w/#19) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(18) => (18->45) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(17) => (17->46) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #19 currSample=(18->45) @ rc=[56,36], prev=[57,34]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 18
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651315963254µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $39 $0D $0A               `MyScope 19..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 19]: lineParts=[`MyScope | 19](2)
scoW: at updateContent() with lineParts=[`MyScope, 19]
scoW: at updateContent() with numeric data: [`MyScope,19](2)
scoW: isSpinNumber(19): isValid=(true)  -> (19)
scoW: isSpinNumber(19): isValid=(true)  -> (19)
scoW: * UPD-INFO channels=1, samples=1, samples=[19]
scoW: * UPD-INFO recorded sample 19 for channel 0, channelSamples[0].samples.length=20
scoW: at updateScopeChannelData(channel-0, w/#20) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(19) => (19->44) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(18) => (18->45) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #20 currSample=(19->44) @ rc=[55,38], prev=[56,36]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 19
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316011432µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $30 $0D $0A               `MyScope 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 22 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 20]: lineParts=[`MyScope | 20](2)
scoW: at updateContent() with lineParts=[`MyScope, 20]
scoW: at updateContent() with numeric data: [`MyScope,20](2)
scoW: isSpinNumber(20): isValid=(true)  -> (20)
scoW: isSpinNumber(20): isValid=(true)  -> (20)
scoW: * UPD-INFO channels=1, samples=1, samples=[20]
scoW: * UPD-INFO recorded sample 20 for channel 0, channelSamples[0].samples.length=21
scoW: at updateScopeChannelData(channel-0, w/#21) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(20) => (20->43) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(19) => (19->44) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #21 currSample=(20->43) @ rc=[54,40], prev=[55,38]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 20
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316059361µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $31 $0D $0A               `MyScope 21..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 21]: lineParts=[`MyScope | 21](2)
scoW: at updateContent() with lineParts=[`MyScope, 21]
scoW: at updateContent() with numeric data: [`MyScope,21](2)
scoW: isSpinNumber(21): isValid=(true)  -> (21)
scoW: isSpinNumber(21): isValid=(true)  -> (21)
scoW: * UPD-INFO channels=1, samples=1, samples=[21]
scoW: * UPD-INFO recorded sample 21 for channel 0, channelSamples[0].samples.length=22
scoW: at updateScopeChannelData(channel-0, w/#22) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(21) => (21->42) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(20) => (20->43) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #22 currSample=(21->42) @ rc=[53,42], prev=[54,40]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 21
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316107374µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $32 $0D $0A               `MyScope 22..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 22]: lineParts=[`MyScope | 22](2)
scoW: at updateContent() with lineParts=[`MyScope, 22]
scoW: at updateContent() with numeric data: [`MyScope,22](2)
scoW: isSpinNumber(22): isValid=(true)  -> (22)
scoW: isSpinNumber(22): isValid=(true)  -> (22)
scoW: * UPD-INFO channels=1, samples=1, samples=[22]
scoW: * UPD-INFO recorded sample 22 for channel 0, channelSamples[0].samples.length=23
scoW: at updateScopeChannelData(channel-0, w/#23) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(22) => (22->41) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(21) => (21->42) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #23 currSample=(22->41) @ rc=[52,44], prev=[53,42]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 22
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316155278µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $33 $0D $0A               `MyScope 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 23]: lineParts=[`MyScope | 23](2)
scoW: at updateContent() with lineParts=[`MyScope, 23]
scoW: at updateContent() with numeric data: [`MyScope,23](2)
scoW: isSpinNumber(23): isValid=(true)  -> (23)
scoW: isSpinNumber(23): isValid=(true)  -> (23)
scoW: * UPD-INFO channels=1, samples=1, samples=[23]
scoW: * UPD-INFO recorded sample 23 for channel 0, channelSamples[0].samples.length=24
scoW: at updateScopeChannelData(channel-0, w/#24) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(23) => (23->40) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(22) => (22->41) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #24 currSample=(23->40) @ rc=[51,46], prev=[52,44]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 23
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316219474µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $34 $0D $0A               `MyScope 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 24]: lineParts=[`MyScope | 24](2)
scoW: at updateContent() with lineParts=[`MyScope, 24]
scoW: at updateContent() with numeric data: [`MyScope,24](2)
scoW: isSpinNumber(24): isValid=(true)  -> (24)
scoW: isSpinNumber(24): isValid=(true)  -> (24)
scoW: * UPD-INFO channels=1, samples=1, samples=[24]
scoW: * UPD-INFO recorded sample 24 for channel 0, channelSamples[0].samples.length=25
scoW: at updateScopeChannelData(channel-0, w/#25) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(24) => (24->39) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(23) => (23->40) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #25 currSample=(24->39) @ rc=[50,48], prev=[51,46]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 24
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316267275µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $35 $0D $0A               `MyScope 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 25]: lineParts=[`MyScope | 25](2)
scoW: at updateContent() with lineParts=[`MyScope, 25]
scoW: at updateContent() with numeric data: [`MyScope,25](2)
scoW: isSpinNumber(25): isValid=(true)  -> (25)
scoW: isSpinNumber(25): isValid=(true)  -> (25)
scoW: * UPD-INFO channels=1, samples=1, samples=[25]
scoW: * UPD-INFO recorded sample 25 for channel 0, channelSamples[0].samples.length=26
scoW: at updateScopeChannelData(channel-0, w/#26) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(25) => (25->38) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(24) => (24->39) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #26 currSample=(25->38) @ rc=[49,50], prev=[50,48]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 25
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316315278µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $36 $0D $0A               `MyScope 26..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 26]: lineParts=[`MyScope | 26](2)
scoW: at updateContent() with lineParts=[`MyScope, 26]
scoW: at updateContent() with numeric data: [`MyScope,26](2)
scoW: isSpinNumber(26): isValid=(true)  -> (26)
scoW: isSpinNumber(26): isValid=(true)  -> (26)
scoW: * UPD-INFO channels=1, samples=1, samples=[26]
scoW: * UPD-INFO recorded sample 26 for channel 0, channelSamples[0].samples.length=27
scoW: at updateScopeChannelData(channel-0, w/#27) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(26) => (26->37) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(25) => (25->38) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #27 currSample=(26->37) @ rc=[48,52], prev=[49,50]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 26
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316363330µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $37 $0D $0A               `MyScope 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 27]: lineParts=[`MyScope | 27](2)
scoW: at updateContent() with lineParts=[`MyScope, 27]
scoW: at updateContent() with numeric data: [`MyScope,27](2)
scoW: isSpinNumber(27): isValid=(true)  -> (27)
scoW: isSpinNumber(27): isValid=(true)  -> (27)
scoW: * UPD-INFO channels=1, samples=1, samples=[27]
scoW: * UPD-INFO recorded sample 27 for channel 0, channelSamples[0].samples.length=28
scoW: at updateScopeChannelData(channel-0, w/#28) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(27) => (27->36) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(26) => (26->37) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #28 currSample=(27->36) @ rc=[47,54], prev=[48,52]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 27
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316411377µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $38 $0D $0A               `MyScope 28..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 28]: lineParts=[`MyScope | 28](2)
scoW: at updateContent() with lineParts=[`MyScope, 28]
scoW: at updateContent() with numeric data: [`MyScope,28](2)
scoW: isSpinNumber(28): isValid=(true)  -> (28)
scoW: isSpinNumber(28): isValid=(true)  -> (28)
scoW: * UPD-INFO channels=1, samples=1, samples=[28]
scoW: * UPD-INFO recorded sample 28 for channel 0, channelSamples[0].samples.length=29
scoW: at updateScopeChannelData(channel-0, w/#29) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(28) => (28->35) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(27) => (27->36) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #29 currSample=(28->35) @ rc=[46,56], prev=[47,54]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 28
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316459452µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $39 $0D $0A               `MyScope 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 29]: lineParts=[`MyScope | 29](2)
scoW: at updateContent() with lineParts=[`MyScope, 29]
scoW: at updateContent() with numeric data: [`MyScope,29](2)
scoW: isSpinNumber(29): isValid=(true)  -> (29)
scoW: isSpinNumber(29): isValid=(true)  -> (29)
scoW: * UPD-INFO channels=1, samples=1, samples=[29]
scoW: * UPD-INFO recorded sample 29 for channel 0, channelSamples[0].samples.length=30
scoW: at updateScopeChannelData(channel-0, w/#30) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(29) => (29->34) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(28) => (28->35) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #30 currSample=(29->34) @ rc=[45,58], prev=[46,56]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316507308µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $30 $0D $0A               `MyScope 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 30]: lineParts=[`MyScope | 30](2)
scoW: at updateContent() with lineParts=[`MyScope, 30]
scoW: at updateContent() with numeric data: [`MyScope,30](2)
scoW: isSpinNumber(30): isValid=(true)  -> (30)
scoW: isSpinNumber(30): isValid=(true)  -> (30)
scoW: * UPD-INFO channels=1, samples=1, samples=[30]
scoW: * UPD-INFO recorded sample 30 for channel 0, channelSamples[0].samples.length=31
scoW: at updateScopeChannelData(channel-0, w/#31) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(30) => (30->33) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(29) => (29->34) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #31 currSample=(30->33) @ rc=[44,60], prev=[45,58]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 30
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316571176µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $31 $0D $0A               `MyScope 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 31]: lineParts=[`MyScope | 31](2)
scoW: at updateContent() with lineParts=[`MyScope, 31]
scoW: at updateContent() with numeric data: [`MyScope,31](2)
scoW: isSpinNumber(31): isValid=(true)  -> (31)
scoW: isSpinNumber(31): isValid=(true)  -> (31)
scoW: * UPD-INFO channels=1, samples=1, samples=[31]
scoW: * UPD-INFO recorded sample 31 for channel 0, channelSamples[0].samples.length=32
scoW: at updateScopeChannelData(channel-0, w/#32) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(31) => (31->32) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(30) => (30->33) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #32 currSample=(31->32) @ rc=[43,62], prev=[44,60]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316619311µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $32 $0D $0A               `MyScope 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 32]: lineParts=[`MyScope | 32](2)
scoW: at updateContent() with lineParts=[`MyScope, 32]
scoW: at updateContent() with numeric data: [`MyScope,32](2)
scoW: isSpinNumber(32): isValid=(true)  -> (32)
scoW: isSpinNumber(32): isValid=(true)  -> (32)
scoW: * UPD-INFO channels=1, samples=1, samples=[32]
scoW: * UPD-INFO recorded sample 32 for channel 0, channelSamples[0].samples.length=33
scoW: at updateScopeChannelData(channel-0, w/#33) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(32) => (32->31) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(31) => (31->32) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #33 currSample=(32->31) @ rc=[42,64], prev=[43,62]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 32
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316667281µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $33 $0D $0A               `MyScope 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 33]: lineParts=[`MyScope | 33](2)
scoW: at updateContent() with lineParts=[`MyScope, 33]
scoW: at updateContent() with numeric data: [`MyScope,33](2)
scoW: isSpinNumber(33): isValid=(true)  -> (33)
scoW: isSpinNumber(33): isValid=(true)  -> (33)
scoW: * UPD-INFO channels=1, samples=1, samples=[33]
scoW: * UPD-INFO recorded sample 33 for channel 0, channelSamples[0].samples.length=34
scoW: at updateScopeChannelData(channel-0, w/#34) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(33) => (33->30) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(32) => (32->31) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #34 currSample=(33->30) @ rc=[41,66], prev=[42,64]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316715298µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $34 $0D $0A               `MyScope 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 34]: lineParts=[`MyScope | 34](2)
scoW: at updateContent() with lineParts=[`MyScope, 34]
scoW: at updateContent() with numeric data: [`MyScope,34](2)
scoW: isSpinNumber(34): isValid=(true)  -> (34)
scoW: isSpinNumber(34): isValid=(true)  -> (34)
scoW: * UPD-INFO channels=1, samples=1, samples=[34]
scoW: * UPD-INFO recorded sample 34 for channel 0, channelSamples[0].samples.length=35
scoW: at updateScopeChannelData(channel-0, w/#35) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(34) => (34->29) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(33) => (33->30) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #35 currSample=(34->29) @ rc=[40,68], prev=[41,66]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 34
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316763356µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $35 $0D $0A               `MyScope 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 35]: lineParts=[`MyScope | 35](2)
scoW: at updateContent() with lineParts=[`MyScope, 35]
scoW: at updateContent() with numeric data: [`MyScope,35](2)
scoW: isSpinNumber(35): isValid=(true)  -> (35)
scoW: isSpinNumber(35): isValid=(true)  -> (35)
scoW: * UPD-INFO channels=1, samples=1, samples=[35]
scoW: * UPD-INFO recorded sample 35 for channel 0, channelSamples[0].samples.length=36
scoW: at updateScopeChannelData(channel-0, w/#36) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(35) => (35->28) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(34) => (34->29) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #36 currSample=(35->28) @ rc=[39,70], prev=[40,68]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316811568µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $36 $0D $0A               `MyScope 36..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 36]: lineParts=[`MyScope | 36](2)
scoW: at updateContent() with lineParts=[`MyScope, 36]
scoW: at updateContent() with numeric data: [`MyScope,36](2)
scoW: isSpinNumber(36): isValid=(true)  -> (36)
scoW: isSpinNumber(36): isValid=(true)  -> (36)
scoW: * UPD-INFO channels=1, samples=1, samples=[36]
scoW: * UPD-INFO recorded sample 36 for channel 0, channelSamples[0].samples.length=37
scoW: at updateScopeChannelData(channel-0, w/#37) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(36) => (36->27) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(35) => (35->28) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #37 currSample=(36->27) @ rc=[38,72], prev=[39,70]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 36
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316859375µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $37 $0D $0A               `MyScope 37..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 37]: lineParts=[`MyScope | 37](2)
scoW: at updateContent() with lineParts=[`MyScope, 37]
scoW: at updateContent() with numeric data: [`MyScope,37](2)
scoW: isSpinNumber(37): isValid=(true)  -> (37)
scoW: isSpinNumber(37): isValid=(true)  -> (37)
scoW: * UPD-INFO channels=1, samples=1, samples=[37]
scoW: * UPD-INFO recorded sample 37 for channel 0, channelSamples[0].samples.length=38
scoW: at updateScopeChannelData(channel-0, w/#38) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(37) => (37->26) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(36) => (36->27) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #38 currSample=(37->26) @ rc=[37,74], prev=[38,72]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 37
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316907369µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $38 $0D $0A               `MyScope 38..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 38]: lineParts=[`MyScope | 38](2)
scoW: at updateContent() with lineParts=[`MyScope, 38]
scoW: at updateContent() with numeric data: [`MyScope,38](2)
scoW: isSpinNumber(38): isValid=(true)  -> (38)
scoW: isSpinNumber(38): isValid=(true)  -> (38)
scoW: * UPD-INFO channels=1, samples=1, samples=[38]
scoW: * UPD-INFO recorded sample 38 for channel 0, channelSamples[0].samples.length=39
scoW: at updateScopeChannelData(channel-0, w/#39) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(38) => (38->25) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(37) => (37->26) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #39 currSample=(38->25) @ rc=[36,76], prev=[37,74]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 38
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651316971241µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $39 $0D $0A               `MyScope 39..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 39]: lineParts=[`MyScope | 39](2)
scoW: at updateContent() with lineParts=[`MyScope, 39]
scoW: at updateContent() with numeric data: [`MyScope,39](2)
scoW: isSpinNumber(39): isValid=(true)  -> (39)
scoW: isSpinNumber(39): isValid=(true)  -> (39)
scoW: * UPD-INFO channels=1, samples=1, samples=[39]
scoW: * UPD-INFO recorded sample 39 for channel 0, channelSamples[0].samples.length=40
scoW: at updateScopeChannelData(channel-0, w/#40) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(39) => (39->24) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(38) => (38->25) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #40 currSample=(39->24) @ rc=[35,78], prev=[36,76]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 39
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317019262µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $30 $0D $0A               `MyScope 40..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 20 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 40]: lineParts=[`MyScope | 40](2)
scoW: at updateContent() with lineParts=[`MyScope, 40]
scoW: at updateContent() with numeric data: [`MyScope,40](2)
scoW: isSpinNumber(40): isValid=(true)  -> (40)
scoW: isSpinNumber(40): isValid=(true)  -> (40)
scoW: * UPD-INFO channels=1, samples=1, samples=[40]
scoW: * UPD-INFO recorded sample 40 for channel 0, channelSamples[0].samples.length=41
scoW: at updateScopeChannelData(channel-0, w/#41) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(40) => (40->23) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(39) => (39->24) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #41 currSample=(40->23) @ rc=[34,80], prev=[35,78]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 40
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317067389µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $31 $0D $0A               `MyScope 41..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 41]: lineParts=[`MyScope | 41](2)
scoW: at updateContent() with lineParts=[`MyScope, 41]
scoW: at updateContent() with numeric data: [`MyScope,41](2)
scoW: isSpinNumber(41): isValid=(true)  -> (41)
scoW: isSpinNumber(41): isValid=(true)  -> (41)
scoW: * UPD-INFO channels=1, samples=1, samples=[41]
scoW: * UPD-INFO recorded sample 41 for channel 0, channelSamples[0].samples.length=42
scoW: at updateScopeChannelData(channel-0, w/#42) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(41) => (41->22) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(40) => (40->23) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #42 currSample=(41->22) @ rc=[33,82], prev=[34,80]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 41
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317115252µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $32 $0D $0A               `MyScope 42..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 42]: lineParts=[`MyScope | 42](2)
scoW: at updateContent() with lineParts=[`MyScope, 42]
scoW: at updateContent() with numeric data: [`MyScope,42](2)
scoW: isSpinNumber(42): isValid=(true)  -> (42)
scoW: isSpinNumber(42): isValid=(true)  -> (42)
scoW: * UPD-INFO channels=1, samples=1, samples=[42]
scoW: * UPD-INFO recorded sample 42 for channel 0, channelSamples[0].samples.length=43
scoW: at updateScopeChannelData(channel-0, w/#43) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(42) => (42->21) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(41) => (41->22) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #43 currSample=(42->21) @ rc=[32,84], prev=[33,82]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 42
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317163202µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $33 $0D $0A               `MyScope 43..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 43]: lineParts=[`MyScope | 43](2)
scoW: at updateContent() with lineParts=[`MyScope, 43]
scoW: at updateContent() with numeric data: [`MyScope,43](2)
scoW: isSpinNumber(43): isValid=(true)  -> (43)
scoW: isSpinNumber(43): isValid=(true)  -> (43)
scoW: * UPD-INFO channels=1, samples=1, samples=[43]
scoW: * UPD-INFO recorded sample 43 for channel 0, channelSamples[0].samples.length=44
scoW: at updateScopeChannelData(channel-0, w/#44) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(43) => (43->20) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(42) => (42->21) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #44 currSample=(43->20) @ rc=[31,86], prev=[32,84]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 43
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317211387µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $34 $0D $0A               `MyScope 44..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 44]: lineParts=[`MyScope | 44](2)
scoW: at updateContent() with lineParts=[`MyScope, 44]
scoW: at updateContent() with numeric data: [`MyScope,44](2)
scoW: isSpinNumber(44): isValid=(true)  -> (44)
scoW: isSpinNumber(44): isValid=(true)  -> (44)
scoW: * UPD-INFO channels=1, samples=1, samples=[44]
scoW: * UPD-INFO recorded sample 44 for channel 0, channelSamples[0].samples.length=45
scoW: at updateScopeChannelData(channel-0, w/#45) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(44) => (44->19) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(43) => (43->20) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #45 currSample=(44->19) @ rc=[30,88], prev=[31,86]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 44
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317259304µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $35 $0D $0A               `MyScope 45..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 45]: lineParts=[`MyScope | 45](2)
scoW: at updateContent() with lineParts=[`MyScope, 45]
scoW: at updateContent() with numeric data: [`MyScope,45](2)
scoW: isSpinNumber(45): isValid=(true)  -> (45)
scoW: isSpinNumber(45): isValid=(true)  -> (45)
scoW: * UPD-INFO channels=1, samples=1, samples=[45]
scoW: * UPD-INFO recorded sample 45 for channel 0, channelSamples[0].samples.length=46
scoW: at updateScopeChannelData(channel-0, w/#46) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(45) => (45->18) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(44) => (44->19) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #46 currSample=(45->18) @ rc=[29,90], prev=[30,88]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 45
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317307312µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $36 $0D $0A               `MyScope 46..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 46]: lineParts=[`MyScope | 46](2)
scoW: at updateContent() with lineParts=[`MyScope, 46]
scoW: at updateContent() with numeric data: [`MyScope,46](2)
scoW: isSpinNumber(46): isValid=(true)  -> (46)
scoW: isSpinNumber(46): isValid=(true)  -> (46)
scoW: * UPD-INFO channels=1, samples=1, samples=[46]
scoW: * UPD-INFO recorded sample 46 for channel 0, channelSamples[0].samples.length=47
scoW: at updateScopeChannelData(channel-0, w/#47) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(46) => (46->17) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(45) => (45->18) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #47 currSample=(46->17) @ rc=[28,92], prev=[29,90]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 46
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317371260µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $37 $0D $0A               `MyScope 47..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 47]: lineParts=[`MyScope | 47](2)
scoW: at updateContent() with lineParts=[`MyScope, 47]
scoW: at updateContent() with numeric data: [`MyScope,47](2)
scoW: isSpinNumber(47): isValid=(true)  -> (47)
scoW: isSpinNumber(47): isValid=(true)  -> (47)
scoW: * UPD-INFO channels=1, samples=1, samples=[47]
scoW: * UPD-INFO recorded sample 47 for channel 0, channelSamples[0].samples.length=48
scoW: at updateScopeChannelData(channel-0, w/#48) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(47) => (47->16) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(46) => (46->17) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #48 currSample=(47->16) @ rc=[27,94], prev=[28,92]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 47
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317419288µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $38 $0D $0A               `MyScope 48..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 48]: lineParts=[`MyScope | 48](2)
scoW: at updateContent() with lineParts=[`MyScope, 48]
scoW: at updateContent() with numeric data: [`MyScope,48](2)
scoW: isSpinNumber(48): isValid=(true)  -> (48)
scoW: isSpinNumber(48): isValid=(true)  -> (48)
scoW: * UPD-INFO channels=1, samples=1, samples=[48]
scoW: * UPD-INFO recorded sample 48 for channel 0, channelSamples[0].samples.length=49
scoW: at updateScopeChannelData(channel-0, w/#49) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(48) => (48->15) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(47) => (47->16) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #49 currSample=(48->15) @ rc=[26,96], prev=[27,94]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 48
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317467392µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $39 $0D $0A               `MyScope 49..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 49]: lineParts=[`MyScope | 49](2)
scoW: at updateContent() with lineParts=[`MyScope, 49]
scoW: at updateContent() with numeric data: [`MyScope,49](2)
scoW: isSpinNumber(49): isValid=(true)  -> (49)
scoW: isSpinNumber(49): isValid=(true)  -> (49)
scoW: * UPD-INFO channels=1, samples=1, samples=[49]
scoW: * UPD-INFO recorded sample 49 for channel 0, channelSamples[0].samples.length=50
scoW: at updateScopeChannelData(channel-0, w/#50) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(49) => (49->14) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(48) => (48->15) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #50 currSample=(49->14) @ rc=[25,98], prev=[26,96]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 49
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317515255µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $30 $0D $0A               `MyScope 50..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 50]: lineParts=[`MyScope | 50](2)
scoW: at updateContent() with lineParts=[`MyScope, 50]
scoW: at updateContent() with numeric data: [`MyScope,50](2)
scoW: isSpinNumber(50): isValid=(true)  -> (50)
scoW: isSpinNumber(50): isValid=(true)  -> (50)
scoW: * UPD-INFO channels=1, samples=1, samples=[50]
scoW: * UPD-INFO recorded sample 50 for channel 0, channelSamples[0].samples.length=51
scoW: at updateScopeChannelData(channel-0, w/#51) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(50) => (50->13) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(49) => (49->14) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #51 currSample=(50->13) @ rc=[24,100], prev=[25,98]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 50
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317563341µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $31 $0D $0A               `MyScope 51..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 51]: lineParts=[`MyScope | 51](2)
scoW: at updateContent() with lineParts=[`MyScope, 51]
scoW: at updateContent() with numeric data: [`MyScope,51](2)
scoW: isSpinNumber(51): isValid=(true)  -> (51)
scoW: isSpinNumber(51): isValid=(true)  -> (51)
scoW: * UPD-INFO channels=1, samples=1, samples=[51]
scoW: * UPD-INFO recorded sample 51 for channel 0, channelSamples[0].samples.length=52
scoW: at updateScopeChannelData(channel-0, w/#52) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(51) => (51->12) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(50) => (50->13) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #52 currSample=(51->12) @ rc=[23,102], prev=[24,100]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 51
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317611333µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $32 $0D $0A               `MyScope 52..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 52]: lineParts=[`MyScope | 52](2)
scoW: at updateContent() with lineParts=[`MyScope, 52]
scoW: at updateContent() with numeric data: [`MyScope,52](2)
scoW: isSpinNumber(52): isValid=(true)  -> (52)
scoW: isSpinNumber(52): isValid=(true)  -> (52)
scoW: * UPD-INFO channels=1, samples=1, samples=[52]
scoW: * UPD-INFO recorded sample 52 for channel 0, channelSamples[0].samples.length=53
scoW: at updateScopeChannelData(channel-0, w/#53) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(52) => (52->11) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(51) => (51->12) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #53 currSample=(52->11) @ rc=[22,104], prev=[23,102]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 52
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317659351µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $33 $0D $0A               `MyScope 53..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 53]: lineParts=[`MyScope | 53](2)
scoW: at updateContent() with lineParts=[`MyScope, 53]
scoW: at updateContent() with numeric data: [`MyScope,53](2)
scoW: isSpinNumber(53): isValid=(true)  -> (53)
scoW: isSpinNumber(53): isValid=(true)  -> (53)
scoW: * UPD-INFO channels=1, samples=1, samples=[53]
scoW: * UPD-INFO recorded sample 53 for channel 0, channelSamples[0].samples.length=54
scoW: at updateScopeChannelData(channel-0, w/#54) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(53) => (53->10) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(52) => (52->11) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #54 currSample=(53->10) @ rc=[21,106], prev=[22,104]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 53
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317707369µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $34 $0D $0A               `MyScope 54..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 54]: lineParts=[`MyScope | 54](2)
scoW: at updateContent() with lineParts=[`MyScope, 54]
scoW: at updateContent() with numeric data: [`MyScope,54](2)
scoW: isSpinNumber(54): isValid=(true)  -> (54)
scoW: isSpinNumber(54): isValid=(true)  -> (54)
scoW: * UPD-INFO channels=1, samples=1, samples=[54]
scoW: * UPD-INFO recorded sample 54 for channel 0, channelSamples[0].samples.length=55
scoW: at updateScopeChannelData(channel-0, w/#55) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(54) => (54->9) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(53) => (53->10) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #55 currSample=(54->9) @ rc=[20,108], prev=[21,106]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 54
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317771431µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $35 $0D $0A               `MyScope 55..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 55]: lineParts=[`MyScope | 55](2)
scoW: at updateContent() with lineParts=[`MyScope, 55]
scoW: at updateContent() with numeric data: [`MyScope,55](2)
scoW: isSpinNumber(55): isValid=(true)  -> (55)
scoW: isSpinNumber(55): isValid=(true)  -> (55)
scoW: * UPD-INFO channels=1, samples=1, samples=[55]
scoW: * UPD-INFO recorded sample 55 for channel 0, channelSamples[0].samples.length=56
scoW: at updateScopeChannelData(channel-0, w/#56) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(55) => (55->8) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(54) => (54->9) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #56 currSample=(55->8) @ rc=[19,110], prev=[20,108]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 55
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317819273µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $36 $0D $0A               `MyScope 56..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 56]: lineParts=[`MyScope | 56](2)
scoW: at updateContent() with lineParts=[`MyScope, 56]
scoW: at updateContent() with numeric data: [`MyScope,56](2)
scoW: isSpinNumber(56): isValid=(true)  -> (56)
scoW: isSpinNumber(56): isValid=(true)  -> (56)
scoW: * UPD-INFO channels=1, samples=1, samples=[56]
scoW: * UPD-INFO recorded sample 56 for channel 0, channelSamples[0].samples.length=57
scoW: at updateScopeChannelData(channel-0, w/#57) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(56) => (56->7) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(55) => (55->8) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #57 currSample=(56->7) @ rc=[18,112], prev=[19,110]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 56
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317867435µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $37 $0D $0A               `MyScope 57..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 57]: lineParts=[`MyScope | 57](2)
scoW: at updateContent() with lineParts=[`MyScope, 57]
scoW: at updateContent() with numeric data: [`MyScope,57](2)
scoW: isSpinNumber(57): isValid=(true)  -> (57)
scoW: isSpinNumber(57): isValid=(true)  -> (57)
scoW: * UPD-INFO channels=1, samples=1, samples=[57]
scoW: * UPD-INFO recorded sample 57 for channel 0, channelSamples[0].samples.length=58
scoW: at updateScopeChannelData(channel-0, w/#58) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(57) => (57->6) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(56) => (56->7) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #58 currSample=(57->6) @ rc=[17,114], prev=[18,112]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 57
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317915181µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $38 $0D $0A               `MyScope 58..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 58]: lineParts=[`MyScope | 58](2)
scoW: at updateContent() with lineParts=[`MyScope, 58]
scoW: at updateContent() with numeric data: [`MyScope,58](2)
scoW: isSpinNumber(58): isValid=(true)  -> (58)
scoW: isSpinNumber(58): isValid=(true)  -> (58)
scoW: * UPD-INFO channels=1, samples=1, samples=[58]
scoW: * UPD-INFO recorded sample 58 for channel 0, channelSamples[0].samples.length=59
scoW: at updateScopeChannelData(channel-0, w/#59) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(58) => (58->5) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(57) => (57->6) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #59 currSample=(58->5) @ rc=[16,116], prev=[17,114]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 58
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651317963406µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $39 $0D $0A               `MyScope 59..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 59]: lineParts=[`MyScope | 59](2)
scoW: at updateContent() with lineParts=[`MyScope, 59]
scoW: at updateContent() with numeric data: [`MyScope,59](2)
scoW: isSpinNumber(59): isValid=(true)  -> (59)
scoW: isSpinNumber(59): isValid=(true)  -> (59)
scoW: * UPD-INFO channels=1, samples=1, samples=[59]
scoW: * UPD-INFO recorded sample 59 for channel 0, channelSamples[0].samples.length=60
scoW: at updateScopeChannelData(channel-0, w/#60) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(59) => (59->4) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(58) => (58->5) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #60 currSample=(59->4) @ rc=[15,118], prev=[16,116]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 59
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318011271µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $30 $0D $0A               `MyScope 60..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 60]: lineParts=[`MyScope | 60](2)
scoW: at updateContent() with lineParts=[`MyScope, 60]
scoW: at updateContent() with numeric data: [`MyScope,60](2)
scoW: isSpinNumber(60): isValid=(true)  -> (60)
scoW: isSpinNumber(60): isValid=(true)  -> (60)
scoW: * UPD-INFO channels=1, samples=1, samples=[60]
scoW: * UPD-INFO recorded sample 60 for channel 0, channelSamples[0].samples.length=61
scoW: at updateScopeChannelData(channel-0, w/#61) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(60) => (60->3) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(59) => (59->4) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #61 currSample=(60->3) @ rc=[14,120], prev=[15,118]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 60
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318059291µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $31 $0D $0A               `MyScope 61..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 5ms (velocity: 21 msg/s, processing: 1ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 61]: lineParts=[`MyScope | 61](2)
scoW: at updateContent() with lineParts=[`MyScope, 61]
scoW: at updateContent() with numeric data: [`MyScope,61](2)
scoW: isSpinNumber(61): isValid=(true)  -> (61)
scoW: isSpinNumber(61): isValid=(true)  -> (61)
scoW: * UPD-INFO channels=1, samples=1, samples=[61]
scoW: * UPD-INFO recorded sample 61 for channel 0, channelSamples[0].samples.length=62
scoW: at updateScopeChannelData(channel-0, w/#62) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(61) => (61->2) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(60) => (60->3) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #62 currSample=(61->2) @ rc=[13,122], prev=[14,120]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 61
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318123183µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $32 $0D $0A               `MyScope 62..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 62]: lineParts=[`MyScope | 62](2)
scoW: at updateContent() with lineParts=[`MyScope, 62]
scoW: at updateContent() with numeric data: [`MyScope,62](2)
scoW: isSpinNumber(62): isValid=(true)  -> (62)
scoW: isSpinNumber(62): isValid=(true)  -> (62)
scoW: * UPD-INFO channels=1, samples=1, samples=[62]
scoW: * UPD-INFO recorded sample 62 for channel 0, channelSamples[0].samples.length=63
scoW: at updateScopeChannelData(channel-0, w/#63) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(62) => (62->1) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(61) => (61->2) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #63 currSample=(62->1) @ rc=[12,124], prev=[13,122]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 62
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318171255µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $33 $0D $0A               `MyScope 63..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 63]: lineParts=[`MyScope | 63](2)
scoW: at updateContent() with lineParts=[`MyScope, 63]
scoW: at updateContent() with numeric data: [`MyScope,63](2)
scoW: isSpinNumber(63): isValid=(true)  -> (63)
scoW: isSpinNumber(63): isValid=(true)  -> (63)
scoW: * UPD-INFO channels=1, samples=1, samples=[63]
scoW: * UPD-INFO recorded sample 63 for channel 0, channelSamples[0].samples.length=64
scoW: at updateScopeChannelData(channel-0, w/#64) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(63) => (63->0) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(62) => (62->1) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #64 currSample=(63->0) @ rc=[11,126], prev=[12,124]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 63
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318219316µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $30 $0D $0A                   `MyScope 0..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 0]: lineParts=[`MyScope | 0](2)
scoW: at updateContent() with lineParts=[`MyScope, 0]
scoW: at updateContent() with numeric data: [`MyScope,0](2)
scoW: isSpinNumber(0): isValid=(true)  -> (0)
scoW: isSpinNumber(0): isValid=(true)  -> (0)
scoW: * UPD-INFO channels=1, samples=1, samples=[0]
scoW: * UPD-INFO recorded sample 0 for channel 0, channelSamples[0].samples.length=65
scoW: at updateScopeChannelData(channel-0, w/#65) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(0) => (0->63) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(63) => (63->0) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #65 currSample=(0->63) @ rc=[74,128], prev=[11,126]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 0
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318267297µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $0D $0A                   `MyScope 1..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 1]: lineParts=[`MyScope | 1](2)
scoW: at updateContent() with lineParts=[`MyScope, 1]
scoW: at updateContent() with numeric data: [`MyScope,1](2)
scoW: isSpinNumber(1): isValid=(true)  -> (1)
scoW: isSpinNumber(1): isValid=(true)  -> (1)
scoW: * UPD-INFO channels=1, samples=1, samples=[1]
scoW: * UPD-INFO recorded sample 1 for channel 0, channelSamples[0].samples.length=66
scoW: at updateScopeChannelData(channel-0, w/#66) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(1) => (1->62) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(0) => (0->63) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #66 currSample=(1->62) @ rc=[73,130], prev=[74,128]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 1
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318315351µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $0D $0A                   `MyScope 2..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 2]: lineParts=[`MyScope | 2](2)
scoW: at updateContent() with lineParts=[`MyScope, 2]
scoW: at updateContent() with numeric data: [`MyScope,2](2)
scoW: isSpinNumber(2): isValid=(true)  -> (2)
scoW: isSpinNumber(2): isValid=(true)  -> (2)
scoW: * UPD-INFO channels=1, samples=1, samples=[2]
scoW: * UPD-INFO recorded sample 2 for channel 0, channelSamples[0].samples.length=67
scoW: at updateScopeChannelData(channel-0, w/#67) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(2) => (2->61) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(1) => (1->62) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #67 currSample=(2->61) @ rc=[72,132], prev=[73,130]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 2
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318363263µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $0D $0A                   `MyScope 3..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 3]: lineParts=[`MyScope | 3](2)
scoW: at updateContent() with lineParts=[`MyScope, 3]
scoW: at updateContent() with numeric data: [`MyScope,3](2)
scoW: isSpinNumber(3): isValid=(true)  -> (3)
scoW: isSpinNumber(3): isValid=(true)  -> (3)
scoW: * UPD-INFO channels=1, samples=1, samples=[3]
scoW: * UPD-INFO recorded sample 3 for channel 0, channelSamples[0].samples.length=68
scoW: at updateScopeChannelData(channel-0, w/#68) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(3) => (3->60) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(2) => (2->61) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #68 currSample=(3->60) @ rc=[71,134], prev=[72,132]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 3
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318411328µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $34 $0D $0A                   `MyScope 4..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 4]: lineParts=[`MyScope | 4](2)
scoW: at updateContent() with lineParts=[`MyScope, 4]
scoW: at updateContent() with numeric data: [`MyScope,4](2)
scoW: isSpinNumber(4): isValid=(true)  -> (4)
scoW: isSpinNumber(4): isValid=(true)  -> (4)
scoW: * UPD-INFO channels=1, samples=1, samples=[4]
scoW: * UPD-INFO recorded sample 4 for channel 0, channelSamples[0].samples.length=69
scoW: at updateScopeChannelData(channel-0, w/#69) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(4) => (4->59) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(3) => (3->60) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #69 currSample=(4->59) @ rc=[70,136], prev=[71,134]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 4
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318459368µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $35 $0D $0A                   `MyScope 5..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 5]: lineParts=[`MyScope | 5](2)
scoW: at updateContent() with lineParts=[`MyScope, 5]
scoW: at updateContent() with numeric data: [`MyScope,5](2)
scoW: isSpinNumber(5): isValid=(true)  -> (5)
scoW: isSpinNumber(5): isValid=(true)  -> (5)
scoW: * UPD-INFO channels=1, samples=1, samples=[5]
scoW: * UPD-INFO recorded sample 5 for channel 0, channelSamples[0].samples.length=70
scoW: at updateScopeChannelData(channel-0, w/#70) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(5) => (5->58) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(4) => (4->59) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #70 currSample=(5->58) @ rc=[69,138], prev=[70,136]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 5
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318523236µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $36 $0D $0A                   `MyScope 6..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 6]: lineParts=[`MyScope | 6](2)
scoW: at updateContent() with lineParts=[`MyScope, 6]
scoW: at updateContent() with numeric data: [`MyScope,6](2)
scoW: isSpinNumber(6): isValid=(true)  -> (6)
scoW: isSpinNumber(6): isValid=(true)  -> (6)
scoW: * UPD-INFO channels=1, samples=1, samples=[6]
scoW: * UPD-INFO recorded sample 6 for channel 0, channelSamples[0].samples.length=71
scoW: at updateScopeChannelData(channel-0, w/#71) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(6) => (6->57) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(5) => (5->58) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #71 currSample=(6->57) @ rc=[68,140], prev=[69,138]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 6
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318571264µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $37 $0D $0A                   `MyScope 7..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 7]: lineParts=[`MyScope | 7](2)
scoW: at updateContent() with lineParts=[`MyScope, 7]
scoW: at updateContent() with numeric data: [`MyScope,7](2)
scoW: isSpinNumber(7): isValid=(true)  -> (7)
scoW: isSpinNumber(7): isValid=(true)  -> (7)
scoW: * UPD-INFO channels=1, samples=1, samples=[7]
scoW: * UPD-INFO recorded sample 7 for channel 0, channelSamples[0].samples.length=72
scoW: at updateScopeChannelData(channel-0, w/#72) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(7) => (7->56) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(6) => (6->57) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #72 currSample=(7->56) @ rc=[67,142], prev=[68,140]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 7
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318619331µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $38 $0D $0A                   `MyScope 8..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 8]: lineParts=[`MyScope | 8](2)
scoW: at updateContent() with lineParts=[`MyScope, 8]
scoW: at updateContent() with numeric data: [`MyScope,8](2)
scoW: isSpinNumber(8): isValid=(true)  -> (8)
scoW: isSpinNumber(8): isValid=(true)  -> (8)
scoW: * UPD-INFO channels=1, samples=1, samples=[8]
scoW: * UPD-INFO recorded sample 8 for channel 0, channelSamples[0].samples.length=73
scoW: at updateScopeChannelData(channel-0, w/#73) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(8) => (8->55) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(7) => (7->56) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #73 currSample=(8->55) @ rc=[66,144], prev=[67,142]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 8
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318667501µs] Received 12 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $39 $0D $0A                   `MyScope 9..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 12 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 9]: lineParts=[`MyScope | 9](2)
scoW: at updateContent() with lineParts=[`MyScope, 9]
scoW: at updateContent() with numeric data: [`MyScope,9](2)
scoW: isSpinNumber(9): isValid=(true)  -> (9)
scoW: isSpinNumber(9): isValid=(true)  -> (9)
scoW: * UPD-INFO channels=1, samples=1, samples=[9]
scoW: * UPD-INFO recorded sample 9 for channel 0, channelSamples[0].samples.length=74
scoW: at updateScopeChannelData(channel-0, w/#74) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(9) => (9->54) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(8) => (8->55) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #74 currSample=(9->54) @ rc=[65,146], prev=[66,144]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 10 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 9
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318715330µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $30 $0D $0A               `MyScope 10..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 10]: lineParts=[`MyScope | 10](2)
scoW: at updateContent() with lineParts=[`MyScope, 10]
scoW: at updateContent() with numeric data: [`MyScope,10](2)
scoW: isSpinNumber(10): isValid=(true)  -> (10)
scoW: isSpinNumber(10): isValid=(true)  -> (10)
scoW: * UPD-INFO channels=1, samples=1, samples=[10]
scoW: * UPD-INFO recorded sample 10 for channel 0, channelSamples[0].samples.length=75
scoW: at updateScopeChannelData(channel-0, w/#75) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(10) => (10->53) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(9) => (9->54) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #75 currSample=(10->53) @ rc=[64,148], prev=[65,146]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 10
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318763206µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $31 $0D $0A               `MyScope 11..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 11]: lineParts=[`MyScope | 11](2)
scoW: at updateContent() with lineParts=[`MyScope, 11]
scoW: at updateContent() with numeric data: [`MyScope,11](2)
scoW: isSpinNumber(11): isValid=(true)  -> (11)
scoW: isSpinNumber(11): isValid=(true)  -> (11)
scoW: * UPD-INFO channels=1, samples=1, samples=[11]
scoW: * UPD-INFO recorded sample 11 for channel 0, channelSamples[0].samples.length=76
scoW: at updateScopeChannelData(channel-0, w/#76) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(11) => (11->52) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(10) => (10->53) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #76 currSample=(11->52) @ rc=[63,150], prev=[64,148]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 11
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318811320µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $32 $0D $0A               `MyScope 12..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 12]: lineParts=[`MyScope | 12](2)
scoW: at updateContent() with lineParts=[`MyScope, 12]
scoW: at updateContent() with numeric data: [`MyScope,12](2)
scoW: isSpinNumber(12): isValid=(true)  -> (12)
scoW: isSpinNumber(12): isValid=(true)  -> (12)
scoW: * UPD-INFO channels=1, samples=1, samples=[12]
scoW: * UPD-INFO recorded sample 12 for channel 0, channelSamples[0].samples.length=77
scoW: at updateScopeChannelData(channel-0, w/#77) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(12) => (12->51) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(11) => (11->52) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #77 currSample=(12->51) @ rc=[62,152], prev=[63,150]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 12
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318859329µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $33 $0D $0A               `MyScope 13..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 13]: lineParts=[`MyScope | 13](2)
scoW: at updateContent() with lineParts=[`MyScope, 13]
scoW: at updateContent() with numeric data: [`MyScope,13](2)
scoW: isSpinNumber(13): isValid=(true)  -> (13)
scoW: isSpinNumber(13): isValid=(true)  -> (13)
scoW: * UPD-INFO channels=1, samples=1, samples=[13]
scoW: * UPD-INFO recorded sample 13 for channel 0, channelSamples[0].samples.length=78
scoW: at updateScopeChannelData(channel-0, w/#78) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(13) => (13->50) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(12) => (12->51) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #78 currSample=(13->50) @ rc=[61,154], prev=[62,152]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 13
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318923294µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $34 $0D $0A               `MyScope 14..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 14]: lineParts=[`MyScope | 14](2)
scoW: at updateContent() with lineParts=[`MyScope, 14]
scoW: at updateContent() with numeric data: [`MyScope,14](2)
scoW: isSpinNumber(14): isValid=(true)  -> (14)
scoW: isSpinNumber(14): isValid=(true)  -> (14)
scoW: * UPD-INFO channels=1, samples=1, samples=[14]
scoW: * UPD-INFO recorded sample 14 for channel 0, channelSamples[0].samples.length=79
scoW: at updateScopeChannelData(channel-0, w/#79) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(14) => (14->49) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(13) => (13->50) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #79 currSample=(14->49) @ rc=[60,156], prev=[61,154]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 14
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651318971161µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $35 $0D $0A               `MyScope 15..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 15]: lineParts=[`MyScope | 15](2)
scoW: at updateContent() with lineParts=[`MyScope, 15]
scoW: at updateContent() with numeric data: [`MyScope,15](2)
scoW: isSpinNumber(15): isValid=(true)  -> (15)
scoW: isSpinNumber(15): isValid=(true)  -> (15)
scoW: * UPD-INFO channels=1, samples=1, samples=[15]
scoW: * UPD-INFO recorded sample 15 for channel 0, channelSamples[0].samples.length=80
scoW: at updateScopeChannelData(channel-0, w/#80) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(15) => (15->48) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(14) => (14->49) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #80 currSample=(15->48) @ rc=[59,158], prev=[60,156]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 15
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319019368µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $36 $0D $0A               `MyScope 16..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 16]: lineParts=[`MyScope | 16](2)
scoW: at updateContent() with lineParts=[`MyScope, 16]
scoW: at updateContent() with numeric data: [`MyScope,16](2)
scoW: isSpinNumber(16): isValid=(true)  -> (16)
scoW: isSpinNumber(16): isValid=(true)  -> (16)
scoW: * UPD-INFO channels=1, samples=1, samples=[16]
scoW: * UPD-INFO recorded sample 16 for channel 0, channelSamples[0].samples.length=81
scoW: at updateScopeChannelData(channel-0, w/#81) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(16) => (16->47) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(15) => (15->48) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #81 currSample=(16->47) @ rc=[58,160], prev=[59,158]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 16
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319067451µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $37 $0D $0A               `MyScope 17..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 20 msg/s, processing: 0ms)
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 17]: lineParts=[`MyScope | 17](2)
scoW: at updateContent() with lineParts=[`MyScope, 17]
scoW: at updateContent() with numeric data: [`MyScope,17](2)
scoW: isSpinNumber(17): isValid=(true)  -> (17)
scoW: isSpinNumber(17): isValid=(true)  -> (17)
scoW: * UPD-INFO channels=1, samples=1, samples=[17]
scoW: * UPD-INFO recorded sample 17 for channel 0, channelSamples[0].samples.length=82
scoW: at updateScopeChannelData(channel-0, w/#82) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(17) => (17->46) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(16) => (16->47) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #82 currSample=(17->46) @ rc=[57,162], prev=[58,160]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 17
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319115305µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $38 $0D $0A               `MyScope 18..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 18]: lineParts=[`MyScope | 18](2)
scoW: at updateContent() with lineParts=[`MyScope, 18]
scoW: at updateContent() with numeric data: [`MyScope,18](2)
scoW: isSpinNumber(18): isValid=(true)  -> (18)
scoW: isSpinNumber(18): isValid=(true)  -> (18)
scoW: * UPD-INFO channels=1, samples=1, samples=[18]
scoW: * UPD-INFO recorded sample 18 for channel 0, channelSamples[0].samples.length=83
scoW: at updateScopeChannelData(channel-0, w/#83) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(18) => (18->45) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(17) => (17->46) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #83 currSample=(18->45) @ rc=[56,164], prev=[57,162]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 18
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319163267µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $31 $39 $0D $0A               `MyScope 19..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 19]: lineParts=[`MyScope | 19](2)
scoW: at updateContent() with lineParts=[`MyScope, 19]
scoW: at updateContent() with numeric data: [`MyScope,19](2)
scoW: isSpinNumber(19): isValid=(true)  -> (19)
scoW: isSpinNumber(19): isValid=(true)  -> (19)
scoW: * UPD-INFO channels=1, samples=1, samples=[19]
scoW: * UPD-INFO recorded sample 19 for channel 0, channelSamples[0].samples.length=84
scoW: at updateScopeChannelData(channel-0, w/#84) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(19) => (19->44) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(18) => (18->45) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #84 currSample=(19->44) @ rc=[55,166], prev=[56,164]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 19
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319211337µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $30 $0D $0A               `MyScope 20..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 20]: lineParts=[`MyScope | 20](2)
scoW: at updateContent() with lineParts=[`MyScope, 20]
scoW: at updateContent() with numeric data: [`MyScope,20](2)
scoW: isSpinNumber(20): isValid=(true)  -> (20)
scoW: isSpinNumber(20): isValid=(true)  -> (20)
scoW: * UPD-INFO channels=1, samples=1, samples=[20]
scoW: * UPD-INFO recorded sample 20 for channel 0, channelSamples[0].samples.length=85
scoW: at updateScopeChannelData(channel-0, w/#85) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(20) => (20->43) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(19) => (19->44) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #85 currSample=(20->43) @ rc=[54,168], prev=[55,166]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 20
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319275345µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $31 $0D $0A               `MyScope 21..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 21]: lineParts=[`MyScope | 21](2)
scoW: at updateContent() with lineParts=[`MyScope, 21]
scoW: at updateContent() with numeric data: [`MyScope,21](2)
scoW: isSpinNumber(21): isValid=(true)  -> (21)
scoW: isSpinNumber(21): isValid=(true)  -> (21)
scoW: * UPD-INFO channels=1, samples=1, samples=[21]
scoW: * UPD-INFO recorded sample 21 for channel 0, channelSamples[0].samples.length=86
scoW: at updateScopeChannelData(channel-0, w/#86) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(21) => (21->42) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(20) => (20->43) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #86 currSample=(21->42) @ rc=[53,170], prev=[54,168]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 21
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319323269µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $32 $0D $0A               `MyScope 22..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 22]: lineParts=[`MyScope | 22](2)
scoW: at updateContent() with lineParts=[`MyScope, 22]
scoW: at updateContent() with numeric data: [`MyScope,22](2)
scoW: isSpinNumber(22): isValid=(true)  -> (22)
scoW: isSpinNumber(22): isValid=(true)  -> (22)
scoW: * UPD-INFO channels=1, samples=1, samples=[22]
scoW: * UPD-INFO recorded sample 22 for channel 0, channelSamples[0].samples.length=87
scoW: at updateScopeChannelData(channel-0, w/#87) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(22) => (22->41) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(21) => (21->42) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #87 currSample=(22->41) @ rc=[52,172], prev=[53,170]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 22
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319371268µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $33 $0D $0A               `MyScope 23..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 23]: lineParts=[`MyScope | 23](2)
scoW: at updateContent() with lineParts=[`MyScope, 23]
scoW: at updateContent() with numeric data: [`MyScope,23](2)
scoW: isSpinNumber(23): isValid=(true)  -> (23)
scoW: isSpinNumber(23): isValid=(true)  -> (23)
scoW: * UPD-INFO channels=1, samples=1, samples=[23]
scoW: * UPD-INFO recorded sample 23 for channel 0, channelSamples[0].samples.length=88
scoW: at updateScopeChannelData(channel-0, w/#88) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(23) => (23->40) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(22) => (22->41) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #88 currSample=(23->40) @ rc=[51,174], prev=[52,172]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 23
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319419324µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $34 $0D $0A               `MyScope 24..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 24]: lineParts=[`MyScope | 24](2)
scoW: at updateContent() with lineParts=[`MyScope, 24]
scoW: at updateContent() with numeric data: [`MyScope,24](2)
scoW: isSpinNumber(24): isValid=(true)  -> (24)
scoW: isSpinNumber(24): isValid=(true)  -> (24)
scoW: * UPD-INFO channels=1, samples=1, samples=[24]
scoW: * UPD-INFO recorded sample 24 for channel 0, channelSamples[0].samples.length=89
scoW: at updateScopeChannelData(channel-0, w/#89) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(24) => (24->39) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(23) => (23->40) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #89 currSample=(24->39) @ rc=[50,176], prev=[51,174]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 24
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319467381µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $35 $0D $0A               `MyScope 25..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 25]: lineParts=[`MyScope | 25](2)
scoW: at updateContent() with lineParts=[`MyScope, 25]
scoW: at updateContent() with numeric data: [`MyScope,25](2)
scoW: isSpinNumber(25): isValid=(true)  -> (25)
scoW: isSpinNumber(25): isValid=(true)  -> (25)
scoW: * UPD-INFO channels=1, samples=1, samples=[25]
scoW: * UPD-INFO recorded sample 25 for channel 0, channelSamples[0].samples.length=90
scoW: at updateScopeChannelData(channel-0, w/#90) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(25) => (25->38) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(24) => (24->39) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #90 currSample=(25->38) @ rc=[49,178], prev=[50,176]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 25
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319515339µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $36 $0D $0A               `MyScope 26..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 26]: lineParts=[`MyScope | 26](2)
scoW: at updateContent() with lineParts=[`MyScope, 26]
scoW: at updateContent() with numeric data: [`MyScope,26](2)
scoW: isSpinNumber(26): isValid=(true)  -> (26)
scoW: isSpinNumber(26): isValid=(true)  -> (26)
scoW: * UPD-INFO channels=1, samples=1, samples=[26]
scoW: * UPD-INFO recorded sample 26 for channel 0, channelSamples[0].samples.length=91
scoW: at updateScopeChannelData(channel-0, w/#91) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(26) => (26->37) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(25) => (25->38) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #91 currSample=(26->37) @ rc=[48,180], prev=[49,178]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 26
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319563266µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $37 $0D $0A               `MyScope 27..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 27]: lineParts=[`MyScope | 27](2)
scoW: at updateContent() with lineParts=[`MyScope, 27]
scoW: at updateContent() with numeric data: [`MyScope,27](2)
scoW: isSpinNumber(27): isValid=(true)  -> (27)
scoW: isSpinNumber(27): isValid=(true)  -> (27)
scoW: * UPD-INFO channels=1, samples=1, samples=[27]
scoW: * UPD-INFO recorded sample 27 for channel 0, channelSamples[0].samples.length=92
scoW: at updateScopeChannelData(channel-0, w/#92) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(27) => (27->36) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(26) => (26->37) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #92 currSample=(27->36) @ rc=[47,182], prev=[48,180]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 27
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319611281µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $38 $0D $0A               `MyScope 28..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 28]: lineParts=[`MyScope | 28](2)
scoW: at updateContent() with lineParts=[`MyScope, 28]
scoW: at updateContent() with numeric data: [`MyScope,28](2)
scoW: isSpinNumber(28): isValid=(true)  -> (28)
scoW: isSpinNumber(28): isValid=(true)  -> (28)
scoW: * UPD-INFO channels=1, samples=1, samples=[28]
scoW: * UPD-INFO recorded sample 28 for channel 0, channelSamples[0].samples.length=93
scoW: at updateScopeChannelData(channel-0, w/#93) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(28) => (28->35) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(27) => (27->36) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #93 currSample=(28->35) @ rc=[46,184], prev=[47,182]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 28
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319675381µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $32 $39 $0D $0A               `MyScope 29..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 29]: lineParts=[`MyScope | 29](2)
scoW: at updateContent() with lineParts=[`MyScope, 29]
scoW: at updateContent() with numeric data: [`MyScope,29](2)
scoW: isSpinNumber(29): isValid=(true)  -> (29)
scoW: isSpinNumber(29): isValid=(true)  -> (29)
scoW: * UPD-INFO channels=1, samples=1, samples=[29]
scoW: * UPD-INFO recorded sample 29 for channel 0, channelSamples[0].samples.length=94
scoW: at updateScopeChannelData(channel-0, w/#94) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(29) => (29->34) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(28) => (28->35) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #94 currSample=(29->34) @ rc=[45,186], prev=[46,184]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 29
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319723061µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $30 $0D $0A               `MyScope 30..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 30]: lineParts=[`MyScope | 30](2)
scoW: at updateContent() with lineParts=[`MyScope, 30]
scoW: at updateContent() with numeric data: [`MyScope,30](2)
scoW: isSpinNumber(30): isValid=(true)  -> (30)
scoW: isSpinNumber(30): isValid=(true)  -> (30)
scoW: * UPD-INFO channels=1, samples=1, samples=[30]
scoW: * UPD-INFO recorded sample 30 for channel 0, channelSamples[0].samples.length=95
scoW: at updateScopeChannelData(channel-0, w/#95) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(30) => (30->33) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(29) => (29->34) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #95 currSample=(30->33) @ rc=[44,188], prev=[45,186]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 30
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319771104µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $31 $0D $0A               `MyScope 31..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 31]: lineParts=[`MyScope | 31](2)
scoW: at updateContent() with lineParts=[`MyScope, 31]
scoW: at updateContent() with numeric data: [`MyScope,31](2)
scoW: isSpinNumber(31): isValid=(true)  -> (31)
scoW: isSpinNumber(31): isValid=(true)  -> (31)
scoW: * UPD-INFO channels=1, samples=1, samples=[31]
scoW: * UPD-INFO recorded sample 31 for channel 0, channelSamples[0].samples.length=96
scoW: at updateScopeChannelData(channel-0, w/#96) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(31) => (31->32) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(30) => (30->33) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #96 currSample=(31->32) @ rc=[43,190], prev=[44,188]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 31
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319819250µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $32 $0D $0A               `MyScope 32..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 32]: lineParts=[`MyScope | 32](2)
scoW: at updateContent() with lineParts=[`MyScope, 32]
scoW: at updateContent() with numeric data: [`MyScope,32](2)
scoW: isSpinNumber(32): isValid=(true)  -> (32)
scoW: isSpinNumber(32): isValid=(true)  -> (32)
scoW: * UPD-INFO channels=1, samples=1, samples=[32]
scoW: * UPD-INFO recorded sample 32 for channel 0, channelSamples[0].samples.length=97
scoW: at updateScopeChannelData(channel-0, w/#97) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(32) => (32->31) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(31) => (31->32) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #97 currSample=(32->31) @ rc=[42,192], prev=[43,190]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 32
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319867106µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $33 $0D $0A               `MyScope 33..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 33]: lineParts=[`MyScope | 33](2)
scoW: at updateContent() with lineParts=[`MyScope, 33]
scoW: at updateContent() with numeric data: [`MyScope,33](2)
scoW: isSpinNumber(33): isValid=(true)  -> (33)
scoW: isSpinNumber(33): isValid=(true)  -> (33)
scoW: * UPD-INFO channels=1, samples=1, samples=[33]
scoW: * UPD-INFO recorded sample 33 for channel 0, channelSamples[0].samples.length=98
scoW: at updateScopeChannelData(channel-0, w/#98) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(33) => (33->30) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(32) => (32->31) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #98 currSample=(33->30) @ rc=[41,194], prev=[42,192]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 33
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319915294µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $34 $0D $0A               `MyScope 34..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 34]: lineParts=[`MyScope | 34](2)
scoW: at updateContent() with lineParts=[`MyScope, 34]
scoW: at updateContent() with numeric data: [`MyScope,34](2)
scoW: isSpinNumber(34): isValid=(true)  -> (34)
scoW: isSpinNumber(34): isValid=(true)  -> (34)
scoW: * UPD-INFO channels=1, samples=1, samples=[34]
scoW: * UPD-INFO recorded sample 34 for channel 0, channelSamples[0].samples.length=99
scoW: at updateScopeChannelData(channel-0, w/#99) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(34) => (34->29) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(33) => (33->30) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #99 currSample=(34->29) @ rc=[40,196], prev=[41,194]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 34
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651319963321µs] Received 13 bytes
[SERIAL RX HEX/ASCII]:
  0000: $60 $4D $79 $53 $63 $6F $70 $65  $20 $33 $35 $0D $0A               `MyScope 35..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 13 bytes, running: true
[TWO-TIER] 🎯 Routing message: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] 🎯 Found 2 destinations for BACKTICK_WINDOW
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #99 created with 2 consumers
[TWO-TIER] handleWindowCommand() - [`MyScope 35]: lineParts=[`MyScope | 35](2)
scoW: at updateContent() with lineParts=[`MyScope, 35]
scoW: at updateContent() with numeric data: [`MyScope,35](2)
scoW: isSpinNumber(35): isValid=(true)  -> (35)
scoW: isSpinNumber(35): isValid=(true)  -> (35)
scoW: * UPD-INFO channels=1, samples=1, samples=[35]
scoW: * UPD-INFO recorded sample 35 for channel 0, channelSamples[0].samples.length=100
scoW: at updateScopeChannelData(channel-0, w/#100) sample(s), didScroll=(false)
scoW:   -- scaleAndInvertValue(35) => (35->28) range=[0:63] ySize=(64)
scoW:   -- scaleAndInvertValue(34) => (34->29) range=[0:63] ySize=(64)
scoW:   -- DRAW size=(256,65), offset=(10,0)
scoW:   -- #100 currSample=(35->28) @ rc=[39,198], prev=[40,196]
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 11 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope 35
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
[DEBUG LOGGER] Flushed 57 bytes to log file
[DEBUG LOGGER] Sending batch of 1 messages to window
[SERIAL RX 651323019492µs] Received 47 bytes
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
scoW: at updateContent() with lineParts=[`MyScope, close]
scoW: at closeDebugWindow() SCOPE
scoW: - Closing DebugScopeWindow window
scoW: - Unregistered from WindowRouter: scope-1757396570437
scoW: - DebugScopeWindow window closing...
scoW: - DebugScopeWindow window closed
[TWO-TIER] Routed to existing window: MyScope
[MESSAGE-POOL] Released pooled message #99 from WindowCreator handler
[TWO-TIER] 📨 Routing message to Debug Logger: BACKTICK_WINDOW, 14 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: BACKTICK_WINDOW
[DEBUG LOGGER] Added to write buffer: [BACKTICK_WINDOW] `MyScope close
[MessagePool] Slow message release detected: Message #99 held for 103.3ms (threshold: 100ms)
[MESSAGE-POOL] Released pooled message #99 from DebugLogger handler
2025-09-09T05:42:58.457Z [INFO ] UNREGISTER: Window unregistered: scope-1757396570437. Active windows: 1
[DEBUG LOGGER] Flushed 60 bytes to log file
[DEBUG LOGGER] Sending batch of 3 messages to window
[DEBUG LOGGER] Flushed 59 bytes to log file
[DEBUG LOGGER] Flushed 60 bytes to log file
