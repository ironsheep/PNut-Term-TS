# PNut-Term-TS Complete Design Specification
*Date: 2025-09-03*
*Author: Iron Sheep Productions LLC*

## 1. Menu Structure

### Final Menu Layout (4 Menus)

#### File Menu
- New Recording
- Open Recording... → Opens file picker for .p2rec files
- Save Recording As... → Save current recording to chosen location
- ─────────────────
- Start Recording (Ctrl+R)
- Stop Recording
- Playback Recording (Ctrl+P)
- ─────────────────
- Exit (Ctrl+Q)

#### Edit Menu
- Cut (Ctrl+X)
- Copy (Ctrl+C)
- Paste (Ctrl+V)
- ─────────────────
- Find... (Ctrl+F)
- Clear Terminal
- ─────────────────
- Preferences... (Ctrl+,) → Opens settings dialog

#### Window Menu
- Cascade
- Tile
- ─────────────────
- Show All Windows
- Hide All Windows
- ─────────────────
- Performance Monitor → Shows system performance dialog

#### Help Menu
- Documentation (F1) → Opens GitHub wiki
- ─────────────────
- About PNut-Term-TS → Shows about dialog

### Key Changes from Previous
- **Removed**: Debug menu (debuggers are opened by P2, not application)
- **Moved**: Settings from File to Edit menu (as "Preferences")
- **Moved**: Performance Monitor to Window menu
- **No Connect/Disconnect**: These remain as toolbar buttons

## 2. Dialog Specifications

### 2.1 Preferences Dialog
**Location**: Edit → Preferences  
**Type**: Modal HTML window (600x500)

**Sections**:
- **Terminal**
  - Terminal Mode: PST/ANSI dropdown
  - Color Theme: Green on Black, White on Black, etc.
  - Font Size: 10-24pt
  - Show COG prefixes checkbox
  - Local echo enabled checkbox

- **Serial Port**
  - Control Line: DTR/RTS radio buttons
  - Default Baud: 115200-2000000 dropdown
  - Auto-reconnect checkbox

- **Logging**
  - Log Directory: ./logs/ (project-relative)
  - Auto-save debug output checkbox
  - Create new log on DTR reset checkbox
  - Max Log Size: dropdown (1MB, 10MB, 100MB, unlimited)

### 2.2 Performance Monitor Dialog
**Location**: Window → Performance Monitor  
**Type**: Non-modal window (can stay open)

**Content**:
- **Live Metrics** (moved from status bar)
  - Throughput (kb/s) with sparkline graph
  - Circular Buffer usage (percentage bar)
  - Queue Depth (messages waiting)
  - Status indicator (✓/~/!/⚠/✗)

- **Buffer Details**
  - Buffer Size (KB)
  - Used/Available (KB and %)
  - High Water Mark
  - Overflow Events count

- **Message Routing**
  - Total messages routed
  - Messages per second
  - Recording status and size
  - Parse errors count

- **Active Windows**
  - List of open debug windows
  - Queue depth per window

**Controls**: Auto-refresh checkbox, Clear Stats button, Close button

### 2.3 About Dialog
**Location**: Help → About  
**Type**: Native message box

**Content**:
```
PNut-Term-TS
Version: 0.9.85
Build Date: 2025-09-03

Electron: 31.3.1
Node: 20.15.1
Chrome: 126.0.6478.114

Cross-platform debug terminal for
Parallax Propeller 2 microcontroller

© 2024 Iron Sheep Productions LLC
Licensed under MIT
```

### 2.4 New Recording Dialog
**Type**: Confirmation dialog (if recording active) or info dialog

**Content** (when active recording):
- Warning that current recording will be saved
- Shows message count in current recording
- Options: Cancel, Save & Start New

**Content** (when no recording):
- Shows where recording will be saved
- ./recordings/recording_[timestamp].p2rec
- Options: Cancel, Start

### 2.5 File Dialogs
**Open Recording**: Native file picker
- Default path: ./recordings/
- Filter: P2 Recording Files (*.p2rec)

**Save Recording As**: Native save dialog
- Default path: ./recordings/
- Default name: recording_[timestamp].p2rec
- Filter: P2 Recording Files (*.p2rec)

## 3. Binary Recording System

### 3.1 File Format Specification

**File Extension**: `.p2rec` (P2 Recording)

**Structure**: Sequential binary entries, each with:
```
[4 bytes] Delta time in milliseconds (uint32, little-endian)
[2 bytes] Data length in bytes (uint16, little-endian)
[N bytes] Raw data (exactly as received from serial port)
```

**Example**:
```
00 00 00 00 | 0C 00 | 48 45 4C 4C 4F 20 57 4F 52 4C 44 0A
   (0 ms)    (12 b)   "HELLO WORLD\n"

0F 00 00 00 | 0E 00 | 43 6F 67 30 3A 20 53 74 61 72 74 69 6E 67
   (15 ms)   (14 b)   "Cog0: Starting"
```

### 3.2 Recording Implementation

**Capture Point**: `handleSerialRx()` method
```typescript
interface RecordingEntry {
  deltaMs: number;  // Time since recording start
  data: Buffer;     // Raw bytes from serial
}

class BinaryRecorder {
  private stream: WriteStream;
  private startTime: number;
  
  startRecording(filepath: string) {
    this.stream = fs.createWriteStream(filepath);
    this.startTime = Date.now();
  }
  
  recordData(data: Buffer) {
    const deltaMs = Date.now() - this.startTime;
    const header = Buffer.allocUnsafe(6);
    header.writeUInt32LE(deltaMs, 0);
    header.writeUInt16LE(data.length, 4);
    
    // Write to circular buffer for async write
    this.writeBuffer.push(header);
    this.writeBuffer.push(data);
  }
}
```

### 3.3 Playback Implementation

**Injection Point**: Same as capture - `handleSerialRx()`
```typescript
class BinaryPlayer {
  private entries: RecordingEntry[] = [];
  private currentIndex: number = 0;
  
  async playRecording(filepath: string) {
    this.entries = await this.loadRecording(filepath);
    this.scheduleNext();
  }
  
  private scheduleNext() {
    const entry = this.entries[this.currentIndex];
    setTimeout(() => {
      // Inject as if from serial
      this.handleSerialRx(entry.data);
      this.currentIndex++;
      if (this.currentIndex < this.entries.length) {
        this.scheduleNext();
      }
    }, entry.deltaMs);
  }
}
```

### 3.4 Performance Characteristics

**Recording Overhead**:
- 6 bytes per entry (header)
- No encoding overhead (raw binary)
- Async writes via circular buffer
- Zero impact on serial processing

**File Size Example**:
- 1 hour at 250 messages/sec
- Average message: 50 bytes
- Overhead: 6 bytes/message
- Total: ~50MB for 1 hour

**Playback Accuracy**:
- Millisecond precision timing
- Exact byte sequence reproduction
- System behaves identically to live connection

## 4. Main Window Status Bar Changes

### Current Status Bar
```
Connected [●] | TX [●] | RX [●] | Active COGs | 250kb/s | Buffer: 45% | Queue: 12 | ✓ | Logging [●] | Echo [☑]
```

### New Simplified Status Bar
```
Connected [●] | TX [●] | RX [●] | Active COGs: 1,3,7 | Logging [●] | Echo [☑]
```

**Removed**: Performance metrics (moved to Performance Monitor dialog)
- Throughput (kb/s)
- Buffer usage percentage  
- Queue depth
- Status symbol

**Benefits**:
- Cleaner, less cluttered interface
- Smaller minimum window width
- Performance data available on-demand via Window → Performance Monitor

## 5. Project Structure

### Directory Layout
```
PNut-Term-TS/
├── logs/                    # Debug output logs (text)
│   ├── debug_20250903_143022.txt
│   └── ...
├── recordings/              # Binary recordings (.p2rec)
│   ├── recording_20250903_143022.p2rec
│   └── ...
├── src/
└── ...
```

Both directories are:
- Project-relative (not user home)
- Created automatically if missing
- Portable with project
- Can be .gitignored

## 6. Copyright Updates

All references to "Parallax Inc." should be updated to "Iron Sheep Productions LLC":
- About dialog
- package.json author field
- File headers
- README.md
- LICENSE file (if needed)

## 7. Implementation Priority

### Critical Tasks (in order):
1. Document complete design ✅ (this document)
2. Fix menu content (#268)
3. Update copyright information
4. Move performance metrics to dialog
5. Implement binary recording format
6. Implement binary playback
7. Update recordings folder location
8. Hook up all menu handlers (#269)
9. Check menu visibility (#246)
10. Fix debug logger status line (#245)
11. Build and test

### Future Technical Debt:
- Create .p2rec file dumper utility for human-readable output
- Add hex/ASCII viewer for recordings
- Recording file compression option
- Recording file indexing for fast seeking

## 8. Testing Requirements

### Menu Testing:
- All menu items open correct dialogs
- Keyboard shortcuts work
- Menu styling is consistent

### Recording Testing:
- Binary files created in ./recordings/
- Playback reproduces exact behavior
- No performance impact during recording
- Timing accuracy within 1ms

### Dialog Testing:
- Preferences saves/loads correctly
- Performance Monitor updates live
- File pickers default to correct folders

---

*This design is final and ready for implementation.*