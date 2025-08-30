# Hardware Test Analysis - 2025-08-30

## Executive Summary
DTR functionality is now working correctly, but message routing after DTR reset is broken. Only COG1 packet visible in data stream.

## Key Findings

### ✅ WORKING
1. **DTR Reset Mechanism**
   - DTR button triggers hardware reset successfully
   - P2 device responds to DTR signal
   - Debug Logger clears and shows "DTR Reset - New session started"
   - Serial data resumes after DTR release

2. **Initial Message Routing**
   - COG0 messages route correctly to Debug Logger
   - COG1 debugger packet detected and displayed
   - Message classification working for initial data

### ❌ NOT WORKING
1. **Post-DTR Message Routing**
   - After DTR reset, NO messages reach Debug Logger
   - 651 bytes received but not processed
   - Message extraction/routing pipeline broken after reset

2. **COG2 Packet Missing**
   - Only COG1 packet visible (starts with $01 $00 $00 $00)
   - No COG2 packet in 651 bytes of data
   - Could be:
     - P2 not sending COG2
     - Timing issue preventing capture
     - Extraction failing to find it

3. **DTR Multiple Fire Issue** (Minor)
   - Single button press triggers 4 DTR events
   - Sequences 1-4 logged
   - Likely UI event handling issue

## Data Analysis

### Packet Structure Found
```
Position 0-185:   COG messages (text)
Position 186-265: COG1 debugger packet (80 bytes) + partial data
Position 266-433: Continuation (168 bytes)
Position 434-619: Zeros (186 bytes)
Position 620-650: More zeros (31 bytes)
Total: 651 bytes
```

### COG1 Packet Identified
```
Offset 194 in received data:
$01 $00 $00 $00  [COG ID = 1]
$01 $00 $00 $00  
$0E $00 $A1 $03
...
```

### Expected vs Actual
- **Expected**: 416-byte packets for each COG
- **Actual**: Only 80 bytes extracted, rest appears as separate data chunks
- **Missing**: COG2 packet entirely

## Timing Analysis
```
Initial receive:  2163064337268µs
DTR press events: (not timestamped)
After DTR release:
  - 2163303791648µs: 186 bytes (239.45ms gap)
  - 2163303793469µs: 248 bytes (1.82ms gap)
  - 2163303794577µs: 186 bytes (1.11ms gap)  
  - 2163303810174µs: 31 bytes (15.60ms gap)
```

No 10ms gap between packets visible - all gaps are either ~1-2ms or ~15ms.

## Root Cause Hypotheses

### 1. Message Router State After DTR
- Router might not reinitialize properly after DTR reset
- SerialMessageProcessor receives data but doesn't process it
- Evidence: "SerialMessageProcessor.receiveData(): X bytes, running: true" but no routing logs

### 2. MessageExtractor Buffer State
- Buffer might not clear properly after DTR
- Extraction patterns might be disrupted by reset
- Only extracting first 80 bytes instead of full 416

### 3. P2 Not Sending COG2
- Hardware might only activate COG1 debugger
- COG2 debugger window might not be running
- Need logic analyzer to confirm

## Next Steps

1. **Immediate**: Wait for logic analyzer results
2. **Fix Message Routing**: Debug why messages don't route after DTR
3. **Fix Extraction**: Update to handle 416-byte packets
4. **Verify COG2**: Confirm if P2 sends both packets

## Test Environment
- Date: 2025-08-30
- Build: Electron package with microsecond timestamps
- Device: Parallax Propeller 2
- Test Program: Debug demo with COG0 and COG1 active