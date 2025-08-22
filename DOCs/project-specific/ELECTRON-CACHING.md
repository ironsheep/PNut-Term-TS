# Electron Framework Caching

## Overview

To speed up packaging builds, we've implemented Electron framework caching that avoids re-downloading the ~150MB Electron framework for each build.

## Cache Location

The cache is stored in the user's home directory:
```
~/.pnut-term-ts-cache/
```

This location is:
- Outside the project directory (survives `rm -rf release/`)
- Not tracked by git
- Persistent across builds
- User-specific (each developer has their own cache)

## How It Works

1. **First Build**: Downloads Electron framework and saves to cache
2. **Subsequent Builds**: Uses cached framework (saves ~1-2 minutes per build)
3. **Architecture-aware**: Caches separately for ARM64 and x64

## Cache Structure

```
~/.pnut-term-ts-cache/
├── electron-v33.3.1-darwin-arm64.zip  # Apple Silicon Macs
└── electron-v33.3.1-darwin-x64.zip    # Intel Macs
```

## Scripts Updated

Both packaging scripts now use caching:
- `scripts/create-electron-ready-package.sh`
- `scripts/create-electron-package-complete.sh`

## SETUP.command Behavior

The SETUP script in packaged releases checks in order:
1. **Cache** - Uses if found (fastest)
2. **/Applications/Electron.app** - Copies if present
3. **Download** - Falls back to download, saves to cache

## Manual Cache Management

```bash
# View cache
ls -la ~/.pnut-term-ts-cache/

# Clear cache (forces re-download)
rm -rf ~/.pnut-term-ts-cache/

# Check cache size
du -sh ~/.pnut-term-ts-cache/
```

## Benefits

- **Speed**: ~2 minutes faster per build after first download
- **Bandwidth**: Saves ~150MB download per build
- **Reliability**: Cached copy always available
- **Developer Experience**: Faster iteration cycles

## Version Updates

When updating Electron version:
1. Change `ELECTRON_VERSION` in scripts
2. Cache will automatically download new version
3. Old versions remain cached (manual cleanup if desired)