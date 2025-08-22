#!/bin/bash

# Prepare the Electron package for DMG creation
# This creates the exact structure needed for DropDMG

echo "🎯 Preparing Electron Package for DMG Creation"
echo "=============================================="

# Configuration
APP_NAME="PNut-Term-TS"
PACKAGE_DIR="release/dmg-ready"
APP_BUNDLE="$PACKAGE_DIR/$APP_NAME.app"

# Clean and create package directory
echo "📁 Creating package structure..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Check if we have the electron-ready package
if [ -d "release/electron-ready-macos" ]; then
    echo "📦 Using electron-ready-macos package"
    
    # CRITICAL: Check if SETUP has been run
    if [ ! -f "release/electron-ready-macos/.has-been-setup" ]; then
        echo ""
        echo "❌ ERROR: Package has not been set up yet!"
        echo ""
        echo "The Electron framework has not been integrated."
        echo "You cannot create a DMG from an incomplete package."
        echo ""
        echo "📋 To fix this:"
        echo "   1. Extract release/electron-ready-macos.tar.gz on your Mac"
        echo "   2. Run SETUP.command to integrate Electron"
        echo "   3. Copy the complete package back here"
        echo "   4. Then run this script again"
        echo ""
        echo "The .has-been-setup flag is missing, which means"
        echo "SETUP.command has not been successfully run."
        exit 1
    fi
    
    echo "✅ Package has been set up (found .has-been-setup flag)"
    cp -R "release/electron-ready-macos/PNut-Term-TS.app" "$PACKAGE_DIR/" 2>/dev/null || {
        echo "⚠️  App bundle not found, creating structure..."
        mkdir -p "$APP_BUNDLE/Contents/Resources/app"
        mkdir -p "$APP_BUNDLE/Contents/MacOS"
        
        # Copy application files
        cp -R dist "$APP_BUNDLE/Contents/Resources/app/"
        cp -R node_modules "$APP_BUNDLE/Contents/Resources/app/"
        cp -R fonts "$APP_BUNDLE/Contents/Resources/app/"
        cp package.json "$APP_BUNDLE/Contents/Resources/app/"
        
        # Create Info.plist
        cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>PNut-Term-TS</string>
    <key>CFBundleExecutable</key>
    <string>Electron</string>
    <key>CFBundleIdentifier</key>
    <string>biz.ironsheep.pnut-term-ts</string>
    <key>CFBundleName</key>
    <string>PNut-Term-TS</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
PLIST
    }
else
    echo "⚠️  No existing package found, building fresh..."
    npm run build
    # Create minimal structure as shown above
fi

# Create symbolic link to Applications
echo "🔗 Creating Applications symlink..."
ln -sf /Applications "$PACKAGE_DIR/Applications"

# Copy any README or documentation
if [ -f "release/electron-ready-macos/README.md" ]; then
    cp "release/electron-ready-macos/README.md" "$PACKAGE_DIR/README.txt"
fi

# Create a simple installer background prompt file
cat > "$PACKAGE_DIR/.background/background-message.txt" << 'EOF'
PNut-Term-TS - Debug Terminal for Propeller 2

Drag the PNut-Term-TS app to your Applications folder →

Developed by Iron Sheep Productions
for Parallax Inc.
EOF

echo ""
echo "✅ Package prepared for DMG creation"
echo "📁 Location: $PACKAGE_DIR"
echo ""
echo "🎨 Next steps for creating DMG on macOS:"
echo ""
echo "1. Simple method with DropDMG:"
echo "   dropdmg --format zlib --layout-folder \"$PACKAGE_DIR\""
echo ""
echo "2. With custom background (if you have DropDMG):"
echo "   dropdmg \\"
echo "     --format zlib \\"
echo "     --volume-name \"$APP_NAME\" \\"
echo "     --background buildSupport/dmg-assets/dmg-background.png \\"
echo "     --layout-folder \"$PACKAGE_DIR\""
echo ""
echo "3. Using Disk Utility (manual):"
echo "   - Open Disk Utility"
echo "   - File → New Image → Image from Folder"
echo "   - Select: $PACKAGE_DIR"
echo "   - Format: Compressed"
echo ""
echo "📋 Package contains:"
ls -la "$PACKAGE_DIR/"