# Build System Documentation

This document details the PNut-Term-TS build pipeline and configuration.

## Build Pipeline Overview

The build process consists of four main stages:

```
TypeScript → esbuild → Build Date → Terser
   (tsc)    (bundle)  (insert)   (minify)
```

## Build Stages

### 1. TypeScript Compilation (`tsc`)

**Config**: `tsconfig.json`
- **Target**: ES2020
- **Module**: CommonJS  
- **Source**: `./src` → **Output**: `./dist`
- **Strict Mode**: Enabled
- **Source Maps**: Generated

**Key Commands**:
```bash
tsc              # Full compilation
tsc --noEmit     # Type check only
tsc --watch      # Watch mode
```

### 2. esbuild Bundling

**Config**: `esbuild.config.js`
- Bundles all dependencies into single file
- Handles Node.js built-in modules
- Preserves serialport native bindings
- External dependencies marked appropriately

**Process**:
- Entry: `dist/pnut-term-ts.js`
- Output: `dist/pnut-term-ts.js` (overwritten)
- Platform: Node.js
- Format: CommonJS

### 3. Build Date Insertion

**Script**: `scripts/insertBuildDate.js`
- Injects build timestamp into bundle
- Used for version identification
- Format: ISO 8601 timestamp
- Location: Embedded in output JS

### 4. Terser Minification

**Config**: `terser.config.json`
- Compresses and mangles code
- Preserves necessary identifiers
- Output: `dist/pnut-term-ts.min.js`
- Reduces file size ~60-70%

## Configuration Files

### package.json Scripts

**Primary build commands**:
```json
{
  "build": "tsc && npm run build:esbuild && node scripts/insertBuildDate.js && npm run minify",
  "build:esbuild": "node esbuild.config.js",
  "minify": "terser dist/pnut-term-ts.js -c -m -o dist/pnut-term-ts.min.js"
}
```

**Pre/Post hooks**:
- `prebuild`: Cleans artifacts, copies prebuilds and fonts
- `postbuild`: Makes output files executable

### Platform-Specific Packaging

**Electron Builder** (`electron.builder.json`):
- Windows: NSIS installer
- macOS: DMG with code signing
- Linux: AppImage and zip

**Commands**:
```bash
npm run packageWin   # Windows build
npm run packageMac   # macOS build (includes notarization)
npm run packageLnx   # Linux build
```

## Build Dependencies

### Required Directories
- `prebuilds/` - Native serialport binaries
- `fonts/` - Parallax.ttf font file
- `buildSupport/` - Platform-specific configs

### Key Dependencies
- **typescript**: Compilation
- **esbuild**: Fast bundling
- **terser**: Minification
- **electron-builder**: Packaging
- **shx**: Cross-platform shell commands

## Build Optimization

### Development Builds
```bash
# Fast build for testing
tsc && node dist/pnut-term-ts.js

# Type check only
tsc --noEmit
```

### Production Builds
```bash
# Full optimized build
npm run build

# Platform package
npm run package[Win|Mac|Lnx]
```

### Build Performance
- TypeScript: ~5-10 seconds
- esbuild: <1 second
- Terser: ~2-3 seconds
- Total: ~10-15 seconds

## Troubleshooting

### Common Issues

**TypeScript errors**:
```bash
# Check for type errors
tsc --noEmit

# See all errors
tsc --noEmit --listFiles
```

**Missing prebuilds**:
```bash
# Regenerate prebuilds
npm run makeprebuild
```

**Build artifacts**:
```bash
# Clean everything
npm run clean
```

### Debug Build Process

**Verbose TypeScript**:
```bash
tsc --listEmittedFiles
```

**Check esbuild output**:
```bash
node esbuild.config.js --analyze
```

## CI/CD Integration

### GitHub Actions
- Windows: `.github/workflows/build-win.yml`
- macOS: `.github/workflows/build-macos.yml`
- Automated signing and notarization
- Artifact uploads

### Local CI Testing
```bash
# Simulate CI build
npm run clean && npm run build && npm test
```

## Build Artifacts

### Output Structure
```
dist/
├── pnut-term-ts.js        # Compiled TypeScript
├── pnut-term-ts.js.map    # Source map
└── pnut-term-ts.min.js    # Final executable

release/
├── pnut-term-ts-{version}-{platform}.{ext}
└── ... (platform packages)
```

### Binary Distribution
- Includes prebuilt serialport binaries
- Self-contained executables
- No runtime dependencies required