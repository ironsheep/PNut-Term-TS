# Debugger Stub Response Strategy

## The Problem
- P2 uses lock #15 to serialize COG debugger communications
- Each COG blocks waiting for host response before releasing the lock
- Without a response, only the first COG (COG1) can transmit
- Other COGs spin forever waiting for lock #15

## The Stub Solution
Instead of implementing the full 75-byte response protocol immediately, we send a minimal **52-byte zero stub**:

```
00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00
00 00 00 00
```

## What This Accomplishes
1. **Releases Lock #15** - The P2 receives a response and releases the lock
2. **"I don't need anything"** - Zeros tell the debugger no additional data is requested
3. **Allows Next COG** - The next COG can now acquire lock #15 and transmit
4. **Validates Protocol** - Proves the lock/response mechanism works

## Expected Flow with Stub

**Important**: Each debugger task runs ONCE then goes dormant after sending a final ASCII message.

```
COG0/1: Running test program (no debugger packets)
COG2: Running debugger task #1 (one-shot)
COG3: Running debugger task #2 (one-shot)
```

### Possible Message Ordering (depends on lock acquisition timing):

**Scenario A - COG2 gets lock first:**
1. COG2 acquires lock #15
2. COG2 sends 416-byte packet (ID: 0x02)
3. Host sends 52 zero bytes
4. COG2 releases lock #15
5. COG2 sends final ASCII message "COG2 debugger done" (or similar)
6. COG2 goes dormant
7. COG3 acquires lock #15
8. COG3 sends 416-byte packet (ID: 0x03)
9. Host sends 52 zero bytes
10. COG3 releases lock #15
11. COG3 sends final ASCII message "COG3 debugger done"
12. COG3 goes dormant

**Scenario B - Interleaved (more interesting!):**
1. COG2 sends 416-byte packet
2. Host sends 52 zeros
3. COG2 releases lock, COG3 immediately acquires
4. COG3 sends 416-byte packet (while COG2 is sending ASCII)
5. We might see COG2's ASCII mixed with COG3's packet!
6. Host sends 52 zeros for COG3
7. COG3 sends its final ASCII message

The exact ordering depends on:
- Who wins the race for lock #15
- When ASCII messages are sent relative to lock release
- Serial port buffering and timing

## Why 52 Bytes?
The minimal response that satisfies the P2 debugger protocol:
- Enough to indicate "response received"
- All zeros = no hub read requests, no break commands
- Allows debugger to continue running

## Future Enhancement
Once the stub proves the concept works, the real debugger windows will send the full 75-byte response with:
- Checksum bits for changed data
- Hub memory read requests
- Break/continue commands

But for now, the stub lets us see ALL COG packets and validate the entire communication flow!