# CRITICAL: P2 Debugger Protocol - Response Required!

## 🚨 BLOCKING DISCOVERY
**The P2 debugger uses lock #15 to serialize COG communications. Each COG blocks waiting for host response before releasing the lock!**

## The Blocking Mechanism

### P2 Side (Spin2 Code)
```spin
.wait    locktry #15    wc    'wait for lock[15] so that we own the save buffer and tx/rx pins
if_nc    jmp    #.wait
' ... send 416-byte packet ...
' ... WAIT FOR HOST RESPONSE ...
lockrel #15    'release lock[15] so other cogs can own the save buffer and tx/rx pins
```

### What This Means
1. **Lock #15** controls access to serial TX/RX pins
2. Only ONE COG can communicate at a time
3. COG must receive response before releasing lock
4. Other COGs **busy-wait** spinning on the lock

## The Complete Protocol Flow

### Current (Broken) Behavior
```
1. COG1 acquires lock #15
2. COG1 sends 416-byte packet
3. COG1 waits for response from host
4. [NO RESPONSE FROM US]
5. COG1 holds lock forever
6. COG2 spins forever trying to acquire lock #15
7. Result: Only COG1 packet visible, COG2 never sends
```

### Required (Working) Behavior
```
1. COG1 acquires lock #15
2. COG1 sends 416-byte packet
3. Host receives packet
4. Host sends response:
   - Checksum data (32 bytes)
   - Hub read requests (5 longs = 20 bytes)
   - Break/stall command (1 long = 4 bytes)
   Total: ~56 bytes response
5. COG1 receives response
6. COG1 releases lock #15
7. COG2 acquires lock #15
8. COG2 sends 416-byte packet
9. Repeat...
```

## Response Packet Structure (from Pascal)

### 1. COG Checksum Bits (16 bytes)
```pascal
for i := 0 to 127 do
  if CogBlock[i] <> CogBlockOld[i] then h := h or $80;
  if i and 7 = 7 then TByte(h);  // Send byte every 8 bits
```

### 2. Hub Checksum Bits (31 bytes)
```pascal
for i := 0 to 247 do
  if HubBlock[i] <> HubBlockOld[i] then h := h or $80;
  if i and 7 = 7 then TByte(h);  // Send byte every 8 bits
```

### 3. Hub Read Requests (20 bytes = 5 longs)
```pascal
TLong(DisLines shl 2 shl 20 + CurDisAddr);      // Disassembly request
TLong(PtrBytes shl 20 + (FPTR - PtrCenter));    // FPTR window
TLong(PtrBytes shl 20 + (PTRA - PtrCenter));    // PTRA window
TLong(PtrBytes shl 20 + (PTRB - PtrCenter));    // PTRB window
TLong(HubSubBlockSize shl 20 + CurHubAddr);     // Hub memory window
```

### 4. COGBRK Request (4 bytes)
```pascal
TLong(RequestCOGBRK);  // Usually 0
```

### 5. Break/Stall Command (4 bytes)
```pascal
TLong(StallCmd);   // Or BreakValue depending on state
```

## Total Response Size
- COG checksums: 16 bytes
- Hub checksums: 31 bytes
- Hub requests: 20 bytes
- COGBRK: 4 bytes
- Command: 4 bytes
- **TOTAL: 75 bytes**

## Implementation Priority
**CRITICAL**: Without implementing this response protocol, we will NEVER see COG2+ packets!

## Testing Notes
- Must respond quickly (P2 is waiting)
- Response must be exact format
- Little-endian for longs
- Response enables next COG to send