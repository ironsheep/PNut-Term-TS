# Packaging Guide for PNut-Term-TS

## Production Build Scripts (Use These!)

### 🎯 All Platforms at Once (RECOMMENDED)
**Command**: `npm run packageAll`
**What it does**: Builds all 6 architecture packages (Windows x64/arm64, Linux x64/arm64, macOS x64/arm64)

### Individual Platform Scripts

#### 🪟 Windows Package
**Script**: `./scripts/create-windows-package.sh`
**Command**: `npm run packageWin`
**Output**: `release/windows-package/` (x64 and arm64 ZIP files)
**Size**: ~100MB per architecture

#### 🐧 Linux Package
**Script**: `./scripts/create-linux-package.sh`
**Command**: `npm run packageLinux`
**Output**: `release/linux-package/` (x64 and arm64 TAR.GZ files)
**Size**: ~100MB per architecture

#### 🍎 macOS Package
**Script**: `./scripts/create-macos-packages.sh`
**Command**: `npm run packageMac`
**Output**: `release/macos-package/` (x64 and arm64 TAR.GZ + DMG files)
**Size**: ~100MB per architecture

## Important Notes

- **ALWAYS** run `npm run build` before packaging
- Each script builds TWO architectures (x64 and arm64)
- All packages are production-ready with proper Electron bundling
- Old/deprecated build scripts have been archived to `scripts/archive-old-builds/`

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