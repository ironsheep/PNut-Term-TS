# PropPlug Management - Theory of Operations

## Overview

This document describes the design for PropPlug device management in PNut-Term-TS, enabling per-device settings, persistent device history, and project-level device selection.

## Problem Statement

### Current Issues

1. **No device history** - Each launch requires fresh device selection
2. **Global DTR/RTS setting** - Single setting applies to all devices, but different PropPlugs require different control lines:
   - Parallax PropPlugs → DTR
   - Standard FTDI adapters → Usually DTR
   - Chinese clones → Often RTS
3. **No project association** - Cannot specify "this project uses device X"
4. **Missing UI** - Messages reference "File > Select PropPlug" menu that doesn't exist
5. **No device labels** - Users with multiple PropPlugs can't distinguish them easily

## Data Model

### PropPlugEntry

```typescript
interface PropPlugEntry {
  serialNumber: string;       // Unique identifier (e.g., "P9cektn7")
  vendorId: number;           // USB VID (0x0403 for FTDI)
  productId: number;          // USB PID (0x6015 for PropPlug)
  friendlyName: string;       // User-assigned label (e.g., "Workbench Plug")
  controlLine: 'DTR' | 'RTS'; // Per-device reset control line
  lastSeen: string;           // ISO timestamp of last enumeration
  lastUsed: string;           // ISO timestamp of last connection
}
```

### Storage Hierarchy

| Level | File Location | Contents |
|-------|---------------|----------|
| **User Global** | `~/.pnut-term-ts/settings.json` | Master list of all known PropPlugs |
| **Project Local** | `./.pnut-term-ts/settings.json` | Selected PropPlug serial number |

### Example User Global Settings

```json
{
  "knownPropPlugs": [
    {
      "serialNumber": "P9cektn7",
      "vendorId": 1027,
      "productId": 24597,
      "friendlyName": "Workbench PropPlug",
      "controlLine": "DTR",
      "lastSeen": "2025-11-19T10:30:00Z",
      "lastUsed": "2025-11-19T10:30:00Z"
    },
    {
      "serialNumber": "FT232R_A",
      "vendorId": 1027,
      "productId": 24577,
      "friendlyName": "Chinese Clone #1",
      "controlLine": "RTS",
      "lastSeen": "2025-11-18T14:00:00Z",
      "lastUsed": "2025-11-15T09:00:00Z"
    }
  ],
  "defaultControlLine": "DTR",
  "debugBaudrate": 2000000
}
```

### Example Project Local Settings

```json
{
  "selectedPropPlug": "P9cektn7",
  "debugBaudrate": 115200
}
```

## Lifecycle Flow

### 1. Device Enumeration

```
Application Start
       ↓
Enumerate USB devices (VID 0x0403)
       ↓
For each device found:
  - Extract serial number, VID, PID
  - Check if in master list
       ↓
  ┌─ Known device ──────────────┐
  │  Update lastSeen timestamp  │
  └─────────────────────────────┘
       ↓
  ┌─ Unknown device ────────────────────────┐
  │  Add to master list with:               │
  │  - Default controlLine based on PID     │
  │  - Empty friendlyName                   │
  │  - Current timestamp for lastSeen       │
  └─────────────────────────────────────────┘
```

### 2. Device Selection

```
Check selection sources (in priority order):
       ↓
1. CLI argument (-p)
   └─ Match against enumerated devices
       ↓
2. Project setting (selectedPropPlug)
   └─ Match serial number against enumerated devices
       ↓
3. Auto-detect (single device)
   └─ Use the only available device
       ↓
4. No selection
   └─ Prompt user via UI or exit with guidance
```

### 3. Settings Application

```
Device selected (serial number known)
       ↓
Look up in master list
       ↓
Extract device-specific settings:
  - controlLine (DTR/RTS)
  - friendlyName (for display)
       ↓
Apply to runtime context:
  context.runEnvironment.controlLine = entry.controlLine
       ↓
Serial connection uses correct control line
```

### 4. Runtime Usage

```
Serial port operations use:
  - context.runEnvironment.selectedPropPlug (device path)
  - context.runEnvironment.controlLine (DTR/RTS)
       ↓
Reset operations trigger correct line:
  if (controlLine === 'DTR') toggleDTR()
  else toggleRTS()
       ↓
Update lastUsed timestamp in master list
```

## User Interface

### Preferences Dialog - PropPlug Management Tab

**Purpose**: View and edit the master list of known PropPlugs

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ PropPlug Management                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Known Devices:                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Serial       │ Name           │ Control │ Last Used │ │
│ ├──────────────┼────────────────┼─────────┼───────────┤ │
│ │ P9cektn7     │ Workbench Plug │ DTR     │ Today     │ │
│ │ FT232R_A     │ Clone #1       │ RTS     │ 3 days    │ │
│ │ P8abc123     │ (unnamed)      │ DTR     │ 1 week    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Selected Device Settings:                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Friendly Name: [Workbench Plug____________]         │ │
│ │ Control Line:  (•) DTR  ( ) RTS                     │ │
│ │                                                     │ │
│ │ Device Info:                                        │ │
│ │   Serial: P9cektn7                                  │ │
│ │   VID: 0x0403  PID: 0x6015                          │ │
│ │   Last seen: 2025-11-19 10:30                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Delete Device]                    [Apply] [Cancel]      │
└─────────────────────────────────────────────────────────┘
```

**Functionality**:
- Select device from list to edit
- Change friendly name
- Toggle DTR/RTS control line
- Delete stale devices
- Read-only display of VID/PID/serial

### Preferences Dialog - Project Settings Tab

**Purpose**: Select which PropPlug this project uses

**Layout** (addition to existing Project tab):
```
┌─────────────────────────────────────────────────────────┐
│ Project Settings                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ PropPlug Selection:                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [▼ Workbench Plug (P9cektn7)                      ] │ │
│ └─────────────────────────────────────────────────────┘ │
│   ○ Auto-detect (use any available)                     │
│   ● Use selected device                                  │
│                                                          │
│ Debug Baud Rate: [2000000_____]                          │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
```

**Dropdown Contents**:
- Shows friendly name + serial number in parentheses
- Lists all known devices from master list
- Grayed out if device not currently connected

### File Menu Addition

**New menu item**: File > Select PropPlug

```
File
├── New Recording
├── Open Recording...
├── Save Recording As...
├── ─────────────────
├── Select PropPlug          → [Submenu of available devices]
│   ├── ✓ Workbench Plug (P9cektn7)
│   ├──   Clone #1 (FT232R_A)
│   └── ─────────────────
│       Manage Devices...    → Opens Preferences to PropPlug tab
├── ─────────────────
├── Start Recording
├── Stop Recording
├── Playback Recording
├── ─────────────────
└── Exit
```

**Behavior**:
- Shows currently connected devices
- Checkmark on currently selected device
- Selecting switches connection immediately
- "Manage Devices..." opens Preferences dialog

## Default Control Line Logic

When a new device is discovered, assign default controlLine based on PID:

| Product ID | Default | Rationale |
|------------|---------|-----------|
| 0x6015 | DTR | Parallax PropPlug |
| 0x6001 | DTR | Standard FT232R |
| 0x6010 | DTR | FT2232 |
| 0x6011 | DTR | FT4232 |
| 0x6014 | DTR | FT232H |
| Other | DTR | Conservative default |

Users can override in Preferences if their specific device needs RTS.

## CLI Behavior Changes

### -p Flag with Device Not Found

**Current**: Silently proceeds to UI
**New**: Error and exit (already implemented in v0.9.4)

```
$ pnut-term-ts -p BADSERIAL
Error: Device "BADSERIAL" not found
Available devices:
  /dev/ttyUSB0 (P9cektn7)
  /dev/ttyUSB1 (FT232R_A)
```

### -p Flag with Device Found

1. Match device by serial number substring
2. Look up in master list
3. Apply device-specific controlLine
4. Proceed with connection

### No -p Flag

1. Check project settings for selectedPropPlug
2. If found and device connected → use it
3. If not found or device not connected:
   - Single device → auto-select
   - Multiple devices → prompt in UI
   - No devices → show guidance

## Implementation Components

### 1. Data Layer (context.ts)

```typescript
// New methods on Context class
getKnownPropPlugs(): PropPlugEntry[]
getKnownPropPlug(serialNumber: string): PropPlugEntry | undefined
addKnownPropPlug(entry: PropPlugEntry): void
updateKnownPropPlug(serialNumber: string, updates: Partial<PropPlugEntry>): void
deleteKnownPropPlug(serialNumber: string): void
```

### 2. CLI Layer (pnut-term-ts.ts)

- During enumeration: Update master list with seen devices
- After selection: Look up and apply device settings
- Pass controlLine through context to Electron

### 3. Electron Main (electron-main.ts)

- Receive controlLine in context
- Pass to MainWindow

### 4. MainWindow (mainWindow.ts)

- Use context.runEnvironment.controlLine for reset operations
- Implement File > Select PropPlug menu
- Handle device switching

### 5. Preferences Dialog (preferencesDialog.ts)

- Add PropPlug Management tab
- Add PropPlug dropdown to Project Settings tab
- IPC handlers for CRUD operations on master list

### 6. Serial Layer (usb.serial.ts, dtrResetManager.ts)

- Use passed controlLine setting
- No longer read from global preferences

## Migration

### Existing Users

- First launch after update: Master list will be empty
- Connected devices added automatically on enumeration
- Previous global DTR/RTS setting ignored (devices default to DTR)
- User reconfigures per-device as needed (one-time)

### Settings File Compatibility

- New fields added to existing settings structure
- Old settings files remain valid
- Missing knownPropPlugs field treated as empty array

## Testing Strategy

### Unit Tests

1. PropPlugEntry CRUD operations
2. Default controlLine assignment by PID
3. Device lookup by serial number
4. Settings persistence and loading

### Integration Tests

1. CLI -p flag with device lookup
2. Project setting selection
3. Control line application to serial connection
4. UI list population and editing

### Manual Tests

1. Multi-device switching
2. DTR vs RTS reset behavior
3. Preferences dialog UX
4. Menu functionality

## Summary

This design provides:

1. **Per-device settings** - Each PropPlug remembers its DTR/RTS preference
2. **Persistent history** - Known devices saved across sessions
3. **Project association** - Projects can specify their target device
4. **Intuitive UI** - Management in Preferences, quick-switch in File menu
5. **Automatic discovery** - New devices added with sensible defaults
6. **Backward compatibility** - Works with existing settings files

The implementation follows the existing preferences hierarchy pattern and integrates naturally with the current architecture.
