# Hardware Test Results - 2025-08-30 06:30

## Test Environment
- **Date/Time**: 2025-08-30 06:30
- **Build**: Current test build
- **Device**: P2 Hardware
- **Purpose**: Complete capture of external hardware test data

## Raw Test Data

### Capture 1 - Initial Connection (Not Synchronized)
*Note: At this point, we hit the serial stream but we're not synchronized to the processor. Some things are happening, although we did see a reset.*

```
CONSOLE LOG:
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
2025-08-30T07:01:17.490Z [INFO ] STARTUP: WindowRouter initialized 
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
2025-08-30T07:01:17.831Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger). Can receive messages to queue. 
2025-08-30T07:01:17.839Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1 
[DEBUG LOGGER] Window did-finish-load event fired!
[DEBUG LOGGER] Window shown and focused
?Base?: Debug Logger window ready
[DEBUG LOGGER] Verified still registered: DebugLogger
[SERIAL RX] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[MessageRouter] Adaptive timer: 20ms (velocity: 0 msg/s, processing: 0ms)
[SERIAL RX] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $46 $35 $43 $20 $24 $30  $30 $30 $30 $5F $31 $43 $36 $38   _0F5C $0000_1C68
  0020: $20 $6A $75 $6D $70 $0D $0A $43  $6F $67 $30 $20 $20 $68 $69 $20    jump..Cog0  hi 
  0030: $66 $72 $6F $6D $20 $64 $65 $62  $75 $67 $20 $64 $65 $6D $6F $0D   from debug demo.
  0040: $0A $43 $6F $67 $31 $20 $20 $49  $4E $49 $54 $20 $24 $30 $30 $30   .Cog1  INIT $000
  0050: $30 $5F $30 $46 $35 $43 $20 $24  $30 $30 $30 $30 $5F $31 $38 $33   0_0F5C $0000_183
  0060: $34 $20 $6A $75 $6D $70 $0D $0A  $43 $6F $67 $32 $20 $20 $49 $4E   4 jump..Cog2  IN
  0070: $49 $54 $20 $24 $30 $30 $30 $30  $5F $30 $46 $35                   IT $0000_0F5
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $20 $24 $30 $30 $30 $30 $5F  $31 $41 $33 $34 $20 $6A $75 $6D   C $0000_1A34 jum
  0010: $70 $0D $0A $43 $6F $67 $30 $20  $20 $54 $61 $73 $6B $73 $20 $72   p..Cog0  Tasks r
  0020: $75 $6E $2C $20 $4D $61 $69 $6E  $20 $6E $6F $77 $20 $6C $6F $6F   un, Main now loo
  0030: $70 $69 $6E $67 $21 $0D $0A $43  $6F $67 $31 $20 $20 $54 $61 $73   ping!..Cog1  Tas
  0040: $6B $20 $69 $6E $20 $6E $65 $77  $20 $43 $4F $47 $20 $73 $74 $61   k in new COG sta
  0050: $72 $74 $65 $64 $0D $0A $43 $6F  $67 $32 $20 $20 $54 $61 $73 $6B   rted..Cog2  Task
  0060: $20 $69 $6E $20 $6E $65 $77 $20  $43 $4F $47 $20 $73 $74 $61 $72    in new COG star
  0070: $74 $65 $64 $0D $0A $01 $00 $00  $00 $01 $00 $00                   ted.........
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $0E $00 $A1 $03 $F8 $01 $00  $00 $00 $00 $00 $00 $85 $22 $40   ...!.x........"@
  0010: $00 $FF $01 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $5F $02 $00 $40 $5D $1C $00  $00 $4C $18 $00 $00 $00 $00 $08   ._..@]...L......
  0040: $00 $80 $B2 $E6 $0E $10 $00 $00  $00 $40 $2F $40 $2F $40 $2F $40   ..2f.....@/@/@/@
  0050: $2F $40 $2F $40 $2F $40 $2F $40  $2F $40 $2F $40 $2F $40 $2F $40   /@/@/@/@/@/@/@/@
  0060: $2F $40 $2F $40 $2F $40 $2F $40  $2F $40 $2F $40 $2F $A4 $B4 $5E   /@/@/@/@/@/@/$4^
  0070: $8C $47 $39 $C0 $E8 $09 $EB $89  $ED $A7 $CD $83                   .G9@h.k.m'M.
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $6A $AC $63 $4D $77 $F3 $E7 $FE  $2F $40 $2F $0A $04 $40 $2F $E2   j,cMwsg~/@/..@/b
  0010: $54 $47 $BA $60 $B1 $4B $F5 $F7  $F9 $BD $CB $2F $74 $9F $2F $31   TG:`1Kuwy=K/t./1
  0020: $18 $A4 $62 $95 $D7 $44 $B5 $06  $6E $4F $D1 $E6 $51 $1D $4B $28   .$b.WD5.nOQfQ.K(
  0030: $50 $CE $20 $46 $94 $A3 $D1 $50  $E3 $49 $A2 $7D $B1 $CE           PN F.#QPcI"}1N
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $48 $BD $F1 $8A $EF $CE $D7 $01  $BC $B6 $78 $E3 $A5 $E6 $74 $E9   H=q.oNW.<6xc%fti
  0010: $60 $55 $77 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   `Uw.............
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 15 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00       ...............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 15 bytes, running: true
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
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #96 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 39 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #95 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 39 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 36 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #94 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 36 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 31 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #93 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 31 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: COG_MESSAGE, 31 bytes
[TWO-TIER] 🎯 Found 1 destinations for COG_MESSAGE
[MessageRouter] Creating pooled message for 1 consumers
[MessageRouter] Pooled message #92 created with 1 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: COG_MESSAGE, 31 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: COG_MESSAGE
[TWO-TIER] 🎯 Routing message: DEBUGGER_80BYTE, 80 bytes
[TWO-TIER] 🎯 Found 2 destinations for DEBUGGER_80BYTE
[MessageRouter] Creating pooled message for 2 consumers
[MessageRouter] Pooled message #91 created with 2 consumers
[TWO-TIER] 📨 Routing message to Debug Logger: DEBUGGER_80BYTE, 80 bytes
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: DEBUGGER_80BYTE
[DEBUG LOGGER] Sending batch of 9 messages to window
```

### Capture 2 - Debug Logger Output
```
01:01:20.073839
Cog0 INIT $0000_0000 $0000_0000 load
        .074856
Cog0 INIT $0000_0F5C $0000_1C68 jump
        .074862
Cog0 hi from debug demo
        .074866
Cog1 INIT $0000_0F5C $0000_1834 jump
        .074870
Cog2 INIT $0000_0F5C $0000_1A34 jump
        .074874
Cog0 Tasks run, Main now looping!
        .074877
Cog1 Task in new COG started
        .074881
Cog2 Task in new COG started
        .075885
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $85224000   $FF010000 $00000000
  020: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $5F020040 $5D1C0000
  040: $4C180000 $00000800   $80B2E60E $10000000
```

### Capture 3 - Console Log After External Hardware Reset
```
[TWO-TIER] ✅ Debug Logger window available, processing message
[DEBUG LOGGER] Processing typed message: DEBUGGER_80BYTE
[DEBUG LOGGER] Sending batch of 9 messages to window
[SERIAL RX] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 39 bytes, running: true
[SERIAL RX] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $46 $35 $43 $20 $24 $30  $30 $30 $30 $5F $31 $43 $36 $38   _0F5C $0000_1C68
  0020: $20 $6A $75 $6D $70 $0D $0A $43  $6F $67 $30 $20 $20 $68 $69 $20    jump..Cog0  hi 
  0030: $66 $72 $6F $6D $20 $64 $65 $62  $75 $67 $20 $64 $65 $6D $6F $0D   from debug demo.
  0040: $0A $43 $6F $67 $31 $20 $20 $49  $4E $49 $54 $20 $24 $30 $30 $30   .Cog1  INIT $000
  0050: $30 $5F $30 $46 $35 $43 $20 $24  $30 $30 $30 $30 $5F $31 $38 $33   0_0F5C $0000_183
  0060: $34 $20 $6A $75 $6D $70 $0D $0A  $43 $6F $67 $32 $20 $20 $49 $4E   4 jump..Cog2  IN
  0070: $49 $54 $20 $24 $30 $30 $30 $30  $5F $30 $46 $35                   IT $0000_0F5
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX] Received 186 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $20 $24 $30 $30 $30 $30 $5F  $31 $41 $33 $34 $20 $6A $75 $6D   C $0000_1A34 jum
  0010: $70 $0D $0A $43 $6F $67 $30 $20  $20 $54 $61 $73 $6B $73 $20 $72   p..Cog0  Tasks r
  0020: $75 $6E $2C $20 $4D $61 $69 $6E  $20 $6E $6F $77 $20 $6C $6F $6F   un, Main now loo
  0030: $70 $69 $6E $67 $21 $0D $0A $43  $6F $67 $31 $20 $20 $54 $61 $73   ping!..Cog1  Tas
  0040: $6B $20 $69 $6E $20 $6E $65 $77  $20 $43 $4F $47 $20 $73 $74 $61   k in new COG sta
  0050: $72 $74 $65 $64 $0D $0A $43 $6F  $67 $32 $20 $20 $54 $61 $73 $6B   rted..Cog2  Task
  0060: $20 $69 $6E $20 $6E $65 $77 $20  $43 $4F $47 $20 $73 $74 $61 $72    in new COG star
  0070: $74 $65 $64 $0D $0A $01 $00 $00  $00 $01 $00 $00 $00 $0E $00 $A1   ted............!
  0080: $03 $F8 $01 $00 $00 $00 $00 $00  $00 $85 $22 $40 $00 $FF $01 $00   .x........"@....
  0090: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  00a0: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $5F $02 $00   ............._..
  00b0: $40 $5D $1C $00 $00 $4C $18 $00  $00 $00                           @]...L....
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 186 bytes, running: true
[SERIAL RX] Received 124 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $08 $00 $80 $B2 $E6 $0E $10  $00 $00 $00 $40 $2F $40 $2F $40   ....2f.....@/@/@
  0010: $2F $40 $2F $40 $2F $40 $2F $40  $2F $40 $2F $40 $2F $40 $2F $40   /@/@/@/@/@/@/@/@
  0020: $2F $40 $2F $40 $2F $40 $2F $40  $2F $40 $2F $40 $2F $40 $2F $A4   /@/@/@/@/@/@/@/$
  0030: $B4 $5E $8C $47 $39 $C0 $E8 $09  $EB $89 $ED $A7 $CD $83 $6A $AC   4^.G9@h.k.m'M.j,
  0040: $63 $4D $77 $F3 $E7 $FE $2F $40  $2F $0A $04 $40 $2F $E2 $54 $47   cMwsg~/@/..@/bTG
  0050: $BA $60 $B1 $4B $F5 $F7 $F9 $BD  $CB $2F $74 $9F $2F $31 $18 $A4   :`1Kuwy=K/t./1.$
  0060: $62 $95 $D7 $44 $B5 $06 $6E $4F  $D1 $E6 $51 $1D $4B $28 $50 $CE   b.WD5.nOQfQ.K(PN
  0070: $20 $46 $94 $A3 $D1 $50 $E3 $49  $A2 $7D $B1 $CE                    F.#QPcI"}1N
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 124 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $48 $BD $F1 $8A $EF $CE $D7 $01  $BC $B6 $78 $E3 $A5 $E6 $74 $E9   H=q.oNW.<6xc%fti
  0010: $60 $55 $77 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   `Uw.............
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 62 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0010: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0020: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00 $00   ................
  0030: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00           ..............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 62 bytes, running: true
[SERIAL RX] Received 15 bytes
[SERIAL RX HEX/ASCII]:
  0000: $00 $00 $00 $00 $00 $00 $00 $00  $00 $00 $00 $00 $00 $00 $00       ...............
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 15 bytes, running: true
```

### User Observations
- **DTR is NOT working** - Cannot reset P2 from application
- **RAM and Flash buttons are also NOT working** - Additional hardware control failures
- **Menu is NOT showing** - HTML menu bar missing from application window

---

## Analysis

### Data Reception Pattern Analysis

#### After External Reset - Packet Structure:
1. **39 bytes** - "Cog0  INIT $0000_0000 $0000_0000 load"
2. **124 bytes** - Multiple COG messages ending at 0x7B (incomplete)
3. **186 bytes** - CRITICAL: Contains COG1 debugger packet starting at 0x78
4. **124 bytes** - Continuation of debugger data
5. **62 bytes** - End of debugger data + zeros
6. **4x 62 bytes** - All zeros
7. **15 bytes** - All zeros

**Total**: 736 bytes received

### Critical Finding #1: COG1 Packet Found, COG2 Missing

Looking at the 186-byte packet (packet 3):
- Offset 0x78 (120 decimal): `$01 $00 $00 $00` - **COG1 packet marker**
- Following 76 bytes are COG1 debugger data
- **NO COG2 packet found** (should start with `$02 $00 $00 $00`)

The data shows COG1 packet is split across two chunks:
- First 80 bytes in the 186-byte chunk
- Remaining bytes spill into the 124-byte chunk

### Critical Finding #2: Only ONE Debugger Packet Routed

Console shows:
```
[TWO-TIER] 🎯 Found 2 destinations for DEBUGGER_80BYTE
```

But only ONE packet was actually extracted and routed. The "2 destinations" means two windows registered to receive debugger packets, NOT that two packets were found.

### Critical Finding #3: Debug Logger Shows Only COG1

Debug Logger output confirms:
- Shows all 8 COG text messages ✅
- Shows "Cog 1:" with 80 bytes of data ✅  
- **Missing "Cog 2:" section entirely** ❌

### Problems Identified

#### 1. ❌ CRITICAL: COG2 Debugger Packet Never Extracted
**Evidence**: 
- Raw data shows only COG1 packet at offset 0x78 in 186-byte chunk
- No COG2 packet marker (`$02 $00 $00 $00`) found in any chunk
- MessageExtractor only routes ONE DEBUGGER_80BYTE message
- Debug Logger only displays COG1

**Root Cause**: Either:
- P2 is not sending COG2 packet in this test
- OR packet is being lost in serial reception
- OR MessageExtractor fails to find it

#### 2. ❌ CRITICAL: DTR Hardware Control Broken
**Evidence**:
- User reports DTR button has no effect
- Cannot reset P2 from application
- IPC handlers registered but not functioning

**Root Cause**: IPC communication failure between renderer and main process

#### 3. ❌ CRITICAL: RAM/Flash Buttons Non-Functional
**Evidence**:
- User reports RAM and Flash buttons don't work
- Similar to DTR issue - hardware control failure

**Root Cause**: Same IPC issue affecting all hardware controls

#### 4. ❌ Menu Bar Not Visible
**Evidence**:
- HTML menu should be visible in standalone mode
- User cannot see any menu

**Root Cause**: HTML template or CSS issue

### Test Data Validation

Comparing with `exactHardwareRouting.test.ts`:
- Test has different chunk boundaries (124, 372, 186, 54)
- Test assumes COG2 packet exists at specific offset
- **Real hardware data doesn't match test assumptions**

### Next Steps Priority

1. **Verify P2 is actually sending COG2 packet** - May need different test program
2. **Fix DTR/IPC communication** - Critical for hardware control
3. **Debug MessageExtractor** - Why only extracting one packet
4. **Fix HTML menu display** - UI issue

## Solutions

### For Missing COG2 Packet
**File**: `src/classes/shared/messageExtractor.ts`
**Issue**: Need to verify if COG2 is in stream and why not extracted
**Solution**: 
1. Add detailed logging at packet detection
2. Check if buffer advances correctly after COG1
3. Verify pattern matching for consecutive packets

### For DTR/Hardware Control
**File**: `src/classes/mainWindow.ts`
**Issue**: IPC handlers registered but not receiving messages
**Solution**:
1. Check IPC channel names match between main and renderer
2. Verify webContents.send() is reaching renderer
3. Add IPC message logging to trace communication

### For Menu Display
**File**: `src/templates/mainWindowContent.html`
**Issue**: HTML menu not rendering
**Solution**:
1. Check CSS display properties
2. Verify menu HTML is in template
3. Check for JavaScript errors preventing render

## Implementation Progress
[To be updated as fixes are applied]

## Verification Results  
[To be updated after fixes tested]
