# Window-Specific Routing Requirements

Documentation of how each debug window type integrates with the WindowRouter message routing system.

## Overview

All debug windows in the P2 Debug Terminal system register with the centralized WindowRouter singleton to receive messages. Each window type has specific routing requirements based on the message format and content it expects.

## Window Types and Message Routing

### 1. Terminal Window (`terminal`)

**Window ID Pattern**: `terminal-{instance}`  
**Message Types**: Text (non-DEBUG)  
**Routing Logic**:
- Receives all text messages that don't start with "DEBUG "
- Default recipient for general P2 output
- Multiple terminal windows receive the same messages

**Message Format**:
```
Regular text output from P2
```

**Registration**:
```typescript
router.registerWindow('terminal-1', 'terminal', handler);
```

### 2. Scope Window (`scope`)

**Window ID Pattern**: `scope-{instance}`  
**Message Types**: Text (DEBUG SCOPE)  
**Routing Logic**:
- Receives messages starting with "DEBUG SCOPE "
- Case-insensitive matching
- All scope windows receive the same DEBUG SCOPE messages

**Message Format**:
```
DEBUG SCOPE <channel_data> <trigger_settings> <samples>
```

**Registration**:
```typescript
router.registerWindow('scope-1', 'scope', handler);
```

### 3. Logic Analyzer Window (`logic`)

**Window ID Pattern**: `logic-{instance}`  
**Message Types**: Text (DEBUG LOGIC)  
**Routing Logic**:
- Receives messages starting with "DEBUG LOGIC "
- Supports packed binary data within text messages
- Multiple logic windows can display different channel groups

**Message Format**:
```
DEBUG LOGIC <channel_bits> [packed_data]
```

**Registration**:
```typescript
router.registerWindow('logic-1', 'logic', handler);
```

### 4. Plot Window (`plot`)

**Window ID Pattern**: `plot-{instance}`  
**Message Types**: Text (DEBUG PLOT)  
**Routing Logic**:
- Receives messages starting with "DEBUG PLOT "
- Handles coordinate data and drawing commands
- Supports double-buffering with UPDATE commands

**Message Format**:
```
DEBUG PLOT <command> <parameters>
Commands: DOT, LINE, CIRCLE, BOX, TEXT, UPDATE, CLEAR
```

**Registration**:
```typescript
router.registerWindow('plot-1', 'plot', handler);
```

### 5. MIDI Window (`midi`)

**Window ID Pattern**: `midi-{instance}`  
**Message Types**: Text (DEBUG MIDI)  
**Routing Logic**:
- Receives messages starting with "DEBUG MIDI "
- Parses MIDI message bytes
- Filters by MIDI channel if configured

**Message Format**:
```
DEBUG MIDI <status_byte> <data1> [data2]
```

**Registration**:
```typescript
router.registerWindow('midi-1', 'midi', handler);
```

### 6. Bitmap Window (`bitmap`)

**Window ID Pattern**: `bitmap-{instance}`  
**Message Types**: Text (DEBUG BITMAP)  
**Routing Logic**:
- Receives messages starting with "DEBUG BITMAP "
- Handles pixel data with various trace patterns
- Supports sparse mode for efficient updates

**Message Format**:
```
DEBUG BITMAP <pixel_data> [trace_pattern]
```

**Registration**:
```typescript
router.registerWindow('bitmap-1', 'bitmap', handler);
```

### 7. FFT Window (`fft`)

**Window ID Pattern**: `fft-{instance}`  
**Message Types**: Text (DEBUG FFT)  
**Routing Logic**:
- Receives messages starting with "DEBUG FFT "
- Processes frequency domain data
- Handles window functions and scaling

**Message Format**:
```
DEBUG FFT <magnitude_data> [phase_data]
```

**Registration**:
```typescript
router.registerWindow('fft-1', 'fft', handler);
```

### 8. Scope XY Window (`scopexy`)

**Window ID Pattern**: `scopexy-{instance}`  
**Message Types**: Text (DEBUG SCOPEXY)  
**Routing Logic**:
- Receives messages starting with "DEBUG SCOPEXY "
- Processes X,Y coordinate pairs
- Handles continuous trace rendering

**Message Format**:
```
DEBUG SCOPEXY <x_value> <y_value>
```

**Registration**:
```typescript
router.registerWindow('scopexy-1', 'scopexy', handler);
```

### 9. Debugger Window (`debugger`)

**Window ID Pattern**: `debugger-{cogId}` where cogId is 0-7  
**Message Types**: Binary  
**Routing Logic**:
- **SPECIAL**: Uses binary protocol, not text DEBUG commands
- COG ID extracted from lower 3 bits of first byte
- Each COG has its own debugger window
- 20-long binary message format

**Message Format**:
```
Binary: Uint8Array with COG ID in bits 0-2 of first byte
[COG_ID | FLAGS] [DATA...] (80 bytes total for initial message)
```

**Registration**:
```typescript
// COG-specific registration
router.registerWindow('debugger-0', 'debugger', handler); // COG 0
router.registerWindow('debugger-1', 'debugger', handler); // COG 1
// ... up to debugger-7 for COG 7
```

## Message Routing Flow

### Text Message Routing

1. **Message Received**: Serial data arrives as text
2. **DEBUG Detection**: Router checks if message starts with "DEBUG "
3. **Window Type Extraction**: If DEBUG, extract window type (second word)
4. **Route to Windows**: Send to all windows of matching type
5. **Default Routing**: Non-DEBUG text goes to terminal windows

### Binary Message Routing

1. **Message Received**: Serial data arrives as binary (Uint8Array)
2. **COG ID Extraction**: Extract COG ID from bits 0-2 of first byte
3. **Window ID Construction**: Create window ID as `debugger-{cogId}`
4. **Direct Routing**: Route to specific debugger window for that COG

## Registration Lifecycle

### Window Creation
```typescript
// 1. Window creates and initializes
const window = new DebugScopeWindow(context);

// 2. Window registers with router (usually in ready-to-show event)
this.registerWithRouter();  // Calls router.registerWindow()

// 3. Window starts receiving messages via handler
```

### Window Destruction
```typescript
// 1. Window close initiated
window.closeDebugWindow();

// 2. Base class unregisters from router
this.unregisterFromRouter();  // Calls router.unregisterWindow()

// 3. Window no longer receives messages
```

## Multi-Window Support

### Same Type Windows
- Multiple windows of the same type all receive the same DEBUG messages
- Example: Three scope windows all get DEBUG SCOPE messages
- Useful for different views of the same data

### Different Type Windows
- Each window type only receives its specific messages
- No cross-talk between different window types
- Terminal is special - gets all non-DEBUG text

### COG-Specific Windows (Debugger)
- Each debugger window is tied to a specific COG (0-7)
- Binary messages routed based on COG ID in message
- Supports debugging multiple COGs simultaneously

## Performance Requirements

### Routing Performance
- Message routing must complete in < 1ms
- No blocking operations during routing
- Handlers called synchronously but should not block

### Buffer Management
- Router handles message buffering for recording
- Windows should process messages quickly
- Long-running operations should be deferred

## Recording and Playback

### Recording Requirements
- All routed messages are recorded if recording is active
- Window ID and type stored with each message
- Binary messages Base64-encoded for JSON storage

### Playback Requirements
- Messages replayed to same window IDs if available
- If window doesn't exist, message is skipped (headless mode)
- Timing preserved based on playback speed multiplier

## Error Handling

### Missing Windows
- Messages for non-existent windows are dropped silently
- "Unhandled message" event emitted for monitoring
- No error thrown to prevent disrupting other windows

### Invalid Messages
- Malformed DEBUG commands treated as terminal text
- Binary messages with invalid structure logged but not routed
- Router continues operation despite individual message errors

## Testing Requirements

Each window type should have tests verifying:
1. Correct registration with WindowRouter
2. Proper message reception via handler
3. Unregistration on window close
4. No regression in existing functionality
5. Recording/playback compatibility

## Implementation Checklist

For each window type:
- ✅ Extends DebugWindowBase
- ✅ Calls `registerWithRouter()` when ready
- ✅ Implements message handler for `updateContent()`
- ✅ Properly unregisters via base class on close
- ✅ Has unique window ID pattern
- ✅ Documented message format
- ✅ Tested with WindowRouter integration

## Special Considerations

### Terminal Window
- Default recipient for non-DEBUG text
- Should always have at least one instance
- Handles echo filtering based on settings

### Debugger Window
- Only window type using binary protocol
- COG-based routing is unique
- Supports up to 8 concurrent instances (COGs 0-7)

### High-Frequency Windows
- Scope, Logic, FFT may receive high-frequency updates
- Should implement buffering or throttling if needed
- Consider using requestAnimationFrame for rendering

This document ensures consistent integration of all window types with the WindowRouter architecture while maintaining their specific requirements and behaviors.