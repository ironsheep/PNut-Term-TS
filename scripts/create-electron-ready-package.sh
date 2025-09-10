#!/bin/bash
set -e

echo "🎯 Creating Electron-Ready Package for macOS"
echo "==========================================="

# Set up cache directory for Electron frameworks
CACHE_DIR="tasks/electron-cache"
mkdir -p "$CACHE_DIR"

# Create package directory
PACKAGE_DIR="release/electron-ready-macos"
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

echo "📜 Step 5: Creating setup script with caching..."
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

# Default Electron version (tested and known to work)
DEFAULT_ELECTRON_VERSION="33.3.1"

# Check if we have a cached version preference
CACHE_DIR="$HOME/.pnut-term-ts-cache"
PREFERRED_VERSION_FILE="$CACHE_DIR/preferred-version.txt"

# Read preferred version if it exists
PREFERRED_VERSION=""
if [ -f "$PREFERRED_VERSION_FILE" ]; then
    PREFERRED_VERSION=$(cat "$PREFERRED_VERSION_FILE")
    echo "   Found preferred version: v$PREFERRED_VERSION"
fi

# Check latest version from npm registry
echo "🔍 Checking for Electron updates..."
LATEST_VERSION=$(curl -s https://registry.npmjs.org/electron/latest | grep -o '"version":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

# Decide which version to use
if [ -n "$PREFERRED_VERSION" ]; then
    # Use the cached preference
    ELECTRON_VERSION="$PREFERRED_VERSION"
    echo "   Using preferred: v$ELECTRON_VERSION"
    
    # Optionally check if there's a newer version available
    if [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "$PREFERRED_VERSION" ]; then
        echo "   ℹ️  Note: Newer version v$LATEST_VERSION is available"
        echo "   To update, delete $PREFERRED_VERSION_FILE and run setup again"
    fi
elif [ -n "$LATEST_VERSION" ]; then
    echo "   Latest available: v$LATEST_VERSION"
    echo "   Tested version: v$DEFAULT_ELECTRON_VERSION"
    
    # Ask user only once - save their preference
    echo "   Which version would you like to use?"
    echo "   [1] Tested version ($DEFAULT_ELECTRON_VERSION) - Recommended"
    echo "   [2] Latest version ($LATEST_VERSION) - May have compatibility issues"
    read -p "   Choice (1 or 2): " -n 1 -r
    echo
    
    if [[ $REPLY == "2" ]]; then
        ELECTRON_VERSION="$LATEST_VERSION"
        echo "   Using latest: v$ELECTRON_VERSION"
    else
        ELECTRON_VERSION="$DEFAULT_ELECTRON_VERSION"
        echo "   Using tested: v$ELECTRON_VERSION"
    fi
    
    # Save the preference
    mkdir -p "$CACHE_DIR"
    echo "$ELECTRON_VERSION" > "$PREFERRED_VERSION_FILE"
    echo "   ✅ Saved preference for future runs"
else
    ELECTRON_VERSION="$DEFAULT_ELECTRON_VERSION"
    echo "   Could not check latest version, using tested v$ELECTRON_VERSION"
fi

CACHE_DIR="$HOME/.pnut-term-ts-cache"
CACHE_FILE="$CACHE_DIR/electron-v$ELECTRON_VERSION-darwin-$ARCH.zip"
VERSION_FILE="$CACHE_DIR/cached-version.txt"

echo "📂 Cache directory: $CACHE_DIR"
mkdir -p "$CACHE_DIR"

# Show cache status
if [ -d "$CACHE_DIR" ]; then
    CACHE_SIZE=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1)
    CACHE_COUNT=$(ls -1 "$CACHE_DIR"/electron-*.zip 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CACHE_COUNT" -gt "0" ]; then
        echo "   Cache size: $CACHE_SIZE ($CACHE_COUNT version(s) cached)"
        
        # List what's cached
        echo "   Cached versions:"
        for f in "$CACHE_DIR"/electron-*.zip; do
            if [ -f "$f" ]; then
                VERSION_IN_FILE=$(basename "$f" | sed 's/electron-v\(.*\)-darwin-.*/\1/')
                SIZE=$(du -sh "$f" | cut -f1)
                if [ "$VERSION_IN_FILE" = "$ELECTRON_VERSION" ]; then
                    echo "     • v$VERSION_IN_FILE ($SIZE) ← Will use this"
                else
                    echo "     • v$VERSION_IN_FILE ($SIZE)"
                fi
            fi
        done
        
        # Offer to clean old versions if multiple cached
        if [ "$CACHE_COUNT" -gt "1" ]; then
            echo "   🧹 Multiple versions found"
            read -p "   Clean old versions (keep only v$ELECTRON_VERSION)? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Delete everything EXCEPT the version we want
                for f in "$CACHE_DIR"/electron-*.zip; do
                    VERSION_IN_FILE=$(basename "$f" | sed 's/electron-v\(.*\)-darwin-.*/\1/')
                    if [ "$VERSION_IN_FILE" != "$ELECTRON_VERSION" ]; then
                        echo "   Removing: v$VERSION_IN_FILE"
                        rm -f "$f"
                    else
                        echo "   Keeping: v$VERSION_IN_FILE"
                    fi
                done
                echo "   ✅ Old versions removed"
            fi
        fi
    fi
fi

# Check if cached version matches what we need
CACHED_VERSION=""
if [ -f "$VERSION_FILE" ]; then
    CACHED_VERSION=$(cat "$VERSION_FILE")
fi

# Check cache and version
if [ -f "$CACHE_FILE" ] && [ "$CACHED_VERSION" = "$ELECTRON_VERSION" ]; then
    echo "✅ Using cached Electron framework v$ELECTRON_VERSION"
    echo "   Cache: $CACHE_FILE"
    unzip -q "$CACHE_FILE" -d /tmp/electron-temp
elif [ -f "$CACHE_FILE" ] && [ "$CACHED_VERSION" != "$ELECTRON_VERSION" ]; then
    echo "🔄 Cached version ($CACHED_VERSION) differs from required ($ELECTRON_VERSION)"
    echo "   Removing old cache and downloading new version..."
    rm -f "$CACHE_DIR"/electron-*.zip
    rm -f "$VERSION_FILE"
elif [ -d "/Applications/Electron.app" ]; then
    echo "📋 Copying Electron framework from /Applications..."
    cp -R /Applications/Electron.app /tmp/electron-temp/
else
    echo "📥 Downloading Electron framework..."
    echo "   Version: $ELECTRON_VERSION"
    echo "   Architecture: $ARCH"
    echo "   This may take a minute..."
    
    ELECTRON_URL="https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-darwin-$ARCH.zip"
    
    # Download to cache
    curl -L "$ELECTRON_URL" -o "$CACHE_FILE"
    
    # Save the version we cached
    echo "$ELECTRON_VERSION" > "$VERSION_FILE"
    
    echo "💾 Cached v$ELECTRON_VERSION for future use"
    echo "   Cache: $CACHE_FILE"
    
    # Extract from cache
    unzip -q "$CACHE_FILE" -d /tmp/electron-temp
fi

# Copy Electron.app to our app
echo "📦 Integrating Electron framework..."
cp -R /tmp/electron-temp/Electron.app/* "$SCRIPT_DIR/PNut-Term-TS.app/"
rm -rf /tmp/electron-temp

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

# Create logs directory if it doesn't exist
LOGS_DIR="$SCRIPT_DIR/test-logs"
mkdir -p "$LOGS_DIR"

# Create timestamped log file
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
LOG_FILE="$LOGS_DIR/launch-$TIMESTAMP.log"

echo "📝 Logging output to: $LOG_FILE"
echo ""
echo "========================================="
echo "Debug output will appear below:"
echo "========================================="

# Run without exec to capture exit code
# Tee output to both console and log file
"$ELECTRON_EXEC" "$APP_DIR" "$@" 2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}

echo "========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ App exited normally"
else
    echo "❌ App exited with error code: $EXIT_CODE"
fi
echo ""
echo "📝 Log saved to: $LOG_FILE"
echo ""
if [ $EXIT_CODE -ne 0 ]; then
    echo "Press Enter to close this window..."
    read -r
fi
LAUNCH_EOF
chmod +x "$PACKAGE_DIR/LAUNCH.command"

echo "🧪 Step 7: Creating TEST script..."
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

# Create logs directory if it doesn't exist
LOGS_DIR="$SCRIPT_DIR/test-logs"
mkdir -p "$LOGS_DIR"

# Create timestamped log file
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
LOG_FILE="$LOGS_DIR/test-run-$TIMESTAMP.log"

echo "📝 Logging output to: $LOG_FILE"
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
    echo "========================================="
    echo "Debug output will appear below:"
    echo "========================================="
    
    # Run without exec so we can capture exit code and keep terminal open
    # Tee output to both console and log file
    "$ELECTRON_EXEC" "$APP_DIR" -p "$DEVICE_NAME" --verbose 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
    
    echo "========================================="
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ App exited normally"
    else
        echo "❌ App exited with error code: $EXIT_CODE"
        echo ""
        echo "Common error codes:"
        echo "  1  = General error"
        echo "  127 = Command not found"
        echo "  134 = Abort signal"
        echo "  139 = Segmentation fault"
    fi
    echo "========================================="
    echo ""
    echo "📝 Test log saved to: $LOG_FILE"
    echo ""
    echo "Press Enter to close this window..."
    read -r
else
    echo "❌ No P2 device found"
    echo ""
    echo "To test manually, run:"
    echo "   ./LAUNCH.command -p YOUR_DEVICE_NAME"
    echo ""
    echo "Example:"
    echo "   ./LAUNCH.command -p P9cektn7"
    echo ""
    echo "Press Enter to close this window..."
    read -r
fi
TEST_EOF
chmod +x "$PACKAGE_DIR/TEST.command"

echo "📦 Step 8: Adding DMG creation script..."
cp scripts/create-electron-dmg.sh release/electron-ready-macos/CREATE_DMG.command
chmod +x release/electron-ready-macos/CREATE_DMG.command

echo "🎨 Step 9: Copying DMG assets if available..."
if [ -d "buildSupport/dmg-assets" ]; then
    cp -r buildSupport/dmg-assets release/electron-ready-macos/
    echo "   ✅ DMG assets included for professional packaging"
else
    echo "   ⚠️  DMG assets not found, run prepare-dmg-assets.sh if needed"
fi

echo "📖 Step 10: Creating README..."
cat > "$PACKAGE_DIR/README.md" << 'README_EOF'
# PNut-Term-TS Electron Package

## Quick Setup

1. **Double-click `SETUP.command`** to set up Electron framework
2. **Test the app**: `./PNut-Term-TS.app/Contents/MacOS/Electron --help`
3. **Install to Applications**: Drag PNut-Term-TS.app to Applications folder

## What This Is

This is a pre-built Electron application that just needs the Electron framework added.
The SETUP script will either:
- Download Electron automatically (if not present)
- Copy from /Applications/Electron.app (if you have it)

## Manual Setup (Alternative)

If you prefer manual setup:

1. Download Electron from https://github.com/electron/electron/releases
2. Copy Electron.app contents into PNut-Term-TS.app
3. Sign: `codesign --force --deep --sign - PNut-Term-TS.app`

## Testing Task #89

Once set up:
```bash
./PNut-Term-TS.app/Contents/MacOS/Electron -p YOUR_DEVICE --verbose
```

This will launch the GUI with debug windows for placement testing.
README_EOF

echo "📦 Step 11: Creating archive..."
cd release
tar -czf electron-ready-macos.tar.gz electron-ready-macos/
cd ..

echo "✅ Electron-ready package created!"
echo ""
echo "📦 Package: release/electron-ready-macos/"
echo "📦 Archive: release/electron-ready-macos.tar.gz"
echo ""
echo "🎯 Instructions for macOS:"
echo "   1. Extract the archive"
echo "   2. Double-click SETUP.command"
echo "   3. Test with your P2 hardware"
echo ""
echo "This package contains everything except the Electron runtime,"
echo "which gets added on your Mac without polluting your system!"