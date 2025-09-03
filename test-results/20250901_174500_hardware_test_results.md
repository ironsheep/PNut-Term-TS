# Hardware Test Results - September 1, 2025, 5:45 PM

## Test Environment
- **Date/Time**: September 1, 2025, 5:45 PM
- **Test Package**: Latest build with debug window standardization
- **Hardware**: Parallax Propeller 2 (P2) device
- **Tester**: User hardware validation

## Raw Test Results

### Part 1: Console Log (Application Startup)
```
/Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/TEST.command ; exit;
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
* Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC., Parallax Inc.
* Version 0.1.0, Build date: 9/1/2025

* pnut-term-ts /Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/Resources/app -p P9cektn7 --verbose
** process.argv=[...], this.argsArray=[[]] inContainer=[false]
- -------------------------------- -
arguments: [ [length]: 0 ]
combArguments: ['/Users/stephen/Projects/.../Electron', '/Users/stephen/Projects/.../app', '-p', 'P9cektn7', '--verbose', [length]: 5]
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
[STARTUP] createAppWindow() called
* create App Window()
work area size: 2560 x 1415
     char size (default): 12 x 18
window geom: 960x450 @800,915
[MENU SETUP] IDE Mode: false, Setting up menu: true
[MENU SETUP] Starting createApplicationMenu()
[MENU SETUP] ✅ macOS system menu set
[MENU SETUP] Standalone Mode - HTML menu bar will be used
[IPC] DTR/RTS handlers registered
2025-09-01T17:43:51.081Z [INFO ] STARTUP: WindowRouter initialized 
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
* getFontMetrics() -> (13.328125x11.4765625)
[FONT METRICS] Measured after window ready: 13.328125 x 11.4765625
[PERF DISPLAY] Performance monitoring timer started
2025-09-01T17:43:51.281Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger). Can receive messages to queue. 
2025-09-01T17:43:51.290Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1 
[DEBUG LOGGER] Window did-finish-load event fired!
[DEBUG LOGGER] Window shown and focused
?Base?: Debug Logger window ready
[DEBUG LOGGER] Verified still registered: DebugLogger
[DEBUG LOGGER] Creating logs directory at: /Users/stephen/logs
[UTIL] Log folder already exists at: /Users/stephen/logs
[DEBUG LOGGER] Log file path: /Users/stephen/logs/debug_250901-1143.log
[DEBUG LOGGER] Write stream created successfully
[DEBUG LOGGER] Log file initialized successfully at: /Users/stephen/logs/debug_250901-1143.log
[DEBUG LOGGER] Write stream opened with fd: 59
[DEBUG LOGGER] Log file header written and flushed
[DEBUG LOGGER] Log file synced to disk
[SERIAL RX 3386114455µs] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 0ms)
[SERIAL RX 3386117354µs] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $46 $35 $43 $20 $24 $30  $30 $30 $30 $5F $31 $43 $37 $34   _0F5C $0000_1C74
  0020: $20 $6A $75 $6D $70 $0D $0A $43  $6F $67 $30 $20 $20 $68 $69 $20    jump..Cog0  hi 
  0030: $66 $72 $6F $6D $20 $64 $65 $62  $75 $67 $20 $64 $65 $6D $6F $0D   from debug demo.
  0040: $0A $43 $6F $67 $30 $20 $20 $53  $74 $61 $72 $74 $20 $31 $73 $74   .Cog0  Start 1st
  0050: $20 $43 $6F $67 $0D $0A $43 $6F  $67 $31 $20 $20 $49 $4E $49 $54    Cog..Cog1  INIT
  0060: $20 $24 $30 $30 $30 $30 $5F $30  $46 $35 $43 $20 $24 $30 $30 $30    $0000_0F5C $000
  0070: $30 $5F $31 $38 $33 $34 $20 $6A  $75 $6D $70 $0D                   0_1834 jump.
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX 3386118403µs] Received 310 bytes
[SERIAL RX HEX/ASCII]:
  0000: $0A $43 $6F $67 $31 $20 $20 $54  $61 $73 $6B $20 $69 $6E $20 $6E   .Cog1  Task in n
  0010: $65 $77 $20 $43 $4F $47 $20 $73  $74 $61 $72 $74 $65 $64 $0D $0A   ew COG started..
  0020: $01 $00 $00 $00 $01 $00 $00 $00  $0E $00 $A1 $03 $F8 $01 $00 $00   ..........!.x...
  0030: $00 $00 $00 $00 $75 $7A $3E $00  $FF $01 $00 $00 $00 $00 $00 $00   ....uz>.........
  0040: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0050: $00 $00 $00 $00 $00 $00 $00 $00  $5F $02 $00 $40 $69 $1C $00 $00   ........_..@i...
  0060: $4C $18 $00 $00 $00 $00 $08 $00  $80 $B2 $E6 $0E $10 $00 $00 $00   L........2f.....
  0070: $40 $2F $40 $2F $40 $2F $40 $2F  $40 $2F $40 $2F $40 $2F $40 $2F   @/@/@/@/@/@/@/@/
  0080: $40 $2F $40 $2F $40 $2F $40 $2F  $40 $2F $40 $2F $40 $2F $40 $2F   @/@/@/@/@/@/@/@/
  0090: $40 $2F $40 $2F $A4 $B4 $5E $8C  $47 $39 $C0 $E8 $09 $EB $89 $ED   @/@/$4^.G9@h.k.m
  00a0: $A7 $CD $83 $6A $AC $63 $4D $77  $F3 $F9 $FE $2F $40 $2F $16 $5B   'M.j,cMwsy~/@/.[
  00b0: $40 $2F $E2 $54 $47 $BA $60 $B1  $4B $F5 $F7 $F9 $BD $CB $2F $74   @/bTG:`1Kuwy=K/t
  00c0: $9F $2F $31 $18 $A4 $62 $95 $D7  $44 $B5 $06 $6E $4F $D1 $E6 $51   ./1.$b.WD5.nOQfQ
  00d0: $1D $4B $28 $50 $CE $20 $46 $94  $A3 $D1 $50 $E3 $49 $A2 $7D $B1   .K(PN F.#QPcI"}1
  00e0: $CE $48 $BD $F1 $8A $EF $CE $D7  $01 $BC $B6 $78 $E3 $A5 $E6 $74   NH=q.oNW.<6xc%ft
  00f0: $E9 $60 $34 $38 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   i`48............
  0100: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0110: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0120: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0130: $00 $00 $00 $00 $00 $00                                            ......
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 310 bytes, running: true
[SERIAL RX 3386120338µs] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0040: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0050: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0060: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0070: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00                   ............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX 3386134865µs] Received 54 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00                                            ......
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 54 bytes, running: true
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #99 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 INIT $0000_0000 $0000_0000 load
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #98 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 INIT $0000_0F5C $0000_1C74 jump
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 26 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #97 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 26 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 hi from debug demo
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 21 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #96 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog0 Start 1st Cog
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 38 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #95 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 38 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog1 INIT $0000_0F5C $0000_1834 jump
[TWO-TIER] 🎯 Routing message: TERMINAL_OUTPUT, 0 bytes
[TWO-TIER] 🎯 Found 1 destinations for TERMINAL_OUTPUT
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #94 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: TERMINAL_OUTPUT, 0 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: TERMINAL_OUTPUT
[DEBUG LOGGER] Added to write buffer: 
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 31 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #93 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 31 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[DEBUG LOGGER] Added to write buffer: Cog1 Task in new COG started
[TWO-TIER] 🎯 Routing message: DEBUGGER_416BYTE, 416 bytes
[TWO-TIER] 🎯 Found 2 destinations for DEBUGGER_416BYTE
[MessageRouter] Emitting debuggerPacketReceived event for P2 response
[Processor] Forwarding debuggerPacketReceived event
[DEBUGGER] Received 416-byte packet from COG1
[DEBUGGER] Auto-creating debugger window for COG1
?Base?: DebugDebuggerWindow created for COG 1
?Base?: Creating debugger window for COG 1: 1004x1272 at 40,65
Base: - New DebugDebuggerWindow window
[DEBUGGER] Successfully created debugger window for COG1
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #92 created with 2 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: DEBUGGER_416BYTE, 416 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: DEBUGGER_416BYTE
[DEBUG LOGGER] Added to write buffer: Cog 1:
  000: $01000000 $01000000   $0E00A103 $F80
[DEBUG LOGGER] Flushed 64 bytes to log file
[DEBUG LOGGER] Sending batch of 8 messages to window
[DEBUG LOGGER] Flushed 64 bytes to log file
[DEBUG LOGGER] Flushed 51 bytes to log file
[DEBUG LOGGER] Flushed 46 bytes to log file
[DEBUG LOGGER] Flushed 64 bytes to log file
[DEBUG LOGGER] Flushed 28 bytes to log file
[DEBUG LOGGER] Flushed 56 bytes to log file
[DEBUG LOGGER] Flushed 178 bytes to log file
2025-09-01T17:44:02.297Z [INFO ] REGISTER_INSTANCE: Window instance registered: debugger-1 (debugger). Can receive messages to queue. 
?Base?: Debugger window for COG 1 ready to show
Base: - Registered with WindowRouter: debugger-1 (debugger)
Base: - Window marked as ready for debugger
Base: - Transitioning to IMMEDIATE processing (no batching delays)
Base: - Immediate processing active (zero delay)
2025-09-01T17:44:02.411Z [INFO ] REGISTER: Window registered: debugger-1 (debugger). Active windows: 2 
Window debugger-cog1 moved from monitor 8 to 7
Window debugger-cog1 moved from monitor 7 to 8
```

### Part 2: Debug Logger Window Output (First Session)
```
11:44:02.295125
Cog0 INIT $0000_0000 $0000_0000 load
        .296136
Cog0 INIT $0000_0F5C $0000_1C74 jump
        .296140
Cog0 hi from debug demo
        .296142
Cog0 Start 1st Cog
        .296145
Cog1 INIT $0000_0F5C $0000_1834 jump
        .297147
        .297149
Cog1 Task in new COG started
        .313151
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $757A3E00   $FF010000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
```

### Part 3: Visual Observations (First Session)
- **Expected:** HTML menu should appear (no longer gated by IDE mode)
- **Actual:** Black region where menu should be, but no content
- **Status:** Menu creation logic runs but rendering fails
- **Debugger Window:** New debugger window created with title/status bars but completely black content area
- **Window Type:** debug-debugger-win instance with proper framework but no content rendering

### Part 4: Console Log (Post DTR Assert)
```
Window debugger-cog1 moved from monitor 7 to 8
?Base?: Debugger window for COG 1 closed
?Base?: DebugDebuggerWindow closed for COG 1
2025-09-01T17:51:08.031Z [INFO ] UNREGISTER: Window unregistered: debugger-1. Active windows: 1 
[IPC] Received toggle-dtr request, delegating to toggleDTR()
[DEBUG LOGGER] Creating logs directory at: /Users/stephen/logs
[UTIL] Log folder already exists at: /Users/stephen/logs
[DEBUG LOGGER] Log file path: /Users/stephen/logs/debug_250901-1151.log
[DEBUG LOGGER] Write stream created successfully
[DEBUG LOGGER] Log file initialized successfully at: /Users/stephen/logs/debug_250901-1151.log
[DEBUG LOGGER] Added to write buffer: [SYSTEM] DTR Reset - New session started
[DTRResetManager] DTR reset detected, sequence 1
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DEBUGGER RESPONSE] DTR reset detected, clearing response state
[DTRResetManager] Waiting for queues to drain...
[DEBUG LOGGER] Write stream opened with fd: 66
[DEBUG LOGGER] Flushed 68 bytes to log file
[DEBUG LOGGER] Log file header written and flushed
[DEBUG LOGGER] Log file synced to disk
[DEBUG LOGGER] Sending batch of 1 messages to window
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
```

### Part 5: Sequence Clarification
- User manually closed the debugger window before asserting DTR
- UNREGISTER message was from manual window closure, not DTR reset
- DTR reset sequence then ran cleanly after window was already closed

### Part 6: Debug Logger DTR Reset Behavior
- **Before DTR:** Full message history (COG messages, debugger data)
- **After DTR:** Window cleared completely 
- **After DTR:** Shows only "[SYSTEM] DTR Reset - New session started" message
- **Status:** ✅ Working as expected - clean slate for new debug session

### Part 7: Enhancement Request
- **Request:** Log the debug log filename to console on each log file creation
- **Purpose:** Quick audit trail to verify new logs are starting correctly after DTR resets
- **Current:** Log filename only visible in debug logger internal logs
- **Desired:** Console output like `[DEBUG LOGGER] Started new log: /Users/stephen/logs/debug_250901-1151.log`

### Part 8: Console Log (Post DTR Release - Second Cycle)
```
[DTRResetManager] DTR reset complete, log rotated
[IPC] Received toggle-dtr request, delegating to toggleDTR()
[SERIAL RX 4023718254µs] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[SERIAL RX 4023726529µs] Received 186 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $46 $35 $43 $20 $24 $30  $30 $30 $30 $5F $31 $43 $37 $34   _0F5C $0000_1C74
  0020: $20 $6A $75 $6D $70 $0D $0A $43  $6F $67 $30 $20 $20 $68 $69 $20    jump..Cog0  hi 
  0030: $66 $72 $6F $6D $20 $64 $65 $62  $75 $67 $20 $64 $65 $6D $6F $0D   from debug demo.
  0040: $0A $43 $6F $67 $30 $20 $20 $53  $74 $61 $72 $74 $20 $31 $73 $74   .Cog0  Start 1st
  0050: $20 $43 $6F $67 $0D $0A $43 $6F  $67 $31 $20 $20 $49 $4E $49 $54    Cog..Cog1  INIT
  0060: $20 $24 $30 $30 $30 $30 $5F $30  $46 $35 $43 $20 $24 $30 $30 $30    $0000_0F5C $000
  0070: $30 $5F $31 $38 $33 $34 $20 $6A  $75 $6D $70 $0D $0A $43 $6F $67   0_1834 jump..Cog
  0080: $31 $20 $20 $54 $61 $73 $6B $20  $69 $6E $20 $6E $65 $77 $20 $43   1  Task in new C
  0090: $4F $47 $20 $73 $74 $61 $72 $74  $65 $64 $0D $0A $01 $00 $00 $00   OG started......
  00a0: $01 $00 $00 $00 $0E $00 $A1 $03  $F8 $01 $00 $00 $00 $00 $00 $00   ......!.x.......
  00b0: $75 $7A $3E $00 $FF $01 $00 $00  $00 $00                           uz>.......
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 186 bytes, running: true
[SERIAL RX 4023729385µs] Received 372 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $5F $02 $00 $40 $69 $1C   .........._..@i.
  0020: $00 $00 $4C $18 $00 $00 $00 $00  $08 $00 $80 $B2 $E6 $0E $10 $00   ..L........2f...
  0030: $00 $00 $40 $2F $40 $2F $40 $2F  $40 $2F $40 $2F $40 $2F $40 $2F   ..@/@/@/@/@/@/@/
  0040: $40 $2F $40 $2F $40 $2F $40 $2F  $40 $2F $40 $2F $40 $2F $40 $2F   @/@/@/@/@/@/@/@/
  0050: $40 $2F $40 $2F $40 $2F $A4 $B4  $5E $8C $47 $39 $C0 $E8 $09 $EB   @/@/@/$4^.G9@h.k
  0060: $89 $ED $A7 $CD $83 $6A $AC $63  $4D $77 $F3 $F9 $FE $2F $40 $2F   .m'M.j,cMwsy~/@/
  0070: $5B $CB $40 $2F $E2 $54 $47 $BA  $60 $B1 $4B $F5 $F7 $F9 $BD $CB   [K@/bTG:`1Kuwy=K
  0080: $2F $74 $9F $2F $31 $18 $A4 $62  $95 $D7 $44 $B5 $06 $6E $4F $D1   /t./1.$b.WD5.nOQ
  0090: $E6 $51 $1D $4B $28 $50 $CE $20  $46 $94 $A3 $D1 $50 $E3 $49 $A2   fQ.K(PN F.#QPcI"
  00a0: $7D $B1 $CE $48 $BD $F1 $8A $EF  $CE $D7 $01 $BC $B6 $78 $E3 $A5   }1NH=q.oNW.<6xc%
  00b0: $E6 $74 $E9 $60 $34 $38 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   fti`48..........
  00c0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00d0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00e0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00f0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0100: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0110: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0120: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0130: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0140: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0150: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0160: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0170: $00 $00 $00 $00                                                    ....
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 372 bytes, running: true
[MessageRouter] Adaptive timer: 2ms (velocity: 8 msg/s, processing: 20ms)
[TWO-TIER] 🎯 Routing message: DEBUGGER_416BYTE, 416 bytes
[TWO-TIER] 🎯 Found 2 destinations for DEBUGGER_416BYTE
[MessageRouter] Emitting debuggerPacketReceived event for P2 response
[Processor] Forwarding debuggerPacketReceived event
[DEBUGGER] Received 416-byte packet from COG0
[DEBUGGER] Auto-creating debugger window for COG0
?Base?: DebugDebuggerWindow created for COG 0
?Base?: Creating debugger window for COG 0: 1004x1272 at 1516,65
Base: - New DebugDebuggerWindow window
[DEBUGGER] Successfully created debugger window for COG0
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #91 created with 2 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: DEBUGGER_416BYTE, 416 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: DEBUGGER_416BYTE
[DEBUG LOGGER] Added to write buffer: Cog 0:
  000: $00000000 $00000000   $00000000 $000
[DEBUG LOGGER] Flushed 178 bytes to log file
[SERIAL RX 4023769549µs] Received 54 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00                                            ......
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 54 bytes, running: true
[DEBUG LOGGER] Sending batch of 1 messages to window
2025-09-01T17:54:39.886Z [INFO ] REGISTER_INSTANCE: Window instance registered: debugger-0 (debugger). Can receive messages to queue. 
?Base?: Debugger window for COG 0 ready to show
Base: - Registered with WindowRouter: debugger-0 (debugger)
Base: - Window marked as ready for debugger
Base: - Transitioning to IMMEDIATE processing (no batching delays)
Base: - Immediate processing active (zero delay)
2025-09-01T17:54:39.995Z [INFO ] REGISTER: Window registered: debugger-0 (debugger). Active windows: 2 
```

### Part 9: Debug Logger Output (Second Session)
```
11:51:10.529281
DTR Reset - New session started
11:54:39.911235
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
```

### Part 10: Critical Root Cause Analysis (FINAL)
- **Expected Behavior:** Only COG1 and COG2 debugger windows should exist (based on actual P2 program)
- **Actual Problem:** Getting COG0 debugger windows that shouldn't exist
- **Root Cause:** Hardware sending stream of zeros between valid traffic
- **Hardware Issue:** Likely missing pull-up resistor or similar hardware problem causing zeros in serial stream
- **Parser Impact:** Zero-filled packets being misinterpreted as valid COG0 debugger data
- **System Consequences:** 
  - Wrong COG identification in debugger packets
  - P2 system hangs waiting for COG1 response while system responds to fake COG0
  - Protocol mismatch causing communication breakdown

## Analysis

### ✅ Systems Working Correctly
1. **Application Startup** - Clean launch, proper device detection, window initialization
2. **Serial Communication** - Data reception and hex logging working perfectly
3. **Debug Logger** - Auto-creation, message routing, file logging, DTR reset handling all functional
4. **DTR Reset Cycle** - Single reset sequence (no more double resets), proper queue draining, log rotation
5. **Window Management** - Registration, unregistration, positioning all working
6. **Message Processing** - Two-tier pattern matching, message routing, buffering all operational

### ❌ Critical Issues Identified

#### 1. **CRITICAL: Spurious COG0 Debugger Windows** 
- **Root Cause:** Hardware sending zero-filled data interpreted as valid COG0 debugger packets
- **Evidence:** 416-byte packets of all zeros being classified as `DEBUGGER_416BYTE` from COG0
- **Impact:** P2 hangs waiting for COG1 response while system responds to fake COG0
- **Hardware Problem:** Missing pull-up resistor or similar causing zero padding in serial stream

#### 2. **CRITICAL: Debugger Window Rendering Failure**
- **Symptom:** Debugger windows create with proper framework (title, status bars) but black content area
- **Evidence:** "DebugDebuggerWindow created" logs show success, but visual observation shows no content
- **Scope:** Affects all debugger windows (COG0, COG1) consistently
- **Type:** DOM/JavaScript injection failure, not window creation failure

#### 3. **CRITICAL: HTML Menu Not Displaying**
- **Symptom:** Menu creation logic runs ("HTML menu bar will be used") but no visual menu appears
- **Evidence:** Black region where menu should be, console logs show setup completion
- **Scope:** Main window menu system completely non-functional
- **Type:** DOM rendering failure similar to debugger window content issue

### 🔍 Pattern Analysis

**Common Thread:** All three critical issues involve **DOM content injection/rendering failures**:
- Debugger window content not injecting
- HTML menu content not injecting  
- Window frameworks create successfully but content fails to render

This suggests a **systematic DOM/JavaScript execution problem** rather than individual component failures.

### 🚨 Impact Assessment

**Immediate Blocking Issues:**
1. **P2 Communication Lockup** - Spurious COG0 responses cause protocol breakdown
2. **No Menu Access** - Users cannot access application functions
3. **No Debugger Functionality** - Core feature completely unusable

**System State:** Application launches but core functionality is broken.

## Priority Assessment

### 🔴 **CRITICAL PRIORITY 1: Hardware Stream Filtering**
- **Issue:** Spurious COG0 debugger windows causing P2 lockup
- **Fix Required:** Filter/ignore zero-filled 416-byte packets before debugger window creation
- **Urgency:** Blocks all P2 communication and testing

### 🔴 **CRITICAL PRIORITY 2: DOM Content Rendering**
- **Issue:** Systematic failure of JavaScript/HTML injection into windows
- **Components Affected:** Debugger windows, HTML menu
- **Fix Required:** Debug and repair DOM injection timing/execution

### 🟡 **MEDIUM PRIORITY: Enhancement Request**
- **Issue:** Log filename visibility for audit trail
- **Fix Required:** Add console logging of debug log filenames

## Next Steps

### Phase 1: Emergency Protocol Fix (Priority 1)
1. **Immediate:** Add zero-packet filtering before debugger window auto-creation
2. **Goal:** Stop spurious COG0 windows, restore P2 communication
3. **Success Criteria:** Only valid COG1/COG2 debugger windows created

### Phase 2: Content Rendering Repair (Priority 2)  
1. **Investigate:** DOM injection timing and JavaScript execution failures
2. **Compare:** Working Debug Logger vs broken Debugger windows and menu
3. **Fix:** Restore HTML/JavaScript content injection to debugger windows and menu
4. **Success Criteria:** Debugger windows show content, menu appears and functions

### Phase 3: Enhancement Implementation
1. **Add:** Console logging of debug log filenames
2. **Verify:** Audit trail functionality working

### Recommended Immediate Action
**Start with Priority 1** - The zero-packet filtering is a surgical fix that will restore P2 communication and allow continued testing of other fixes. Priority 2 requires deeper investigation but doesn't prevent basic system operation.