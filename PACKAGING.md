# Packaging Guide for PNut-Term-TS

## Working Packaging Methods

### 🎯 Electron-Ready Package (RECOMMENDED)
**Script**: `./scripts/create-electron-ready-package.sh`
**Output**: `release/electron-ready-macos/` and `release/electron-ready-macos.tar.gz`
**What it does**: Creates a package with everything except Electron runtime, which gets installed on target Mac
**Why it works**: Avoids DMG creation issues and signing complications in container environment

### ✅ Standalone Package  
**Script**: `npm run packageStandaloneMacOS` or `./scripts/create-standalone-package.sh`
**Output**: `release/standalone-macos/`
**What it does**: Creates a fully self-contained executable using Node.js SEA (Single Executable Application)
**Status**: Works but needs signing on macOS

### ⚠️ Native SEA Package
**Script**: `./scripts/create-native-sea-package.sh`
**Output**: Native executable
**Status**: Experimental, may have issues with native modules

## Broken/Problematic Methods

### ❌ Electron Builder DMG (npm run packageMac)
**Issue**: Missing `dmg-license` module in container
**Error**: `Cannot find module 'dmg-license'`
**Why**: DMG creation requires macOS-specific tools not available in Linux container

### ❌ Cross-Platform Package
**Script**: `./scripts/create-cross-platform-sea.sh`  
**Issue**: Complex cross-compilation in container environment

## Build Prerequisites

Always run before packaging:
```bash
npm run build
```

This creates:
- `dist/pnut-term-ts.js` - Full build
- `dist/pnut-term-ts.min.js` - Minified version

## Quick Commands

```bash
# For testing with P2 hardware (BEST OPTION):
./scripts/create-electron-ready-package.sh

# For standalone executable:
npm run packageStandaloneMacOS

# Basic build only:
npm run build
```

## Container Limitations

Running in a Linux container (GitHub Codespaces/Docker) means:
- Cannot create macOS DMG files
- Cannot sign macOS applications  
- Cannot use macOS-specific packaging tools
- Cross-compilation has limitations

## Solution

The `create-electron-ready-package.sh` script works around these limitations by:
1. Creating proper macOS app structure
2. Deferring Electron installation to target Mac
3. Avoiding DMG creation
4. Providing setup scripts for target machine

## Notes

- The electron-ready package is ~5MB (vs ~200MB with Electron bundled)
- Electron gets cached on target Mac after first install
- No system pollution - Electron installs locally in app directory
- Works across different macOS versions (Intel and Apple Silicon)

## Testing Workflow

1. Make code changes
2. Run `npm run build`
3. Run `./scripts/create-electron-ready-package.sh`
4. Copy `release/electron-ready-macos.tar.gz` to Mac
5. Extract and run `SETUP.command`
6. Test with P2 hardware

---
Last Updated: 2025-08-13
Sprint 1 Completion