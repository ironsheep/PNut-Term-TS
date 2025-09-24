# Distribution Preparation Plan: `pnut-term-ts` Executable Naming

**Status**: READY FOR IMPLEMENTATION
**Created**: 2025-01-21
**Updated**: 2025-01-22
**Objective**: Standardize executable name as `pnut-term-ts` across all platforms with command-line access

## Executive Summary

Currently, the application runs with different executable names on different platforms (Electron, PNut-Term-TS.exe, etc.). This plan outlines the steps to standardize the executable name as `pnut-term-ts` across macOS, Windows, and Linux for consistent user experience, documentation, and **mandatory command-line access**.

## Current State Analysis

| Platform | Current Executable Name | Desired Name | Command-Line Access |
|----------|------------------------|--------------|-------------------|
| macOS App Bundle | `Electron` | `pnut-term-ts` | Required |
| Windows | `PNut-Term-TS.exe` | `pnut-term-ts.exe` | Required |
| Linux | `PNut-Term-TS` | `pnut-term-ts` | Required |
| npm global | `pnut-term-ts` ✓ | `pnut-term-ts` | Built-in |

## Requirements

- ✅ Command-line access is **MANDATORY**
- ✅ Users will add containing folder to PATH
- ✅ Must work with tools like VSCode
- ✅ DMG drag-and-drop installation for macOS
- ❌ No backward compatibility needed (unreleased)
- ❌ No package manager support (except possibly npm)

## Critical Requirements

1. **Script as Entry Point**: The TypeScript/JavaScript script (`pnut-term-ts.min.js`) must be the first thing executed, NOT the Electron binary directly
2. **Working Directory Preservation**: The script must always know the directory from which it was launched (`process.cwd()`)
3. **Command-Line Arguments**: All arguments must be passed through to the script for parsing
4. **Consistent Command**: Users type `pnut-term-ts` on all platforms

## Solution: Launcher Scripts

After evaluating multiple approaches (symlinks, native binaries, package.json configuration), **launcher scripts are the chosen solution** for all platforms.

### Why Launcher Scripts?

1. **Industry Standard**: Used by VSCode (`code`), Discord, Slack, and other major Electron apps
2. **Simplicity**: 3-line scripts that are easy to understand, debug, and maintain
3. **Reliability**: No magic or complex mechanisms - just "execute this with these arguments"
4. **Cross-platform**: Same pattern works on macOS, Windows, and Linux
5. **Preserves Context**: Working directory and all arguments passed through perfectly
6. **No Dependencies**: Uses built-in shell/batch commands only

### How It Works

```
User types: pnut-term-ts [arguments]
     ↓
Launcher script executes
     ↓
Calls: Electron path/to/pnut-term-ts.min.js [arguments]
     ↓
Your script handles everything (CLI parsing, Electron launch, etc.)
```

## Implementation Strategy

### macOS Approach

1. **Directory Structure**:
   ```
   PNut-Term-TS.app/                # App bundle for drag-and-drop
   ├── Contents/
   │   ├── MacOS/
   │   │   └── Electron            # Electron runtime only
   │   ├── Info.plist              # CFBundleExecutable = "Electron"
   │   ├── Frameworks/             # Bundled Electron framework
   │   └── Resources/
   │       ├── app/
   │       │   └── dist/
   │       │       └── pnut-term-ts.min.js  # YOUR SCRIPT (entry point)
   │       └── bin/                # Command-line tools directory
   │           └── pnut-term-ts    # Launcher script (clearer location)
   ```

2. **Command-Line Launcher Script** (`Contents/Resources/bin/pnut-term-ts`):
   ```bash
   #!/bin/bash
   # Get the app bundle root (go up from Resources/bin to get to Contents)
   DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
   # Run Electron with YOUR script as the entry point
   exec "$DIR/MacOS/Electron" "$DIR/Resources/app/dist/pnut-term-ts.min.js" "$@"
   ```

3. **PATH Setup for Users**:
   After dragging to Applications, users add to their PATH:
   ```bash
   export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:$PATH"
   ```

4. **Key Points**:
   - Launcher script in dedicated `Resources/bin/` directory (less confusing)
   - Follows pattern used by VSCode and other Electron apps
   - Clear separation: MacOS/ for runtime, Resources/bin/ for CLI tools
   - Clean installation - just drag .app to Applications
   - Working directory preserved (user's launch location)
   - All user arguments passed through

### Windows Approach

1. **Directory Structure** (installed to Program Files):
   ```
   C:\Program Files\pnut-term-ts\
   ├── electron.exe                # Electron runtime (unchanged)
   ├── resources/
   │   └── app/
   │       └── dist/
   │           └── pnut-term-ts.min.js  # YOUR SCRIPT (entry point)
   ├── pnut-term-ts.cmd            # Batch file launcher (CONFIRMED APPROACH)
   └── [other DLLs and electron files...]
   ```

2. **Command-Line Launcher** (`pnut-term-ts.cmd`):
   ```batch
   @echo off
   set DIR=%~dp0
   "%DIR%electron.exe" "%DIR%resources\app\dist\pnut-term-ts.min.js" %*
   ```

3. **PATH Setup for Users**:
   ```batch
   set PATH=%PATH%;C:\Program Files\pnut-term-ts
   ```

4. **Key Points**:
   - Standard Windows approach for Electron apps
   - `.cmd` launcher ensures your script runs first
   - User types `pnut-term-ts` from any location
   - Working directory preserved (`%cd%`)
   - All command-line arguments passed through
   - Consistent with macOS/Linux launcher pattern

### Linux Approach

1. **Directory Structure** (installed to `/opt`):
   ```
   /opt/pnut-term-ts/               # Standard third-party app location
   ├── electron                     # Electron runtime
   ├── resources/
   │   └── app/
   │       └── dist/
   │           └── pnut-term-ts.min.js  # YOUR SCRIPT (entry point)
   ├── bin/                         # Command-line tools directory
   │   └── pnut-term-ts            # Launcher script
   └── [other electron files...]
   ```

2. **Command-Line Launcher** (`/opt/pnut-term-ts/bin/pnut-term-ts`):
   ```bash
   #!/bin/bash
   # Get the installation root (go up from bin/ to get to /opt/pnut-term-ts)
   DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
   exec "$DIR/electron" "$DIR/resources/app/dist/pnut-term-ts.min.js" "$@"
   ```

3. **PATH Setup for Users**:
   ```bash
   export PATH="/opt/pnut-term-ts/bin:$PATH"
   ```

4. **Key Points**:
   - Follows Linux FHS (Filesystem Hierarchy Standard)
   - `/opt` is standard for third-party applications
   - Clean `bin/` directory for command-line tools
   - Consistent with macOS approach (dedicated bin directory)
   - Working directory and arguments preserved

## Implementation Phases

### Phase 1: macOS Implementation
**Priority**: CRITICAL
**Timeline**: Immediate

#### Tasks:
1. Modify `create-electron-ready-package.sh`:
   - [ ] Add executable renaming logic after Electron copy
   - [ ] Update Info.plist generation with correct CFBundleExecutable
   - [ ] Create launcher script for command-line access
   - [ ] Test command-line execution
   - [ ] Test VSCode integration

2. Update packaging documentation:
   - [ ] Document PATH setup instructions
   - [ ] Add command-line usage examples

### Phase 2: Windows Implementation
**Priority**: HIGH
**Timeline**: After macOS

#### Tasks:
1. Update Windows build scripts:
   - [ ] Configure executable naming
   - [ ] Test command prompt access
   - [ ] Test PowerShell access
   - [ ] Verify PATH integration

### Phase 3: Linux Implementation
**Priority**: HIGH
**Timeline**: After Windows

#### Tasks:
1. Update Linux build scripts:
   - [ ] Set executable name
   - [ ] Ensure proper permissions
   - [ ] Test terminal access
   - [ ] Verify PATH integration

### Phase 4: npm Package (Optional)
**Priority**: LOW
**Timeline**: TBD

- Already configured with correct name
- Decision pending on npm release

## Testing Matrix

After implementation, verify:

| Test | macOS | Windows | Linux |
|------|-------|---------|-------|
| Command-line execution | `pnut-term-ts` | `pnut-term-ts.exe` | `pnut-term-ts` |
| PATH integration | ✓ | ✓ | ✓ |
| VSCode terminal launch | ✓ | ✓ | ✓ |
| Drag-and-drop install | DMG | Installer | AppImage |
| Code signing | ✓ Required | Optional | N/A |

## Detailed Implementation Steps

### macOS Implementation

1. **Modify `create-electron-ready-package.sh`** to create launcher in Resources/bin:
   ```bash
   # Create bin directory for command-line tools
   mkdir -p "$APP_DIR/Contents/Resources/bin"

   # Create launcher script in the bin directory
   cat > "$APP_DIR/Contents/Resources/bin/pnut-term-ts" << 'EOF'
   #!/bin/bash
   DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
   exec "$DIR/MacOS/Electron" "$DIR/Resources/app/dist/pnut-term-ts.min.js" "$@"
   EOF
   chmod +x "$APP_DIR/Contents/Resources/bin/pnut-term-ts"
   ```

2. **DMG Creation**:
   - Contains only the .app bundle (launcher is inside Resources/bin/)
   - User instructions:
     - "Drag PNut-Term-TS.app to Applications"
     - "Add to PATH: `/Applications/PNut-Term-TS.app/Contents/Resources/bin`"

### Windows Implementation

1. **Create batch launcher** (`pnut-term-ts.cmd`):
   ```batch
   @echo off
   set DIR=%~dp0
   "%DIR%electron.exe" "%DIR%resources\app\dist\pnut-term-ts.min.js" %*
   ```

2. **Package contents**:
   - Include electron.exe and all dependencies
   - Include launcher script
   - User adds folder to PATH

### Linux Implementation

1. **Installation structure**:
   ```bash
   # Package installs to /opt/pnut-term-ts/
   mkdir -p /opt/pnut-term-ts/bin

   # Create launcher in bin directory
   cat > /opt/pnut-term-ts/bin/pnut-term-ts << 'EOF'
   #!/bin/bash
   DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
   exec "$DIR/electron" "$DIR/resources/app/dist/pnut-term-ts.min.js" "$@"
   EOF
   chmod +x /opt/pnut-term-ts/bin/pnut-term-ts
   ```

2. **Package/installer behavior**:
   - Installs complete application to `/opt/pnut-term-ts/`
   - Creates `bin/` subdirectory with launcher script
   - Sets proper permissions
   - User instructions: Add `/opt/pnut-term-ts/bin` to PATH

## Final Platform Summary

| Platform | Install Location | Launcher Type | PATH Addition |
|----------|-----------------|---------------|---------------|
| **macOS** | `/Applications/PNut-Term-TS.app` | Shell script in `Resources/bin/` | `/Applications/PNut-Term-TS.app/Contents/Resources/bin` |
| **Windows** | `C:\Program Files\pnut-term-ts\` | `.cmd` batch file | `C:\Program Files\pnut-term-ts` |
| **Linux** | `/opt/pnut-term-ts/` | Shell script in `bin/` | `/opt/pnut-term-ts/bin` |

## Success Criteria

1. ✅ Single command `pnut-term-ts` works on all platforms
2. ✅ Works when folder is added to PATH
3. ✅ VSCode and other tools can launch it
4. ✅ Your TypeScript script is always the entry point
5. ✅ Working directory context preserved
6. ✅ All command-line arguments passed through
7. ✅ No separate Electron download needed

## Timeline

**Estimated Duration**: 1-2 days

1. **Day 1**: macOS implementation and testing
2. **Day 2**: Windows/Linux implementation if needed

## Next Steps

1. ✅ Plan approved with requirements clarified
2. Ready to begin implementation
3. Start with macOS (Phase 1)
4. Test command-line execution thoroughly

## Implementation Questions Resolved

✅ **Q: Do we need to rename Electron?**
A: No, Electron keeps its standard name on all platforms

✅ **Q: Is launcher script the best approach?**
A: Yes, it's the industry standard, simplest, and most reliable solution

✅ **Q: How does working directory get preserved?**
A: Launcher scripts don't change directory, so `process.cwd()` returns user's location

✅ **Q: What about command-line arguments?**
A: All passed through via `"$@"` (Unix) or `%*` (Windows)

---

**Document Status**: FINALIZED - Ready for Implementation