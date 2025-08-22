# DTR/RTS Control Line Documentation

## Critical Understanding

DTR and RTS are **functionally equivalent** reset/sync control lines in the P2 ecosystem. They are **mutually exclusive** - each device uses one OR the other, never both simultaneously.

## Device Types and Their Control Lines

| Device Type | Control Line | Notes |
|------------|--------------|-------|
| Parallax Prop Plug (vendor) | **DTR** | Official standard, always DTR |
| FTDI USB-to-serial (non-vendor) | **DTR** | Usually DTR, but configurable |
| Chinese FTDI clones | **RTS** | Often require RTS instead of DTR |

## Why Both Exist

- **DTR** is the Parallax standard for official Prop Plugs
- **RTS** support exists because many clone devices wire RTS for reset instead
- Users may have either type of device, so we must support both

## Current Implementation

### Parser Synchronization
Both DTR and RTS resets should:
1. Clear the debug log
2. Synchronize the debugger message parser
3. Log which control line was used
4. Create visual separation in debug output

### UI Simplification Strategy

**Problem**: Showing both DTR and RTS controls is confusing when only one works

**Solution**: Adaptive UI that shows only the active control

```
Default State:
  [x] DTR  (Parallax standard)

After RTS configuration:
  [x] RTS  (Device requires RTS)
```

## Configuration Hierarchy

1. **Global Default**: `settings.defaultControlLine: 'DTR' | 'RTS'`
   - "All my devices use DTR" (default)
   - "All my devices use RTS"

2. **Per-Device Override**: `deviceSettings[deviceId].controlLine: 'DTR' | 'RTS'`
   - Remembered per USB device ID
   - Overrides global setting

3. **Runtime Detection**: When possible, auto-detect based on device response

## Code Locations

- **DTR Handler**: `mainWindow.ts` - `toggleDTR()`
- **RTS Handler**: `mainWindow.ts` - `toggleRTS()` 
- **Parser Sync**: `debuggerMessageParser.ts` - `onDTRReset()` and `onRTSReset()`
- **UI Controls**: HTML generation in `mainWindow.ts`
- **Settings**: Settings dialog in `mainWindow.ts`

## Log Message Examples

```
[DTR RESET] Device reset via DTR at 14:30:00.123
--- Debug log cleared, parser synchronized ---

[RTS RESET] Device reset via RTS at 14:30:00.123  
--- Debug log cleared, parser synchronized ---
```

## Implementation TODOs

- [ ] Add `onRTSReset()` method to DebuggerMessageParser
- [ ] Update UI to show only active control line
- [ ] Add control line preference to settings
- [ ] Store per-device control line preferences
- [ ] Update log messages to indicate DTR vs RTS
- [ ] Test with both DTR and RTS devices

## Testing Scenarios

1. **Parallax Prop Plug**: Should use DTR, work immediately
2. **FTDI Device**: Try DTR first, allow RTS switch if needed
3. **Clone Device**: May need RTS, settings should persist
4. **Device Switching**: UI should adapt when switching between DTR/RTS devices