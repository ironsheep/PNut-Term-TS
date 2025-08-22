#!/bin/bash
# This script should be run on macOS to create the final DMG installer

set -e

echo "🍎 Creating macOS DMG Installer"
echo "==============================="

# Check we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Check if we have the app bundle
if [[ ! -d "release/sea-macos/PNut-Term-TS.app" ]]; then
    echo "❌ PNut-Term-TS.app bundle not found"
    echo "   Run create-cross-platform-sea.sh first"
    exit 1
fi

# Check if we have the SEA blob
if [[ ! -f "sea-prep-macos.blob" ]]; then
    echo "❌ SEA preparation blob not found"
    echo "   Run create-cross-platform-sea.sh first"  
    exit 1
fi

echo "📱 Step 1: Creating SEA executable..."
if [[ ! -f "release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts" ]]; then
    cp $(command -v node) release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts
    npx postject release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts \
        NODE_SEA_BLOB sea-prep-macos.blob \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    chmod +x release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts
fi

echo "🔏 Step 2: Code signing..."
# Remove any existing signature
codesign --remove-signature release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts 2>/dev/null || true

# Check for signing identity
SIGNING_IDENTITY="${SIGNING_IDENTITY:-Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)}"

if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    echo "   🔑 Signing with: $SIGNING_IDENTITY"
    codesign --force --sign "$SIGNING_IDENTITY" release/sea-macos/PNut-Term-TS.app
    
    # Verify signature
    codesign --verify --verbose release/sea-macos/PNut-Term-TS.app
    echo "   ✅ Code signing successful"
else
    echo "   ⚠️  No Developer ID found, signing with ad-hoc signature"
    codesign --force --sign - release/sea-macos/PNut-Term-TS.app
fi

echo "💾 Step 3: Creating temporary DMG staging area..."
DMG_STAGING="release/dmg-staging"
rm -rf "$DMG_STAGING"
mkdir -p "$DMG_STAGING"

# Copy app to staging
cp -r release/sea-macos/PNut-Term-TS.app "$DMG_STAGING/"

# Create Applications symlink for drag-and-drop
ln -s /Applications "$DMG_STAGING/Applications"

# Create nice background and layout
mkdir -p "$DMG_STAGING/.background"

# Create DS_Store for nice layout (if we have a template)
cat > "$DMG_STAGING/README.txt" << 'README_EOF'
PNut Term TS - Propeller 2 Debug Terminal

Installation:
1. Drag "PNut-Term-TS.app" to the Applications folder
2. Open Terminal and run: /Applications/PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS --help

Features:
- Native Node.js Single Executable Application  
- No external dependencies required
- Full serialport support for Propeller 2
- Debug window system with auto-placement
- Cross-platform compatibility

For command-line use:
/Applications/PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS -p P9cektn7

Version: 0.1.0
Developer: Iron Sheep Productions, LLC
README_EOF

echo "📦 Step 4: Creating DMG..."
DMG_NAME="PNut-Term-TS-v0.1.0"
DMG_PATH="release/$DMG_NAME.dmg"

# Remove existing DMG
rm -f "$DMG_PATH"

# Create DMG
hdiutil create -volname "PNut Term TS" \
    -srcfolder "$DMG_STAGING" \
    -ov -format UDBZ \
    "$DMG_PATH"

echo "🔏 Step 5: Code signing DMG..."
if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"
    echo "   ✅ DMG code signing successful"
else
    echo "   ⚠️  DMG signed with ad-hoc signature"
    codesign --force --sign - "$DMG_PATH"
fi

echo "🧹 Step 6: Cleanup..."
rm -rf "$DMG_STAGING"

echo "✅ macOS DMG created successfully!"
echo ""
echo "📦 Installer: $DMG_PATH"
echo "📊 Size: $(du -h "$DMG_PATH" | cut -f1)"
echo ""
echo "🎯 Distribution ready!"
echo "   Users can download, mount, and drag to Applications"
echo "   No external dependencies required"
echo "   Full native performance with serialport support"
echo ""
echo "🔄 Next: Test on clean macOS system to verify functionality"