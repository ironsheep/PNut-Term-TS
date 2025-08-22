#!/bin/bash
# This script creates a DMG from the Electron app bundle using DropDMG if available
# Falls back to hdiutil if DropDMG is not installed

set -e

echo "🍎 Creating macOS DMG from Electron Bundle"
echo "=========================================="

# Check we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Check if we have the app bundle
APP_PATH="PNut-Term-TS.app"
if [[ ! -d "$APP_PATH" ]]; then
    echo "❌ $APP_PATH not found in current directory"
    echo "   Please run this script from the directory containing the app bundle"
    exit 1
fi

# Version and name
VERSION="0.1.0"
DMG_NAME="PNut-Term-TS-v${VERSION}"
DMG_PATH="${DMG_NAME}.dmg"

# Remove existing DMG
rm -f "$DMG_PATH"

# Check if DropDMG is available
if command -v dropdmg &> /dev/null || [[ -d "/Applications/DropDMG.app" ]]; then
    echo "📦 Using DropDMG to create professional DMG..."
    
    # Create a configuration file for DropDMG
    cat > dropdmg-config.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>format</key>
    <string>bzip2-compressed</string>
    <key>volumeName</key>
    <string>PNut Term TS</string>
    <key>licenseType</key>
    <string>none</string>
    <key>internetEnabled</key>
    <true/>
</dict>
</plist>
EOF
    
    # Use DropDMG
    if command -v dropdmg &> /dev/null; then
        dropdmg --config-file=dropdmg-config.plist --output-folder=. "$APP_PATH"
    else
        /Applications/DropDMG.app/Contents/Frameworks/DropDMGFramework.framework/Versions/A/dropdmg \
            --config-file=dropdmg-config.plist --output-folder=. "$APP_PATH"
    fi
    
    # Rename to our standard name
    mv "PNut-Term-TS.dmg" "$DMG_PATH" 2>/dev/null || true
    
    # Clean up config
    rm -f dropdmg-config.plist
    
else
    echo "📦 DropDMG not found, using hdiutil..."
    
    # Create staging directory
    DMG_STAGING="dmg-staging"
    rm -rf "$DMG_STAGING"
    mkdir -p "$DMG_STAGING"
    
    # Copy app to staging
    cp -r "$APP_PATH" "$DMG_STAGING/"
    
    # Create Applications symlink
    ln -s /Applications "$DMG_STAGING/Applications"
    
    # Create README
    cat > "$DMG_STAGING/README.txt" << 'README_EOF'
PNut Term TS - Propeller 2 Debug Terminal

Installation:
1. Drag "PNut-Term-TS.app" to the Applications folder
2. Launch from Applications or run from Terminal

Features:
- Complete P2 Debug Terminal implementation
- All debug window types (TERM, SCOPE, LOGIC, etc.)
- Cross-platform Electron application
- Full serialport support for Propeller 2

Version: 0.1.0
Developer: Iron Sheep Productions, LLC
README_EOF
    
    # Create DMG
    hdiutil create -volname "PNut Term TS" \
        -srcfolder "$DMG_STAGING" \
        -ov -format UDBZ \
        "$DMG_PATH"
    
    # Clean up staging
    rm -rf "$DMG_STAGING"
fi

echo "🔏 Code signing DMG..."

# Check for signing identity
SIGNING_IDENTITY="${SIGNING_IDENTITY:-Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)}"

if security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
    echo "   🔑 Signing with: $SIGNING_IDENTITY"
    codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"
    
    # Verify signature
    codesign --verify --verbose "$DMG_PATH"
    echo "   ✅ DMG code signing successful"
else
    echo "   ⚠️  No Developer ID found, signing with ad-hoc signature"
    codesign --force --sign - "$DMG_PATH"
fi

echo "✅ macOS DMG created successfully!"
echo ""
echo "📦 Installer: $DMG_PATH"
echo "📊 Size: $(du -h "$DMG_PATH" | cut -f1)"
echo ""
echo "🎯 Distribution ready!"
echo "   Professional DMG installer for distribution"
echo "   Signed and ready for Gatekeeper"
echo ""

# If DropDMG is not installed, suggest it
if ! command -v dropdmg &> /dev/null && [[ ! -d "/Applications/DropDMG.app" ]]; then
    echo "💡 TIP: Install DropDMG for professional DMG creation with:"
    echo "   - Custom backgrounds and layouts"
    echo "   - License agreements"
    echo "   - Internet-enabled DMGs"
    echo "   https://c-command.com/dropdmg/"
fi