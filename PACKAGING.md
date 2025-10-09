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
# All platforms (dual architecture):
npm run packageAll

# Individual platforms (each builds x64 + arm64):
npm run packageWin        # Windows
npm run packageLinux      # Linux
npm run packageMac        # macOS

# Basic build only:
npm run build
```

## Container Limitations

Running in a Linux container (GitHub Codespaces/Docker) means:
- Cannot create macOS DMG files (DMG creation requires macOS)
- Cannot sign macOS applications (code signing requires macOS + certificates)
- Cannot use macOS-specific packaging tools
- Cross-compilation has limitations

## Current Solution

All packaging scripts create **dual-architecture** packages (x64 + arm64):
- Packages are production-ready with Electron bundled
- Each package is ~100MB per architecture
- Works across Intel and Apple Silicon Macs
- TAR.GZ format for easy distribution

## Testing Workflow

1. Make code changes
2. Run `npm run build`
3. Run appropriate package command (`npm run packageWin`, `packageLinux`, or `packageMac`)
4. Copy generated package from `release/` directory to target machine
5. Extract and run
6. Test with P2 hardware

---
Last Updated: 2025-10-09
Updated to reflect dual-architecture packaging as current standard