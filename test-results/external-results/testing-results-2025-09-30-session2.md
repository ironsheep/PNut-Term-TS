# External Testing Results - Session 2 - September 30, 2025

## Test Session Information
- **Date**: 2025-09-30
- **Session**: 2 (COG routing diagnostics)
- **Purpose**: Testing COG message routing with enhanced debugging
- **Build Version**: 0.5.0 (000500) with diagnostic logging
- **Key Feature**: Added comprehensive COG routing diagnostics

## Test Results - Debug Logger Output

### Timeline Analysis

#### Pre-COG Window Opening (17:17:47 - 17:17:50)
**COG Messages Before Windows Opened:**
```
17:17:47.684327
Cog0 INIT $0000_0000 $0000_0000 load         .684332
Cog0 INIT $0000_0F5C $0000_1F8C jump         .684335
Cog1 INIT $0000_0F5C $0000_188C jump         .684337
Cog2 INIT $0000_0F5C $0000_198C jump         .684339
Cog3 INIT $0000_0F5C $0000_1A8C jump         .684341
Cog4 INIT $0000_0F5C $0000_1B8C jump         .684343
Cog5 INIT $0000_0F5C $0000_1C8C jump         .684344
Cog6 INIT $0000_0F5C $0000_1D8C jump         .684346
Cog7 INIT $0000_0F5C $0000_1E8C jump         .684355

Cog0 All sensors operational                 .684361
Cog1 System running normally                 .684363
Cog2 Status check complete                   .684364
Cog3 System running normally                 .685365
Cog6 Status check complete                   .685366
Cog7 Status check complete                   .685366
```

#### COG Windows Opened Event
```
17:17:50.277882
=== Opening all 8 COG windows - messages after this will route to COG displays ===
```

#### Post-COG Window Opening (17:17:57 onwards)
**COG Messages After Windows Opened:**
```
17:17:57.687982
Cog5 Heartbeat signal active                 .687991
Cog1 Heartbeat signal active                 .688994
Cog2 Processing data stream                  .688996
Cog3 All sensors operational                 .688998
Cog6 Processing data stream                  .688998

17:18:07.686408
Cog5 All sensors operational                 .686417
Cog0 All sensors operational                 .686420
Cog2 System running normally                 .686422
Cog3 Status check complete                   .686424
Cog7 Heartbeat signal active                 .686427
Cog6 Heartbeat signal active                 .686427

17:18:17.686714
Cog4 System running normally                 .686722
Cog5 System running normally                 .686724
Cog0 All sensors operational                 .686726
Cog1 All sensors operational                 .686728
Cog2 Status check complete                   .686729
Cog3 Heartbeat signal active                 .686731
Cog7 System running normally                 .686731
```

## Key Observations

### ✅ Positive Findings
1. **System Message Working**: The "Opening all 8 COG windows" message appears correctly in the debug logger
2. **COG Message Format**: All messages follow the expected `Cog[0-7] [message]` format
3. **Timing Precision**: Sub-millisecond timestamps maintained
4. **All COGs Active**: Messages from all 8 COGs (0-7) observed
5. **Message Variety**: Multiple message types (INIT, status checks, operational states)

### ❓ Critical Questions
1. **Missing Console Debug Output**: We should see `[ROUTER] Extracting COG ID from:` messages in console - are these appearing?
2. **COG Window Status**: Do the individual COG windows show any messages, or are they still gray/empty?
3. **Router Processing**: Are messages reaching the WindowRouter's `extractCOGId` method?

### 🧪 Expected vs Actual Behavior
**Expected**: Messages like `"Cog0 INIT $0000_0000 $0000_0000 load"` should:
1. Trigger router debug: `[ROUTER] Extracting COG ID from: "Cog0 INIT..."`
2. Match pattern: `[ROUTER] Found COG ID 0 using pattern: /^Cog(\d+)\s/i`
3. Route to COG: `[ROUTER->COG0] Routing message to COG 0 window`
4. Arrive at window: `[COG0] Received message: "Cog0 INIT..."`

**Actual**: Need console log output to determine where the routing breaks down.

## Next Steps
1. **Console Log Analysis**: Check console output for router debugging messages
2. **COG Window Inspection**: Verify if messages appear in individual COG windows
3. **Serial Data Flow**: Confirm messages are reaching the WindowRouter

---

## Console Log Analysis

### Application Startup and COG Window Creation
```
$ pnut-term-ts
* Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC.
* Version 0.5.0, Build date: 9/30/2025

* initialize()
* create App Window()
PNut-Term-TS Electron UI started
Pre-validated configuration received from CLI
Connected to device: /dev/tty.usbserial-P9cektn7
```

### WindowRouter and Logger Initialization
```
2025-09-30T23:17:47.241Z [INFO ] STARTUP: WindowRouter initialized
Base: - New logger window: DebugLogger
Base: - Registered with WindowRouter: DebugLogger (logger)
Base: - Window marked as ready for logger
Base: - Transitioning to IMMEDIATE processing (no batching delays)
Base: - Immediate processing active (zero delay)

(node:67022) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 did-stop-loading listeners added to [WebContents]. MaxListeners is 10.

* getFontMetrics() -> (13.328125x11.4765625)
2025-09-30T23:17:47.459Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger)
2025-09-30T23:17:47.467Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1
?Base?: Debug Logger window ready
[UTIL] Log folder already exists at: /Users/stephen/Projects/.../logs/
```

### ✅ COG Window Creation - Our Debugging Working!
```
[COG0] COG window created and initializing
Base: - New COG window: COG-0
[COG1] COG window created and initializing
Base: - New COG window: COG-1
[COG2] COG window created and initializing
Base: - New COG window: COG-2
[COG3] COG window created and initializing
Base: - New COG window: COG-3
[COG4] COG window created and initializing
Base: - New COG window: COG-4
[COG5] COG window created and initializing
Base: - New COG window: COG-5
[COG6] COG window created and initializing
Base: - New COG window: COG-6
[COG7] COG window created and initializing
Base: - New COG window: COG-7
```

### COG Window Registration (All Successful)
```
2025-09-30T23:17:50.277Z [INFO ] REGISTER_INSTANCE: Window instance registered: COG-0 (COG)
2025-09-30T23:17:50.286Z [INFO ] REGISTER: Window registered: COG0 (COG0). Active windows: 2
2025-09-30T23:17:50.287Z [INFO ] REGISTER_INSTANCE: Window instance registered: COG-1 (COG)
2025-09-30T23:17:50.294Z [INFO ] REGISTER: Window registered: COG1 (COG1). Active windows: 3
2025-09-30T23:17:50.294Z [INFO ] REGISTER_INSTANCE: Window instance registered: COG-2 (COG)
2025-09-30T23:17:50.298Z [INFO ] REGISTER: Window registered: COG2 (COG2). Active windows: 4
2025-09-30T23:17:50.302Z [INFO ] REGISTER: Window registered: COG3 (COG3). Active windows: 5
2025-09-30T23:17:50.307Z [INFO ] REGISTER: Window registered: COG4 (COG4). Active windows: 6
2025-09-30T23:17:50.312Z [INFO ] REGISTER: Window registered: COG5 (COG5). Active windows: 7
2025-09-30T23:17:50.316Z [INFO ] REGISTER: Window registered: COG6 (COG6). Active windows: 8
2025-09-30T23:17:50.322Z [INFO ] REGISTER: Window registered: COG7 (COG7). Active windows: 9
```

## 🚨 CRITICAL FINDING: Missing Router Debug Messages

### What We Expected to See (But Didn't):
```
[ROUTER] Extracting COG ID from: "Cog0 INIT $0000_0000 $0000_0000 load"
[ROUTER] Found COG ID 0 using pattern: /^Cog(\d+)\s/i
[ROUTER->COG0] Routing message to COG 0 window
[COG0] Received message: "Cog0 INIT $0000_0000 $0000_0000 load"
```

### What This Means:
1. **✅ COG windows are created and registered properly** - our logging shows all 8 COG windows initialized
2. **✅ WindowRouter is initialized** - router startup logged correctly
3. **❌ No router processing messages** - COG messages never reach the `extractCOGId()` method
4. **❌ No COG message reception** - individual COG windows never receive messages

## Root Cause Analysis

**The problem is upstream from the WindowRouter!** Messages from the debug logger are not being sent to the WindowRouter's `routeMessage()` method at all.

This indicates the issue is in the **message flow from serial data to router**, not in the COG pattern matching or window registration.

**Next Investigation Target**: The connection between serial message reception and WindowRouter message processing.

---

## Final User Observations

**Confirmed Behavior:**
- ✅ **Debug logger successfully logged all COG messages** - messages are being received and displayed properly
- ❌ **No messages routed to individual COG windows** - all 8 COG windows remain empty/gray
- ✅ **COG windows created successfully** - all windows opened but received no content

## Conclusion

**The Issue**: Messages flow correctly from hardware → serial receiver → debug logger, but there's a **missing link** in the pipeline from debug logger → WindowRouter → individual COG windows.

**What Works:**
1. Propeller ID fix (no spurious responses) ✅
2. Serial data reception ✅
3. Debug logger display ✅
4. COG window creation ✅
5. WindowRouter initialization ✅

**What's Broken:**
- Message forwarding from debug logger to WindowRouter ❌
- COG-specific message routing to individual windows ❌

**Root Cause**: The debug logger receives and displays messages but doesn't forward them to the WindowRouter for COG-specific distribution. This is a **missing message forwarding mechanism**, not a pattern matching or window registration issue.

---

**Status**: **ISSUE IDENTIFIED** - Debug logger successfully receives COG messages but fails to forward them to WindowRouter for distribution to individual COG windows. The message pipeline has a missing connection point.

---