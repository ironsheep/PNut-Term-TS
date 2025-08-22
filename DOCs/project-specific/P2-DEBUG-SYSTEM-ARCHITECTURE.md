# P2 Debug System Architecture

## Overview
The Propeller 2 debug system is a sophisticated hardware/software debugging solution that enables real-time debugging of multi-cog applications through serial communication.

## System Requirements

### Hardware Requirements
- **Clock**: Minimum 10 MHz clock derived from crystal or external input
  - Cannot use RCFAST or RCSLOW clock sources
- **Serial Communication**: P62 at 2 Mbaud (8-N-1 format) by default
  - Can be redirected to different pin/baud via DEBUG_PIN/DEBUG_BAUD symbols

### Memory Requirements
- **Debugger Program**: Occupies top 16KB of hub RAM
  - Remapped to $FC000..$FFFFF
  - Write-protected
  - Hub RAM at $7C000..$7FFFF becomes unavailable
- **Debug Data**: Stored within debugger image to minimize application impact

## Debug Message Protocol

### Message Format
```
CogN  [content]CR+LF
```
- Always starts with "CogN  " where N is cog number (0-7)
- Two spaces after cog identifier
- Always ends with CR+LF (carriage return + line feed)

### Cog Startup Messages
When a debug-enabled cog starts, it outputs:
- Cog number
- Code address (PTRB register)
- Parameter (PTRA register)
- Mode: 'load' or 'jump'

Example:
```
Cog0  INIT $0000_0000 $0000_0000 load
```

## Implementation Details

### Code Impact
- **Spin2**: Each DEBUG statement adds 3 bytes + variable reference code
- **PASM**: Each DEBUG statement adds 1 long (4 bytes)
- Maximum 255 DEBUG() statements per application (BRK instruction limitation)
- DEBUG statements ignored when not compiling for DEBUG mode

### Resource Allocation
- **LOCK[15]**: Reserved for debugger time-sharing of serial TX/RX pins
- **P63**: Configured in long-repository mode to hold clock frequency value

## Configurable Symbols

| Symbol | Purpose |
|--------|---------|
| DEBUG_COGS | Specify which cogs to debug |
| DEBUG_DELAY | Add delays between debug outputs |
| DEBUG_BAUD | Set debug baud rate (default 2_000_000) |
| DEBUG_PIN | Redirect debug output to different pin |
| DEBUG_TIMESTAMP | Add timestamps to debug messages |
| DEBUG_COGINIT | Auto-start PASM debugger on COGINIT |
| DEBUG_MAIN | Auto-start debugger for main cog |

## Debug Output Capabilities

### Data Formats
- Floating-point
- Decimal (signed/unsigned)
- Hexadecimal
- Binary
- Character strings

### Data Sizes
- Byte
- Word
- Long
- Auto (size determined by value)

### Output Commands
- Standard format: Shows source and value (e.g., `DEBUG(UHEX(x))` outputs `"x = $ABC"`)
- Value-only format: Append "_" to command (e.g., `DEBUG(UHEX_(x))` outputs `"$ABC"`)
- Multiple parameters: `SDEC(x,y,z)` outputs comma-separated values
- String literals: `DEBUG("Message", 13, 13)` for text and control characters

### Advanced Features
- **Conditional Output**: `IF()` and `IFNOT()` commands for gating
- **Rate Limiting**: `DLY(milliseconds)` to slow output (capability ~10,000 msg/sec)
- **Host Input**: `PC_KEY()` and `PC_MOUSE()` to read host keyboard/mouse state
- **PASM Debugger**: Plain `DEBUG` (no parentheses) invokes PASM-level debugger

## Invocation Methods

### PNut
- Hold CTRL before F9..F11 keys

### Propeller Tool
- Enable debug with CTRL+D before F9..F11

### Command Line
```bash
PNut -debug [CommPort] [BaudRate]
# Defaults: CommPort=1, BaudRate=2_000_000
```

## Performance Characteristics
- Message rate capability: ~10,000 messages per second
- Default baud rate: 2 Mbaud
- Serial format: 8-N-1

## Implications for Debug Terminal Implementation

### Critical Requirements
1. **High-speed serial handling**: Must handle 2 Mbaud sustained data rate
2. **Message parsing**: Identify "CogN  " prefix for routing
3. **Multi-cog support**: Route messages to appropriate windows based on cog number
4. **Window commands**: Parse embedded backtick commands within debug messages
5. **Cog state tracking**: Monitor INIT messages for cog starts/resets

### Window Management
- Cog-specific windows must track their assigned cog number
- Window titles should display cog association
- INIT messages indicate cog reset events
- 'load' vs 'jump' mode affects debugger behavior

### Message Flow
1. Serial data arrives at 2 Mbaud on designated port
2. Parse for "CogN  " prefix
3. Route to Debug Logger window (all messages)
4. Parse content for embedded window commands
5. Route to specific debug windows based on commands
6. Handle cog-specific debugger windows separately