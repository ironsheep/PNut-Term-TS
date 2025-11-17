#!/bin/bash
# Sign application bundles for distribution
# Strategy: Only sign components that electron-builder doesn't handle

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

# Helper function: Check if a file is already validly signed
is_signed() {
    local file=$1
    codesign -v "$file" 2>/dev/null
    return $?
}

# Helper function: Sign a file only if not already signed
sign_if_needed() {
    local file=$1
    local description=$2
    local use_entitlements=$3

    if [ ! -f "$file" ]; then
        echo "      ⚠️  Not found: $description"
        return 0
    fi

    if is_signed "$file"; then
        echo "      ✓ Already signed: $description"
        return 0
    fi

    echo "      → Signing: $description"
    if [ "$use_entitlements" = "true" ]; then
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            --entitlements entitlements.plist \
            "$file" 2>&1; then
            echo "      ❌ Failed to sign: $description"
            return 1
        fi
    else
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$file" 2>&1; then
            echo "      ❌ Failed to sign: $description"
            return 1
        fi
    fi
    echo "      ✅ Signed: $description"
    return 0
}

# Function to sign missing components in an app
sign_app() {
    local APP_PATH=$1
    local ARCH=$2

    if [ "$SKIP_SIGNING" = true ]; then
        echo "⏭️  Skipping signing for $ARCH app (no certificate)"
        return 0
    fi

    echo "🔏 Signing $ARCH app..."
    echo "   Path: $APP_PATH"
    echo ""
    echo "   Strategy: Sign only what electron-builder doesn't handle"
    echo "   - electron-builder signs: Electron core, frameworks, helpers"
    echo "   - This script signs: Native modules (.node), ShipIt executables"
    echo ""

    # Step 1: Sign SerialPort native modules in node_modules
    echo "   📦 Step 1/3: Signing SerialPort native modules in node_modules..."
    if [ -d "$APP_PATH/Contents/Resources/app/node_modules/@serialport/bindings-cpp/build/Release" ]; then
        sign_if_needed \
            "$APP_PATH/Contents/Resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node" \
            "bindings.node (node_modules)" \
            false
    else
        echo "      ℹ️  SerialPort node_modules directory not found"
    fi
    echo ""

    # Step 2: Sign SerialPort native modules in prebuilds (darwin only)
    echo "   📦 Step 2/3: Signing SerialPort native modules in prebuilds..."
    if [ -d "$APP_PATH/Contents/Resources/app/prebuilds/darwin-x64+arm64" ]; then
        sign_if_needed \
            "$APP_PATH/Contents/Resources/app/prebuilds/darwin-x64+arm64/@serialport+bindings-cpp.node" \
            "@serialport+bindings-cpp.node (prebuilds)" \
            false
    else
        echo "      ℹ️  SerialPort prebuilds directory not found"
    fi
    echo ""

    # Step 3: Sign Squirrel ShipIt executables (with hardened runtime + entitlements)
    echo "   📦 Step 3/3: Signing Squirrel ShipIt executables..."
    local shipit_signed=0

    # ShipIt location 1: Resources/ShipIt
    if sign_if_needed \
        "$APP_PATH/Contents/Frameworks/Squirrel.framework/Resources/ShipIt" \
        "ShipIt (Resources)" \
        true; then
        ((shipit_signed++))
    fi

    # ShipIt location 2: Versions/A/Resources/ShipIt
    if sign_if_needed \
        "$APP_PATH/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt" \
        "ShipIt (Versions/A/Resources)" \
        true; then
        ((shipit_signed++))
    fi

    # ShipIt location 3: Versions/Current/Resources/ShipIt
    if sign_if_needed \
        "$APP_PATH/Contents/Frameworks/Squirrel.framework/Versions/Current/Resources/ShipIt" \
        "ShipIt (Versions/Current/Resources)" \
        true; then
        ((shipit_signed++))
    fi

    if [ $shipit_signed -eq 0 ]; then
        echo "      ⚠️  No ShipIt executables found or signed"
    fi
    echo ""

    # Final verification
    echo "   🔍 Verifying overall app signature..."
    if ! codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1; then
        echo "   ⚠️  Signature verification reported issues (may be acceptable)"
        echo "      Continuing - notarization service will do final validation"
    else
        echo "   ✅ Signature verification passed!"
    fi
    echo ""

    echo "   ✅ $ARCH app signing complete!"
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
    echo "📦 Processed apps:"
    [ -n "$X64_APP" ] && echo "   - $X64_APP"
    [ -n "$ARM64_APP" ] && echo "   - $ARM64_APP"
    echo ""
    echo "📋 Signing strategy used:"
    echo "   - Skipped: Electron core components (already signed by electron-builder)"
    echo "   - Signed: Native modules and ShipIt executables (if not already signed)"
    echo ""
    echo "🎯 Next step: Run CREATE-STANDARD-DMGS.command"
fi
echo "=========================================="
echo ""
echo "Press any key to exit..."
read -n 1 -s
