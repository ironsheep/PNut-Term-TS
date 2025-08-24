# Build Clean Script Fix

## Issue Discovered (2025-08-22)

The `npm run clean` script was deleting the `./release` directory, which caused built packages to be wiped out when running tests.

### Problem Sequence
1. Build package with `./scripts/create-electron-ready-package.sh`
2. Run `npm test` to verify system
3. `npm test` triggers `pretest` → `npm run build` → `prebuild` → `npm run clean`
4. **Package gets deleted!**

### Root Cause
The `clean` script was too aggressive:
```json
"clean": "shx rm -rf ./dist ./release ./prebuilds ./fonts"
```

The `/release` directory contains **final build artifacts**, not intermediate build files.

### Solution
Split the clean command into two:
```json
"clean": "shx rm -rf ./dist ./prebuilds ./fonts",        // Regular clean (used by build)
"clean:all": "shx rm -rf ./dist ./release ./prebuilds ./fonts",  // Full clean (manual only)
```

### Impact
- `npm run build` no longer destroys packages
- `npm test` no longer destroys packages  
- Release artifacts are preserved across builds and tests
- Use `npm run clean:all` when you actually want to wipe everything

### Lesson Learned
Release directories should never be part of routine clean operations. They contain valuable outputs that:
- Take significant time to recreate
- Are needed for distribution
- Should survive test runs