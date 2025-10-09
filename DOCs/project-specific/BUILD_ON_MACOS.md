# Build Instructions for macOS Electron App

## What This Creates
A full Electron application with:
- ✅ GUI windows (MainWindow, Debug windows)
- ✅ Window placement system for Task #89
- ✅ Proper serialport support
- ✅ Professional .app bundle

## Prerequisites on macOS
```bash
# Install Node.js if not present
brew install node

# Install required tools
npm install -g electron-builder
```

## Build Steps

1. **In your macOS terminal, navigate to this folder:**
```bash
cd /path/to/PNut-Term-TS
```

2. **Build the Electron app:**
```bash
# Full build with packaging
npm run packageMac

# Or step by step:
npm run build           # Build TypeScript
npm run build:mac       # Build Electron app
```

3. **Sign the app (optional but recommended):**
```bash
codesign --force --sign "Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)" \
    release/mac/PNut-Term-TS.app
```

4. **Test the app:**
```bash
# Run directly
./release/mac/PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS --help

# With P2 device
./release/mac/PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS -p P9cektn7 --verbose
```

5. **Install to Applications:**
```bash
cp -r release/mac/PNut-Term-TS.app /Applications/
```

## Expected Output
- App location: `release/mac/PNut-Term-TS.app`
- DMG (if created): `release/PNut-Term-TS-0.1.0.dmg`

## Testing Task #89
With the Electron app running:
1. Connect to P2: `-p YOUR_DEVICE`
2. Send debug commands that trigger windows
3. Verify window placement (no overlaps)
4. Test both explicit POS and auto-placement
5. Verify heads-up console pattern works

## Troubleshooting

If build fails:
```bash
# Clean and retry
npm run clean
npm install
npm run packageMac
```

If signing fails:
```bash
# Use ad-hoc signature
codesign --force --sign - release/mac/PNut-Term-TS.app
```

## Architecture
The app flow is:
1. CLI startup (parse args, detect ports)
2. Electron app.whenReady()
3. MainWindow created
4. Debug windows created as needed
5. WindowPlacer manages positioning

This gives you the full GUI experience needed for Task #89!