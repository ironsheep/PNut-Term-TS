#!/bin/bash
# Sign application bundles for distribution

set -e

echo "🔐 PNut-Term-TS App Signing"
echo "============================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Auto-detect version from existing package directories
echo "🔍 Auto-detecting package version from directories..."
X64_APP=""
ARM64_APP=""

# Find x64 app by pattern
X64_DIR=$(find . -maxdepth 1 -type d -name "pnut-term-ts-macos-x64-*" | head -1)
if [ -n "$X64_DIR" ] && [ -d "$X64_DIR/PNut-Term-TS.app" ]; then
    X64_APP="$X64_DIR/PNut-Term-TS.app"
    echo "✅ Found x64 app at: $X64_APP"
else
    echo "⚠️  x64 app not found"
fi

# Find arm64 app by pattern
ARM64_DIR=$(find . -maxdepth 1 -type d -name "pnut-term-ts-macos-arm64-*" | head -1)
if [ -n "$ARM64_DIR" ] && [ -d "$ARM64_DIR/PNut-Term-TS.app" ]; then
    ARM64_APP="$ARM64_DIR/PNut-Term-TS.app"
    echo "✅ Found arm64 app at: $ARM64_APP"
else
    echo "⚠️  arm64 app not found"
fi

if [ -z "$X64_APP" ] && [ -z "$ARM64_APP" ]; then
    echo ""
    echo "❌ No apps found to sign!"
    echo ""
    echo "Please ensure you have extracted the packages first."
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

echo ""
echo "🔑 Available signing identities:"
security find-identity -v -p codesigning | grep "Developer ID Application" || echo "   No Developer ID found"
echo ""

# Get the signing identity
IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk -F'"' '{print $2}')

if [ -z "$IDENTITY" ]; then
    echo "⚠️  No Developer ID Application certificate found!"
    echo ""
    echo "Continuing without signing (apps will require Gatekeeper bypass)"
    echo ""
    SKIP_SIGNING=true
else
    echo "📝 Will sign with: $IDENTITY"
    echo ""
    SKIP_SIGNING=false
fi

# Function to sign an app
sign_app() {
    local APP_PATH=$1
    local ARCH=$2

    if [ "$SKIP_SIGNING" = true ]; then
        echo "⏭️  Skipping signing for $ARCH app (no certificate)"
        return 0
    fi

    echo "🔏 Signing $ARCH app..."
    echo "   Path: $APP_PATH"

    # Sign all frameworks first
    echo "   📦 Signing frameworks..."
    find "$APP_PATH" -name "*.framework" -type d | while read -r framework; do
        echo "      Signing: $(basename "$framework")"
        codesign --force --deep --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$framework" 2>/dev/null || true
    done

    # Sign all dylibs
    echo "   📚 Signing libraries..."
    find "$APP_PATH" -name "*.dylib" -type f | while read -r dylib; do
        echo "      Signing: $(basename "$dylib")"
        codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$dylib" 2>/dev/null || true
    done

    # Sign all executables in MacOS folder
    echo "   🎯 Signing executables..."
    find "$APP_PATH/Contents/MacOS" -type f -perm +111 | while read -r exe; do
        echo "      Signing: $(basename "$exe")"
        codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            --entitlements entitlements.plist \
            "$exe" 2>/dev/null || true
    done

    # Finally sign the app bundle itself
    echo "   📱 Signing app bundle..."
    codesign --force --deep --sign "$IDENTITY" \
        --options runtime \
        --timestamp \
        --entitlements entitlements.plist \
        "$APP_PATH"

    # Verify the signature
    echo "   🔍 Verifying signature..."
    codesign --verify --verbose=2 "$APP_PATH"

    echo "   ✅ $ARCH app signed successfully!"
    echo ""
}

# Create entitlements file if it doesn't exist
if [ ! -f "entitlements.plist" ]; then
    echo "📝 Creating entitlements.plist..."
    cat > entitlements.plist << 'ENTITLEMENTS_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.serial</key>
    <true/>
    <key>com.apple.security.device.usb</key>
    <true/>
</dict>
</plist>
ENTITLEMENTS_EOF
    echo "   ✅ Created entitlements.plist"
    echo ""
fi

# Sign x64 app if present
if [ -n "$X64_APP" ]; then
    sign_app "$X64_APP" "x64"
fi

# Sign arm64 app if present
if [ -n "$ARM64_APP" ]; then
    sign_app "$ARM64_APP" "arm64"
fi

echo "=========================================="
if [ "$SKIP_SIGNING" = true ]; then
    echo "⚠️  Apps not signed (no certificate)"
    echo ""
    echo "To run unsigned apps, users will need to:"
    echo "1. Right-click the app and select 'Open'"
    echo "2. Click 'Open' in the security dialog"
    echo ""
    echo "Or disable Gatekeeper temporarily:"
    echo "   sudo spctl --master-disable"
else
    echo "✅ App signing complete!"
    echo ""
    echo "📦 Signed apps:"
    [ -n "$X64_APP" ] && echo "   - $X64_APP"
    [ -n "$ARM64_APP" ] && echo "   - $ARM64_APP"
    echo ""
    echo "🎯 Next step: Run CREATE-STANDARD-DMGS.command"
fi
echo "=========================================="
echo ""
echo "Press any key to exit..."
read -n 1 -s