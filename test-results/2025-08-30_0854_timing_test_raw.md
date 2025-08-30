# Hardware Test Results - 2025-08-30 08:54 (Timing Test)

## Test Environment
- **Date/Time**: 2025-08-30 08:54
- **Build**: Latest with microsecond timestamps
- **Device**: P2 Hardware via /dev/tty.usbserial-P9cektn7
- **Purpose**: Capture timing gaps between COG packets

## Raw Test Data

### Part 1 - Console Log (Initial Connection)
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
* Version 0.1.0, Build date: 8/30/2025

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
2025-08-30T08:54:05.297Z [INFO ] STARTUP: WindowRouter initialized 
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
[UI UPDATE] ❌ Failed to execute toolbar-event-handlers: Error: Script failed to execute, this normally means an error was thrown. Check the renderer console for the error.
    at node:electron/js2c/renderer_init:2:16600
    at IpcRendererInternal.<anonymous> (node:electron/js2c/renderer_init:2:10905)
    at IpcRendererInternal.emit (node:events:518:28)
    at Object.onMessage (node:electron/js2c/renderer_init:2:8918)
[UI UPDATE] 🔍 Script was: 
        (function() {
          // Use the pre-exposed window.ipcRenderer from HTML template
      ...
[UI UPDATE] 💡 This usually means a DOM element is missing or script syntax error
2025-08-30T08:54:05.498Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger). Can receive messages to queue. 
2025-08-30T08:54:05.505Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1 
[DEBUG LOGGER] Window did-finish-load event fired!
[DEBUG LOGGER] Window shown and focused
?Base?: Debug Logger window ready
[DEBUG LOGGER] Verified still registered: DebugLogger
[SERIAL RX 2163064310074µs] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 0ms)
[SERIAL RX 2163064316034µs] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $46 $35 $43 $20 $24 $30  $30 $30 $30 $5F $31 $43 $37 $34   _0F5C $0000_1C74
  0020: $20 $6A $75 $6D $70 $0D $0A $43  $6F $67 $30 $20 $20 $68 $69 $20    jump..Cog0  hi 
  0030: $66 $72 $6F $6D $20 $64 $65 $62  $75 $67 $20 $64 $65 $6D           from debug dem
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX 2163064316875µs] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $6F $0D $0A $43 $6F $67 $30 $20  $20 $53 $74 $61 $72 $74 $20 $31   o..Cog0  Start 1
  0010: $73 $74 $20 $43 $6F $67 $0D $0A  $43 $6F $67 $31 $20 $20 $49 $4E   st Cog..Cog1  IN
  0020: $49 $54 $20 $24 $30 $30 $30 $30  $5F $30 $46 $35 $43 $20 $24 $30   IT $0000_0F5C $0
  0030: $30 $30 $30 $5F $31 $38 $33 $34  $20 $6A $75 $6D $70 $0D $0A $43   000_1834 jump..C
  0040: $6F $67 $31 $20 $20 $54 $61 $73  $6B $20 $69 $6E $20 $6E $65 $77   og1  Task in new
  0050: $20 $43 $4F $47 $20 $73 $74 $61  $72 $74 $65 $64 $0D $0A $01 $00    COG started....
  0060: $00 $00 $01 $00 $00 $00 $0E $00  $A1 $03 $F8 $01 $00 $00 $00 $00   ........!.x.....
  0070: $00 $00 $75 $7A $3E $00 $FF $01  $00 $00 $00 $00                   ..uz>.......
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX 2163064318130µs] Received 186 bytes
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
  00b0: $E6 $74 $E9 $60 $34 $38 $00 $00  $00 $00                           fti`48....
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 186 bytes, running: true
[SERIAL RX 2163064318717µs] Received 124 bytes
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
[SERIAL RX 2163064319110µs] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #99 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #98 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 26 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #97 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 26 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 21 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #96 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 21 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #95 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 31 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #94 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 31 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: DEBUGGER_80BYTE, 80 bytes
[TWO-TIER] 🎯 Found 2 destinations for DEBUGGER_80BYTE
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #93 created with 2 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: DEBUGGER_80BYTE, 80 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: DEBUGGER_80BYTE
[SERIAL RX 2163064337268µs] Received 54 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00                                            ......
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 54 bytes, running: true
[DEBUG LOGGER] Sending batch of 7 messages to window
```

### Part 2 - Debug Logger Output
```
02:54:07.773454
Cog0 INIT $0000_0000 $0000_0000 load
        .774474
Cog0 INIT $0000_0F5C $0000_1C74 jump
        .774482
Cog0 hi from debug demo
        .774486
Cog0 Start 1st Cog
        .774490
Cog1 INIT $0000_0F5C $0000_1834 jump
        .774494
Cog1 Task in new COG started
        .774499
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $757A3E00   $FF010000 $00000000
  020: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $5F020040 $691C0000
  040: $4C180000 $00000800   $80B2E60E $10000000
```

### Part 3 - Console Log (DTR Pressed)
**CRITICAL ISSUE: Multiple DTR events for single press!**
```
[DEBUG LOGGER] Processing typed message: DEBUGGER_80BYTE
[DEBUG LOGGER] Sending batch of 7 messages to window
[IPC] Received toggle-dtr request
[IPC] Setting DTR to: true (was false)
[IPC] Received toggle-dtr request
[IPC] Setting DTR to: true (was false)
[DTRResetManager] DTR reset detected, sequence 1
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DTRResetManager] Waiting for queues to drain...
[IPC] DTR line set to: true
[IPC] DTR asserted, triggering reset
[IPC] DTR Reset triggered in Debug Logger
[DTRResetManager] DTR reset detected, sequence 2
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DTRResetManager] Waiting for queues to drain...
[IPC] DTR line set to: true
[IPC] DTR asserted, triggering reset
[IPC] DTR Reset triggered in Debug Logger
[DTRResetManager] DTR reset detected, sequence 3
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DTRResetManager] Waiting for queues to drain...
[DTRResetManager] DTR reset detected, sequence 4
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DTRResetManager] Waiting for queues to drain...
[DEBUG LOGGER] Sending batch of 1 messages to window
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
```

### Part 4 - Debug Logger (After DTR Press)
```
02:56:22.314817
DTR Reset - New session started
```

### Part 5 - Console Log (After DTR Released)
```
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
[IPC] Received toggle-dtr request
[IPC] Setting DTR to: false (was true)
[IPC] Received toggle-dtr request
[IPC] Setting DTR to: false (was true)
[IPC] DTR line set to: false
[IPC] DTR de-asserted
[IPC] DTR line set to: false
[IPC] DTR de-asserted
[SERIAL RX 2163303791648µs] Received 186 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A $43  $6F $67 $30 $20 $20 $49 $4E $49    load..Cog0  INI
  0030: $54 $20 $24 $30 $30 $30 $30 $5F  $30 $46 $35 $43 $20 $24 $30 $30   T $0000_0F5C $00
  0040: $30 $30 $5F $31 $43 $37 $34 $20  $6A $75 $6D $70 $0D $0A $43 $6F   00_1C74 jump..Co
  0050: $67 $30 $20 $20 $68 $69 $20 $66  $72 $6F $6D $20 $64 $65 $62 $75   g0  hi from debu
  0060: $67 $20 $64 $65 $6D $6F $0D $0A  $43 $6F $67 $30 $20 $20 $53 $74   g demo..Cog0  St
  0070: $61 $72 $74 $20 $31 $73 $74 $20  $43 $6F $67 $0D $0A $43 $6F $67   art 1st Cog..Cog
  0080: $31 $20 $20 $49 $4E $49 $54 $20  $24 $30 $30 $30 $30 $5F $30 $46   1  INIT $0000_0F
  0090: $35 $43 $20 $24 $30 $30 $30 $30  $5F $31 $38 $33 $34 $20 $6A $75   5C $0000_1834 ju
  00a0: $6D $70 $0D $0A $43 $6F $67 $31  $20 $20 $54 $61 $73 $6B $20 $69   mp..Cog1  Task i
  00b0: $6E $20 $6E $65 $77 $20 $43 $4F  $47 $20                           n new COG 
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 186 bytes, running: true
[SERIAL RX 2163303793469µs] Received 248 bytes
[SERIAL RX HEX/ASCII]:
  0000: $73 $74 $61 $72 $74 $65 $64 $0D  $0A $01 $00 $00 $00 $01 $00 $00   started.........
  0010: $00 $0E $00 $A1 $03 $F8 $01 $00  $00 $00 $00 $00 $00 $75 $7A $3E   ...!.x.......uz>
  0020: $00 $FF $01 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0040: $00 $5F $02 $00 $40 $69 $1C $00  $00 $4C $18 $00 $00 $00 $00 $08   ._..@i...L......
  0050: $00 $80 $B2 $E6 $0E $10 $00 $00  $00 $40 $2F $40 $2F $40 $2F $40   ..2f.....@/@/@/@
  0060: $2F $40 $2F $40 $2F $40 $2F $40  $2F $40 $2F $40 $2F $40 $2F $40   /@/@/@/@/@/@/@/@
  0070: $2F $40 $2F $40 $2F $40 $2F $40  $2F $40 $2F $40 $2F $A4 $B4 $5E   /@/@/@/@/@/@/$4^
  0080: $8C $47 $39 $C0 $E8 $09 $EB $89  $ED $A7 $CD $83 $6A $AC $63 $4D   .G9@h.k.m'M.j,cM
  0090: $77 $F3 $F9 $FE $2F $40 $2F $5B  $CB $40 $2F $E2 $54 $47 $BA $60   wsy~/@/[K@/bTG:`
  00a0: $B1 $4B $F5 $F7 $F9 $BD $CB $2F  $74 $9F $2F $31 $18 $A4 $62 $95   1Kuwy=K/t./1.$b.
  00b0: $D7 $44 $B5 $06 $6E $4F $D1 $E6  $51 $1D $4B $28 $50 $CE $20 $46   WD5.nOQfQ.K(PN F
  00c0: $94 $A3 $D1 $50 $E3 $49 $A2 $7D  $B1 $CE $48 $BD $F1 $8A $EF $CE   .#QPcI"}1NH=q.oN
  00d0: $D7 $01 $BC $B6 $78 $E3 $A5 $E6  $74 $E9 $60 $34 $38 $00 $00 $00   W.<6xc%fti`48...
  00e0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00f0: $00 $00 $00 $00 $00 $00 $00 $00                                    ........
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 248 bytes, running: true
[SERIAL RX 2163303794577µs] Received 186 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0040: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0050: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0060: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0070: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0080: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0090: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00a0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00b0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00                           ..........
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 186 bytes, running: true
[SERIAL RX 2163303810174µs] Received 31 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00       ...............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 31 bytes, running: true
```

### Part 6 - Final Analysis from User

**USER FINDINGS:**
- DTR mechanism is now working beautifully ✅
- However, NO messages got routed to the Debug Logger after DTR release ❌
- Debug Logger still only has that one line from DTR reset
- Appears we're not receiving the second traffic (COG2) even though it's supposedly being sent by P2
- User will check with logic analyzer to confirm if:
  - P2 is actually sending both packets
  - There are pauses between the packets
  - Both COG messages are present on the wire

**NEXT STEP:** User will capture with logic analyzer to see actual hardware signals