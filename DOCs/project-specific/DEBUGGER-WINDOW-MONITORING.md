# Debugger Window Lifecycle Monitoring

## Overview
Debugger windows don't send explicit "goodbye" messages when closing. We need to monitor traffic patterns to detect window lifecycle events.

## Traffic Pattern During Active Debugging
Once a debugger window is running, there's continuous high-frequency communication:
- **Pattern**: send-receive-send-receive-send-receive (continuous)
- **Content**: PC updates, register values, memory requests/responses
- **Frequency**: Very high (multiple updates per second)
- **Per-COG**: Each COG has its own request/response stream

## Window Lifecycle Detection

### Window Start Detection
**Clear signal**: Receipt of 416-byte debugger packet
- COG ID in first long identifies which window
- Log event: "Cog N → Debugger Window Started"

### Window Stop Detection
**No explicit signal** - Must infer from traffic cessation
- Each COG needs its own activity timer
- Timer resets on any traffic for that COG
- Timeout triggers "window stopped" event

### Proposed Timer Strategy
```
For each active COG debugger:
  - Start timer when window opens
  - Reset timer on any message for that COG
  - If timer exceeds threshold (e.g., 500ms):
    - Log: "Cog N ← Debugger Window Stopped (timeout)"
    - Mark window as inactive
    - Clean up resources
```

## Debug Logger Display Options

### Option 1: Event-Only Logging
```
Cog1 → Debugger Window Started
Cog2 → Debugger Window Started
[High-frequency traffic not shown]
Cog1 ← Debugger Window Stopped (timeout)
```

### Option 2: Event + Summary Status
```
Cog1 → Debugger Window (PC: $0000_0F5C, Status: RUNNING)
Cog2 → Debugger Window (PC: $0000_1A34, Status: BREAK)
[Traffic: COG1 250 msg/s, COG2 180 msg/s]
```

### Option 3: Event + Abbreviated Data (Current Consideration)
```
Cog 1 → Debugger Window:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $85224000   $FF010000 $00000000
  020: $00000000 $00000000
  ...
```

## Key Decisions Needed

1. **What to log at window start?**
   - Just the event?
   - Event + key status values?
   - Event + partial hex dump?
   - Event + full 40-byte status block?

2. **What to log during active debugging?**
   - Nothing (too high frequency)?
   - Periodic summaries (e.g., every 1 second)?
   - Traffic rate indicators?
   - Key state changes only?

3. **How to detect window stop?**
   - Timeout value (100ms? 500ms? 1s?)
   - Different timeouts for different states (RUNNING vs BREAK)?
   - Grace period for slow communication?

4. **Display format considerations:**
   - The 40-byte status block may not be useful for P2 developers
   - Need more "decoration" around messages for clarity
   - Arrow notation (→) is nice but may need more context
   - Balance between useful info and log clutter

## Implementation Notes

- Each COG needs independent monitoring
- Timers must be efficient (high-frequency resets)
- Consider using a single interval timer checking all COGs
- Must handle overlapping windows gracefully
- Clean shutdown vs timeout detection

## Related Considerations

### High-Frequency DV Messages
Similar challenge with Data Visualization messages:
- Very high frequency
- Large data volume
- Need smart truncation/summarization
- Maybe show rate + samples rather than all data

### Performance Impact
- Logging must not slow down communication
- Timer overhead must be minimal
- Consider batching log updates
- Maybe separate "verbose" and "summary" modes

## Next Steps

1. Finalize display format for debugger start events
2. Implement COG-specific activity timers
3. Test timeout detection reliability
4. Design similar approach for DV messages
5. Consider user preferences for verbosity levels