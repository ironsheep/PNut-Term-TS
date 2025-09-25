#!/bin/bash
set -e

echo "🎯 Creating Complete Electron Package for macOS"
echo "==============================================="

# Create package directory
PACKAGE_DIR="release/electron-macos-complete"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

echo "📦 Step 1: Creating Electron app structure..."
APP_DIR="$PACKAGE_DIR/PNut-Term-TS.app"
mkdir -p "$APP_DIR/Contents/Resources/app"
mkdir -p "$APP_DIR/Contents/MacOS"

echo "📋 Step 2: Copying application files..."
# Copy all necessary files to Resources/app
cp -r dist "$APP_DIR/Contents/Resources/app/"
cp -r fonts "$APP_DIR/Contents/Resources/app/"
cp -r prebuilds "$APP_DIR/Contents/Resources/app/"
cp -r node_modules "$APP_DIR/Contents/Resources/app/"
cp package.json "$APP_DIR/Contents/Resources/app/"

echo "📝 Step 3: Creating Info.plist..."
cat > "$APP_DIR/Contents/Info.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Electron</string>
    <key>CFBundleIdentifier</key>
    <string>biz.ironsheep.pnut-term-ts</string>
    <key>CFBundleName</key>
    <string>PNut Term TS</string>
    <key>CFBundleDisplayName</key>
    <string>PNut Term TS</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
PLIST_EOF

echo "🔧 Step 4: Creating package.json for Electron..."
cat > "$APP_DIR/Contents/Resources/app/package.json" << 'PACKAGE_EOF'
{
  "name": "pnut-term-ts",
  "version": "0.1.0",
  "main": "dist/pnut-term-ts.min.js",
  "description": "Propeller 2 Debug Terminal",
  "author": "Iron Sheep Productions, LLC",
  "license": "MIT"
}
PACKAGE_EOF

echo "📜 Step 5: Creating SETUP script with caching..."
cat > "$PACKAGE_DIR/SETUP.command" << 'SETUP_EOF'
#!/bin/bash
echo "🚀 PNut-Term-TS macOS Setup"
echo "=========================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect architecture
if [[ $(uname -m) == "arm64" ]]; then
    ARCH="arm64"
else
    ARCH="x64"
fi

ELECTRON_VERSION="33.3.1"
CACHE_DIR="$HOME/.pnut-term-ts-cache"
CACHE_FILE="$CACHE_DIR/electron-v$ELECTRON_VERSION-darwin-$ARCH.zip"

echo "📂 Cache directory: $CACHE_DIR"
mkdir -p "$CACHE_DIR"

# Check cache first
if [ -f "$CACHE_FILE" ]; then
    echo "✅ Using cached Electron framework"
    echo "   Cache: $CACHE_FILE"
    unzip -q "$CACHE_FILE" -d /tmp/electron-temp
elif [ -d "/Applications/Electron.app" ]; then
    echo "📋 Copying Electron framework from /Applications..."
    mkdir -p /tmp/electron-temp
    cp -R /Applications/Electron.app /tmp/electron-temp/
else
    echo "📥 Downloading Electron framework..."
    echo "   Version: $ELECTRON_VERSION"
    echo "   Architecture: $ARCH"
    echo "   This may take a minute..."
    
    ELECTRON_URL="https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-darwin-$ARCH.zip"
    
    # Download to cache
    curl -L "$ELECTRON_URL" -o "$CACHE_FILE"
    
    echo "💾 Cached for future use: $CACHE_FILE"
    
    # Extract from cache
    unzip -q "$CACHE_FILE" -d /tmp/electron-temp
fi

# Copy Electron.app to our app
echo "📦 Integrating Electron framework..."
cp -R /tmp/electron-temp/Electron.app/* "$SCRIPT_DIR/PNut-Term-TS.app/"
rm -rf /tmp/electron-temp

echo "✅ Electron framework integrated"

# Sign the app
echo "🔏 Signing application..."
SIGNING_IDENTITY="Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)"

# Check if Developer ID is available
if security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
    echo "   Using Developer ID: Iron Sheep Productions"
    codesign --force --deep --sign "$SIGNING_IDENTITY" "$SCRIPT_DIR/PNut-Term-TS.app"
else
    echo "   Using ad-hoc signature"
    codesign --force --deep --sign - "$SCRIPT_DIR/PNut-Term-TS.app"
fi

# Create setup completion flag
touch "$SCRIPT_DIR/.has-been-setup"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next step: Double-click LAUNCH.command to start the app"
echo ""
SETUP_EOF
chmod +x "$PACKAGE_DIR/SETUP.command"

echo "🚀 Step 6: Creating LAUNCH script..."
cat > "$PACKAGE_DIR/LAUNCH.command" << 'LAUNCH_EOF'
#!/bin/bash
# Launch PNut-Term-TS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$SCRIPT_DIR/PNut-Term-TS.app"
ELECTRON_EXEC="$APP_PATH/Contents/MacOS/Electron"
APP_DIR="$APP_PATH/Contents/Resources/app"

# Check if app is set up
if [ ! -f "$SCRIPT_DIR/.has-been-setup" ] || [ ! -f "$ELECTRON_EXEC" ]; then
    echo "❌ App not set up yet!"
    echo "   Please run SETUP.command first"
    exit 1
fi

echo "🚀 Launching PNut-Term-TS..."
echo ""
echo "For serial port connection, use:"
echo "   Device argument: -p YOUR_DEVICE"
echo "   Example: -p P9cektn7"
echo ""

# Launch with the app directory as parameter
exec "$ELECTRON_EXEC" "$APP_DIR" "$@"
LAUNCH_EOF
chmod +x "$PACKAGE_DIR/LAUNCH.command"

echo "🔧 Step 7: Creating TEST script..."
cat > "$PACKAGE_DIR/TEST.command" << 'TEST_EOF'
#!/bin/bash
# Test PNut-Term-TS with your P2 device

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$SCRIPT_DIR/PNut-Term-TS.app"
ELECTRON_EXEC="$APP_PATH/Contents/MacOS/Electron"
APP_DIR="$APP_PATH/Contents/Resources/app"

# Check if app is set up
if [ ! -f "$SCRIPT_DIR/.has-been-setup" ] || [ ! -f "$ELECTRON_EXEC" ]; then
    echo "❌ App not set up yet!"
    echo "   Please run SETUP.command first"
    exit 1
fi

echo "🔍 Looking for serial devices..."
echo ""
echo "Available devices:"
ls /dev/tty.usb* 2>/dev/null || echo "   No USB serial devices found"
echo ""

# Try to find a P2 device
P2_DEVICE=$(ls /dev/tty.usbserial-* 2>/dev/null | head -1)

if [ -n "$P2_DEVICE" ]; then
    DEVICE_NAME=$(basename "$P2_DEVICE" | sed 's/tty.usbserial-//')
    echo "✅ Found device: $DEVICE_NAME"
    echo ""
    echo "🚀 Launching with device $DEVICE_NAME..."
    echo "   (Toggle DTR on your P2 to trigger debug messages)"
    echo ""
    exec "$ELECTRON_EXEC" "$APP_DIR" -p "$DEVICE_NAME" --verbose
else
    echo "❌ No P2 device found"
    echo ""
    echo "To test manually, run:"
    echo "   ./LAUNCH.command -p YOUR_DEVICE_NAME"
    echo ""
    echo "Example:"
    echo "   ./LAUNCH.command -p P9cektn7"
fi
TEST_EOF
chmod +x "$PACKAGE_DIR/TEST.command"

echo "💿 Step 8: Creating DMG creation script..."
cat > "$PACKAGE_DIR/CREATE_DMG.command" << 'DMG_EOF'
#!/bin/bash
# Create a DMG for distribution

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if app is set up
if [ ! -f ".has-been-setup" ]; then
    echo "❌ App not set up yet!"
    echo "   Please run SETUP.command first"
    exit 1
fi

echo "💿 Creating DMG for distribution..."
echo ""

# Create temporary DMG folder
DMG_FOLDER="/tmp/PNut-Term-TS-DMG"
rm -rf "$DMG_FOLDER"
mkdir -p "$DMG_FOLDER"

# Copy app to DMG folder
cp -R "PNut-Term-TS.app" "$DMG_FOLDER/"

# Create Applications symlink
ln -s /Applications "$DMG_FOLDER/Applications"

# Create README for DMG
cat > "$DMG_FOLDER/README.txt" << 'README_DMG'
PNut-Term-TS Installation
=========================

1. Drag PNut-Term-TS.app to Applications folder
2. Launch from Applications or Spotlight

For command-line usage:
/Applications/PNut-Term-TS.app/Contents/MacOS/Electron

Version: 0.1.0
README_DMG

# Create the DMG
DMG_NAME="PNut-Term-TS-v0.1.0.dmg"
rm -f "$DMG_NAME"

echo "Creating DMG..."
hdiutil create -volname "PNut-Term-TS" \
    -srcfolder "$DMG_FOLDER" \
    -ov -format UDZO \
    "$DMG_NAME"

# Sign the DMG
echo "🔏 Signing DMG..."
SIGNING_IDENTITY="Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)"

# Check if Developer ID is available
if security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
    echo "   Using Developer ID: Iron Sheep Productions"
    codesign --force --sign "$SIGNING_IDENTITY" "$DMG_NAME"
else
    echo "   Using ad-hoc signature (Developer ID not found)"
    codesign --force --sign - "$DMG_NAME"
fi

# Clean up
rm -rf "$DMG_FOLDER"

echo ""
echo "✅ DMG created: $DMG_NAME"
echo ""
echo "This DMG can be:"
echo "   • Distributed to users"
echo "   • Notarized with Apple (if you have a Developer ID)"
echo "   • Uploaded to your website"
echo ""
DMG_EOF
chmod +x "$PACKAGE_DIR/CREATE_DMG.command"

echo "📖 Step 9: Creating README..."
cat > "$PACKAGE_DIR/README.md" << 'README_EOF'
# PNut-Term-TS Electron Package

## Quick Start

1. **SETUP.command** - Double-click to install Electron framework
2. **LAUNCH.command** - Double-click to launch the app
3. **TEST.command** - Double-click to test with your P2 device

## What This Package Contains

This is a complete Electron application ready to run on macOS. It includes:
- The PNut-Term-TS application
- All necessary dependencies
- Setup and launch scripts

## Setup Process

The SETUP script will:
1. Download or copy the Electron framework
2. Integrate it with the app
3. Sign the app for macOS security

## Testing Task #89

After setup, you can test in three ways:

### Option 1: Use TEST.command
Double-click TEST.command - it will find your P2 device automatically

### Option 2: Use LAUNCH.command with arguments
```bash
./LAUNCH.command -p P9cektn7 --verbose
```

### Option 3: Direct execution
```bash
./PNut-Term-TS.app/Contents/MacOS/Electron PNut-Term-TS.app/Contents/Resources/app -p P9cektn7
```

## Troubleshooting

If macOS blocks the app:
1. Right-click → Open
2. Or go to System Preferences → Security & Privacy → Open Anyway

## Version
0.1.0
README_EOF

echo "📦 Step 10: Creating archive..."
cd release
tar -czf electron-macos-complete.tar.gz electron-macos-complete/
cd ..

# Show final info
echo ""
echo "✅ Complete Electron package created!"
echo ""
echo "📦 Package location: release/electron-macos-complete/"
echo "📦 Archive: release/electron-macos-complete.tar.gz"
echo ""
echo "📋 Package contains:"
echo "   • SETUP.command - Installs Electron framework"
echo "   • LAUNCH.command - Launches the app"
echo "   • TEST.command - Auto-detects P2 and tests"
echo "   • CREATE_DMG.command - Creates DMG for distribution"
echo "   • PNut-Term-TS.app - The application"
echo "   • README.md - Documentation"
echo ""
echo "🎯 User instructions:"
echo "   1. Extract electron-macos-complete.tar.gz"
echo "   2. Double-click SETUP.command"
echo "   3. Double-click TEST.command (or LAUNCH.command)"
echo ""
echo "✅ COMPLETE - Script finished successfully"
sleep 2