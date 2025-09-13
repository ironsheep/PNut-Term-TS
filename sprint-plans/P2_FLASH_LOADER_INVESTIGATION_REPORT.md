# P2 Flash Loader Mechanism Investigation Report

**Version**: 1.0  
**Date**: 2025-09-11  
**Investigation Focus**: P2 EEPROM Flash Loading Architecture and Compatibility Analysis  

## Executive Summary

The PNut-Term-TS application contains a sophisticated flash loading mechanism that **prepends a flash loader binary** to user programs, enabling automatic EEPROM writing after download. The system works by creating a composite binary: **[Flash Loader] + [User Program] + [Checksums]** that executes in two phases.

## Flash Loading Architecture

### Core Mechanism Overview

**Primary Implementation**: `src/classes/downloader.ts:83-132` (`insertP2FlashLoader` method)

The flash loading system works through **binary composition**:

1. **User selects "Download to Flash"** → `toFlash = true` parameter
2. **Flash loader prepending** → User program moved up in memory 
3. **Composite binary creation** → Flash loader + user program combined
4. **Checksum calculation** → Flasher-specific checksum inserted
5. **Standard P2 download** → Composite binary sent via serial protocol
6. **Two-phase execution** → Flash loader runs first, then user program

### Detailed Technical Flow

#### Phase 1: Binary Composition (Pre-Download)
**File**: `src/classes/downloader.ts:29-31, 83-132`

```typescript
if (writeToFlash) {
  target = 'FLASH';
  binaryImage = await this.insertP2FlashLoader(binaryImage);
  this.logMessage(`-- load image w/flasher = (${binaryImage.length}) bytes`);
}
```

**Flash Loader Insertion Process**:

1. **Load flash loader binary** → `getFlashLoaderBin()` from `flash_loader.obj`
2. **Memory layout preparation**:
   ```
   BEFORE: [User Program Data]
   AFTER:  [Flash Loader][User Program Data]
   ```
3. **Object relocation** → `moveObjectUp()` shifts user program upward
4. **Checksum calculation** → `flasherChecksum()` computes negative sum
5. **Checksum insertion** → Stored at offset `0x04` in flash loader

#### Phase 2: Download Execution (Standard Protocol)
**Files**: `src/classes/mainWindow.ts:4914`, `src/utils/usb.serial.ts`

```typescript
// Flash download uses same protocol as RAM, but with composite binary
await this.downloader.download(filePath, true); // toFlash = true
```

**Download Process**:
- **Same P2 protocol** → Prop_Txt Base64 transmission
- **Larger payload** → Flash loader + user program
- **Same serial communication** → No protocol changes needed

#### Phase 3: P2 Execution Sequence (On-Chip)

**Memory Layout After Download**:
```
P2 Hub RAM Layout:
$00000: [Flash Loader Code]     ← Executes first
$?????: [User Program Data]     ← Payload to write to EEPROM  
```

**Execution Sequence**:
1. **P2 Boot ROM** validates composite binary checksum → Starts execution at $00000
2. **Flash Loader executes** → Reads user program from higher memory addresses
3. **EEPROM writing** → Flash loader writes user program to external EEPROM
4. **Program launch** → Flash loader transfers control to user program

### Flash Loader Binary Analysis

#### Flash Loader Files Located ✅
**Source File**: `/reference/flash_loader.spin2` (299 lines of Spin2 assembly)  
**Binary File**: `/reference/flash_loader.obj` (496 bytes)  
**Current Status**: **Files found but not in expected location**

**Issue**: Files are in `/reference/` but code expects them in `<extensionFolder>/flash_loader.obj`

**Context Discovery**: `src/utils/files.ts:171-184`
```typescript
export function getFlashLoaderBin(ctx: Context): Uint8Array {
  const flashLoaderBinFSPec = extFile('flash_loader.obj', ctx);
  const flashLoaderBuffer = fs.readFileSync(flashLoaderBinFSPec); // Will fail if missing
  return new Uint8Array(flashLoaderBuffer.buffer, flashLoaderBuffer.byteOffset, flashLoaderBuffer.length);
}
```

**Extension Folder Resolution**: `src/utils/context.ts:72-76`
```typescript
possiblePath = path.join(__dirname, '../ext');
if (!fs.existsSync(possiblePath)) {
  possiblePath = path.join(__dirname, 'ext');
}
this.extensionFolder = possiblePath;
```

#### Flash Loader Functionality (from source analysis)

**Primary Purpose**: **SPI Flash EEPROM Programming and Boot Loading**

**Two-Component Architecture**:
1. **Programmer** (lines 37-158) - Writes application to SPI flash
2. **Loader** (lines 227-298) - Boots application from SPI flash on power-up

#### Programmer Component Analysis

**Operation Flow** (executed after download):
1. **Checksum Verification** - Validates downloaded composite binary integrity
2. **SPI Flash Setup** - Configures SPI pins (CS=61, CK=60, DI=59, DO=58)
3. **Block Erasing** - Erases 64KB or 4KB flash blocks as needed
4. **Page Programming** - Writes 256-byte pages sequentially to flash
5. **Application Launch** - Moves app to $00000 and executes with `COGINIT #0,#$00000`

**Flash Performance** (from source comments):
```
Program/Boot Performance (Winbond W25Q128, RCFAST)
Size     | Program Time | Boot Time
---------|--------------|----------
0-2KB    | 30ms         | 10ms
4KB      | 60ms         | 11ms  
16KB     | 170ms        | 20ms
64KB     | 300ms        | 52ms
256KB    | 1.1s         | 184ms
512KB    | 2.2s         | 358ms
```

#### Loader Component Analysis

**Boot Sequence** (executed on power-up):
1. **P2 Boot ROM** reads first 1KB from SPI flash into COG memory
2. **Loader validates** 'Prop' checksum and starts execution
3. **Initial data transfer** - Moves loader data from COG to hub RAM
4. **Remaining data read** - Streams additional app data from SPI flash
5. **Application checksum** - Validates complete application integrity
6. **Application launch** - `COGINIT #0,#$00000` executes user program

**Memory Layout During Boot**:
```
COG Memory:    [Loader Code][Initial App Data]
            ↓ (moves to hub)
Hub Memory:    [Complete Application Data at $00000]
```

#### SPI Flash Hardware Requirements

**Pin Configuration** (hardcoded in source):
- **P61**: SPI Chip Select (CS) 
- **P60**: SPI Clock (CK)
- **P59**: SPI Data Input (DI) - P2 → Flash
- **P58**: SPI Data Output (DO) - Flash → P2

**Compatible Flash Types**:
- **Winbond W25Q series** (explicitly mentioned)
- **Standard SPI Flash** with 256-byte page programming
- **4KB/64KB sector erase** support required

#### Checksum Architecture
**Flash Loader Checksum**: `src/utils/imageUtils.ts:185-192`
```typescript
public flasherChecksum(): number {
  let checkSum: number = 0;
  for (let offset = 0; offset < this.offset; offset += 4) {
    checkSum -= this.readLong(offset); // Negative sum of all longs
  }
  return checkSum;
}
```

**Key Differences from RAM Checksum**:
- **RAM Checksum** → Includes 'Prop' signature: `0x706f7250`
- **Flash Checksum** → Pure negative sum: `0x00000000` starting value
- **Purpose** → Flash loader validates composite binary integrity

### User Interface Integration

#### Download Mode Selection
**File**: `src/classes/mainWindow.ts:104, 4889-4914`

**UI Controls**:
- **RAM Button** → `download-ram` → `downloadToRAM()` → `toFlash = false`
- **Flash Button** → `download-flash` → `downloadToFlash()` → `toFlash = true`  
- **Keyboard Shortcuts** → `Ctrl+R` (RAM), `Ctrl+F` (Flash)

#### Baud Rate Management
**Flash Download Process**:
1. **Switch to download speed** → 2Mbaud for faster transfer
2. **Execute flash download** → Same protocol as RAM
3. **Return to debug speed** → User-configured debug baud rate

## Compatibility Analysis: RAM Binaries → SPI Flash

### Will Normal RAM Binaries Work with Flash Loading?

**Answer: YES, with important hardware requirement**

#### ✅ **Compatible Aspects**

1. **Binary Format Compatibility**
   - **RAM binaries** already have proper P2 program structure
   - **Flash loader** treats user program as opaque data payload
   - **No format conversion** needed for basic programs

2. **Memory Layout Compatibility**
   - **User program** copied to EEPROM exactly as provided
   - **P2 boot sequence** loads from EEPROM to same RAM addresses
   - **Execution behavior** identical to direct RAM download

3. **Program Header Compatibility**
   - **'Prop' signature** preserved in user program section
   - **Program checksum** maintained independently
   - **Size limitations** handled by flash loader

#### ⚠️ **Critical Hardware Requirement**

**SPI Flash Must Be Present**: The flash loader is designed for **SPI Flash memory**, not I2C EEPROM

**Hardware Requirements**:
- **SPI Flash chip** connected to P58-P61 (Winbond W25Q series recommended)
- **Not I2C EEPROM** - completely different interface and protocol
- **Specific pin wiring** required (hardcoded in flash loader)

#### ⚠️ **Other Considerations**

1. **Size Limitations**
   - **SPI Flash capacity** → Typically 1MB-16MB (much larger than EEPROM)
   - **Program size** → Up to 512KB tested (see performance table)
   - **Flash loader overhead** → 496 bytes + alignment

2. **Address Dependencies** 
   - **Absolute addressing** → Programs with fixed memory references work fine
   - **Self-modifying code** → Works normally (loaded to RAM before execution)
   - **Hardware dependencies** → Programs work identically to RAM downloads

3. **Pin Usage Conflict**
   - **P58-P61 reserved** for SPI flash communication
   - **User programs** cannot use these pins for other purposes
   - **Debug communication** unaffected (uses P62-P63)

#### 🔧 **Required Validation & Implementation**

**Critical Implementation Need - Debug Pin Detection**:

The flash loader requires knowing if the binary was compiled with debug support to configure the TX debug pin correctly.

**From flash_loader.spin2 lines 44-45, 117-126**:
```spin2
' If DEBUG, configure the tx pin so that it stays high
t    wrpin    #%01_11110_0,#62-62    '@008: make tx high (NOP'd by compiler if not DEBUG, else fixed with debug_pin_tx)
```

**Currently commented code in `insertP2FlashLoader()`**:
```typescript
/*
const overrideDebugPinTx = await findDebugPinTx();
if (overrideDebugPinTx !== null) {
  debugPinTx = overrideDebugPinTx;
}
*/
const isDebugMode: boolean = toolchainConfiguration.debugEnabled;
if (isDebugMode) {
  // debug is on
  const debugInstru = objImage.readLong(_debugnop_);
  objImage.replaceLong(debugInstru | debugPinTx, _debugnop_);
} else {
  // debug is off
  objImage.replaceLong(_NOP_INSTRU_, _debugnop_);
}
```

**Implementation Requirements**:
1. **Binary analysis** → Detect if .bin file contains debug symbols/code
2. **Debug pin configuration** → Set flash loader debug pin handling
3. **Debug TX pin detection** → Parse binary for custom debug TX pin (if any)

**Before Production Use**:
1. **Copy flash_loader.obj** → Move from `/reference/` to `/ext/` directory  
2. **Debug detection logic** → Implement binary analysis for debug mode
3. **SPI Flash hardware** → Verify P58-P61 connections and chip presence
4. **Size validation** → Check program fits in available flash space
5. **Pin conflict detection** → Warn if user program uses P58-P61

## Implementation Status

### Current State: ⚠️ **Partially Implemented**

| Component | Status | Notes |
|-----------|--------|-------|
| **Flash UI** | ✅ Complete | Flash button, menus, keyboard shortcuts |
| **Binary Composition** | ✅ Complete | `insertP2FlashLoader()` fully implemented |
| **Checksum System** | ✅ Complete | Flash-specific checksum calculation |
| **Download Protocol** | ✅ Complete | Same P2 serial protocol used |
| **Flash Loader Binary** | ❌ Missing | `flash_loader.obj` not in repository |
| **Testing** | ❌ Unknown | No evidence of flash download testing |

### Critical Missing Pieces

1. **Flash Loader Binary Placement** (`flash_loader.obj`)
   - **Size**: 496 bytes (found in `/reference/`)
   - **Function**: P2 assembly code for SPI flash writing and boot loading
   - **Issue**: Needs to be copied to `/ext/` directory for getFlashLoaderBin() to find it

2. **Debug Detection Implementation**
   - **Binary analysis** → Detect debug compilation in .bin files
   - **Debug pin configuration** → Enable/disable debug TX pin in flash loader
   - **Custom pin detection** → Find non-standard debug TX pins in user code

3. **SPI Flash Hardware Validation**
   - **Chip presence** → Detect if SPI flash is connected
   - **Pin availability** → Verify P58-P61 are not used by user program  
   - **Flash capacity** → Ensure sufficient space for user program

4. **Error Handling**
   - **Flash write failures** → Detect and report programming errors
   - **Size overflow** → Program too large for available flash
   - **Hardware missing** → No SPI flash present on board

## Recommendations

### Immediate Actions

1. **Deploy Flash Loader Binary** ⚡ **Quick Fix**
   ```bash
   # Copy flash loader to expected location
   mkdir -p src/ext/
   cp reference/flash_loader.obj src/ext/
   ```

2. **Implement Debug Detection** 🔧 **Medium Priority**
   - **Binary scanning** → Look for debug symbols/patterns in .bin files
   - **Flash loader configuration** → Uncomment debug pin code in `insertP2FlashLoader()`
   - **Debug TX pin detection** → Parse P2 binary for custom debug pins

3. **Test Infrastructure**
   - **Hardware**: P2 board with SPI flash chip (Winbond W25Q series)
   - **Test binaries**: Small RAM programs for SPI flash validation
   - **Error scenarios**: Oversized programs, missing SPI flash

### Development Priority

**High Priority**:
- [ ] Deploy `flash_loader.obj` to `/src/ext/` directory
- [ ] Implement debug mode detection for P2 binaries
- [ ] Test basic SPI flash download functionality  
- [ ] Validate SPI flash hardware requirements (P58-P61)

**Medium Priority**:
- [ ] Size validation before download (prevent flash overflow)
- [ ] SPI flash presence detection
- [ ] Flash download progress indication
- [ ] Pin conflict detection (user code vs SPI flash pins)

**Low Priority**:
- [ ] Multiple SPI flash chip support
- [ ] Custom debug TX pin auto-detection  
- [ ] Advanced flash loader compilation from source
- [ ] Performance optimization for large binaries

## Technical Conclusions

### Flash Loading Architecture: ✅ **Well Designed**

The flash loading system is **architecturally sound**:
- **Clean separation** → Flash loader vs user program
- **Standard protocol** → No P2 communication changes needed
- **Proper checksums** → Data integrity maintained
- **Modular design** → Flash loader can be updated independently

### Compatibility Assessment: ✅ **High Confidence**

Normal RAM binaries should work with flash loading:
- **Binary format** → Compatible with flash loader expectations
- **Execution model** → EEPROM→RAM→Execute identical to RAM direct
- **Memory layout** → No fundamental incompatibilities identified

### Debug Detection Requirement: ⚠️ **Implementation Need**

**You are absolutely correct** - the system needs to detect if debug was compiled into the .bin file:

**Critical Debug Pin Configuration**:
- **Flash loader offset 0x08** → Debug TX pin configuration instruction
- **If debug enabled** → Configure P62 (or custom pin) for debug output
- **If debug disabled** → NOP instruction to skip debug setup

**Implementation Approaches**:
1. **Binary pattern scanning** → Look for debug-specific instruction sequences
2. **Symbol table analysis** → Check for debug symbols in P2 binary format
3. **Size/structure analysis** → Debug binaries often have different characteristics
4. **User specification** → Allow manual override in UI

---

**Status**: Ready for flash loader deployment + debug detection implementation  
**Risk Level**: Low-Medium (architecture solid, needs debug detection logic)  
**Immediate Action**: Copy `flash_loader.obj` from `/reference/` to `/src/ext/`  
**Next Step**: Implement binary analysis for debug mode detection