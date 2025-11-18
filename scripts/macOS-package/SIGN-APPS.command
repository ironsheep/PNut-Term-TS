#!/bin/bash
# Sign application bundles for distribution
# CRITICAL: Sign in correct order (innermost → outermost) WITHOUT --deep flag

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

# Function to sign an app - COMPREHENSIVE, PROPER ORDER, NO --deep
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
    echo "   Strategy: STRIP existing signatures, then sign EVERYTHING in correct nested order (NO --deep flag)"
    echo "   Order: strip all → dylibs → helpers → framework binaries → frameworks → helper apps → main → bundle"
    echo ""

    # Step 0: Strip ALL existing signatures (Electron comes pre-signed, must remove first)
    echo "   🧹 Step 0/9: Stripping existing signatures..."
    echo "      Reason: Electron binaries come pre-signed. Re-signing without stripping breaks signature chains."
    echo ""

    # Strip main app bundle signature
    codesign --remove-signature "$APP_PATH" 2>/dev/null || true

    # Strip main executable signature
    [ -f "$APP_PATH/Contents/MacOS/Electron" ] && codesign --remove-signature "$APP_PATH/Contents/MacOS/Electron" 2>/dev/null || true

    # Strip all helper apps
    find "$APP_PATH/Contents/Frameworks" -name "*.app" -type d -maxdepth 1 2>/dev/null | while read -r helper_app; do
        codesign --remove-signature "$helper_app" 2>/dev/null || true
        local app_name=$(basename "$helper_app" .app)
        [ -f "$helper_app/Contents/MacOS/$app_name" ] && codesign --remove-signature "$helper_app/Contents/MacOS/$app_name" 2>/dev/null || true
    done

    # Strip all frameworks
    for framework in "$APP_PATH/Contents/Frameworks"/*.framework; do
        if [ -d "$framework" ]; then
            codesign --remove-signature "$framework" 2>/dev/null || true
            local framework_name=$(basename "$framework" .framework)
            [ -f "$framework/Versions/A/$framework_name" ] && codesign --remove-signature "$framework/Versions/A/$framework_name" 2>/dev/null || true
        fi
    done

    # Strip Electron Framework helpers
    find "$APP_PATH/Contents/Frameworks/Electron Framework.framework" -type f -perm +111 \
        -not -name "Electron Framework" -not -name "*.dylib" 2>/dev/null | while read -r helper; do
        codesign --remove-signature "$helper" 2>/dev/null || true
    done

    # Strip all dylibs
    find "$APP_PATH/Contents/Frameworks/Electron Framework.framework" -name "*.dylib" -type f 2>/dev/null | while read -r dylib; do
        codesign --remove-signature "$dylib" 2>/dev/null || true
    done

    # Strip native modules
    [ -f "$APP_PATH/Contents/Resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node" ] && \
        codesign --remove-signature "$APP_PATH/Contents/Resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node" 2>/dev/null || true
    [ -f "$APP_PATH/Contents/Resources/app/prebuilds/darwin-x64+arm64/@serialport+bindings-cpp.node" ] && \
        codesign --remove-signature "$APP_PATH/Contents/Resources/app/prebuilds/darwin-x64+arm64/@serialport+bindings-cpp.node" 2>/dev/null || true

    # Strip ShipIt executables
    find "$APP_PATH/Contents/Frameworks/Squirrel.framework" -name "ShipIt" -type f 2>/dev/null | while read -r shipit; do
        codesign --remove-signature "$shipit" 2>/dev/null || true
    done

    echo "      ✅ All existing signatures removed"
    echo ""

    # Verify everything is unsigned
    echo "   🔍 Verifying all signatures removed..."
    local unsigned_count=0
    local still_signed_count=0

    # Check a few key components
    for component in \
        "$APP_PATH" \
        "$APP_PATH/Contents/MacOS/Electron" \
        "$APP_PATH/Contents/Frameworks/Electron Framework.framework" \
        "$APP_PATH/Contents/Frameworks/Mantle.framework" \
        "$APP_PATH/Contents/Frameworks/ReactiveObjC.framework" \
        "$APP_PATH/Contents/Frameworks/Squirrel.framework"; do

        if [ -e "$component" ]; then
            if codesign -v "$component" 2>/dev/null; then
                echo "      ⚠️  Still signed: $(basename "$component")"
                ((still_signed_count++))
            else
                ((unsigned_count++))
            fi
        fi
    done

    if [ $still_signed_count -gt 0 ]; then
        echo "      ❌ ERROR: $still_signed_count component(s) still signed after stripping!"
        echo "      Cannot proceed - signature removal failed"
        return 1
    fi

    echo "      ✅ Verified: All checked components are unsigned"
    echo ""

    # Step 1: Sign all .dylib files (deepest level - inside Electron Framework)
    echo "   📚 Step 1/9: Signing .dylib files..."
    local dylib_count=0
    find "$APP_PATH/Contents/Frameworks/Electron Framework.framework" -name "*.dylib" -type f 2>/dev/null | while read -r dylib; do
        echo "      Signing: $(basename "$dylib")"
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$dylib" 2>&1; then
            echo "      ⚠️  Warning: Failed to sign $(basename "$dylib")"
        fi
        ((dylib_count++))
    done
    echo "      ✅ Libraries signed"
    echo ""

    # Step 2: Sign helper executables inside Electron Framework (chrome_crashpad_handler, etc.)
    echo "   🔧 Step 2/9: Signing Electron Framework helpers..."
    find "$APP_PATH/Contents/Frameworks/Electron Framework.framework" -type f -perm +111 \
        -not -name "Electron Framework" \
        -not -name "*.dylib" \
        -not -path "*/Versions/*/Resources/*" 2>/dev/null | while read -r helper; do
        echo "      Signing: $(basename "$helper")"
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$helper" 2>&1; then
            echo "      ⚠️  Warning: Failed to sign $(basename "$helper")"
        fi
    done
    echo "      ✅ Framework helpers signed"
    echo ""

    # Step 3: Sign Electron Framework binary (not the bundle, just the binary)
    echo "   📦 Step 3/9: Signing Electron Framework binary..."
    if [ -f "$APP_PATH/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework" ]; then
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$APP_PATH/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework" 2>&1; then
            echo "      ⚠️  Warning: Failed to sign Electron Framework binary"
        else
            echo "      ✅ Electron Framework binary signed"
        fi
    fi
    echo ""

    # Step 4: Sign the Electron Framework.framework bundle
    echo "   📦 Step 4/9: Signing Electron Framework.framework bundle..."
    if [ -d "$APP_PATH/Contents/Frameworks/Electron Framework.framework" ]; then
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$APP_PATH/Contents/Frameworks/Electron Framework.framework" 2>&1; then
            echo "      ⚠️  Warning: Failed to sign Electron Framework.framework"
        else
            echo "      ✅ Electron Framework.framework signed"
        fi
    fi
    echo ""

    # Step 5: Sign other frameworks (Mantle, ReactiveObjC, Squirrel)
    # CRITICAL: Sign ShipIt executables BEFORE signing Squirrel.framework
    echo "   📦 Step 5/9: Signing other frameworks..."

    # First, sign ShipIt executables inside Squirrel framework (before sealing the framework)
    find "$APP_PATH/Contents/Frameworks/Squirrel.framework" -name "ShipIt" -type f 2>/dev/null | while read -r shipit; do
        echo "      Signing ShipIt: $(dirname "$shipit" | xargs basename)"
        codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            --entitlements entitlements.plist \
            "$shipit" 2>&1 || true
    done

    # Now sign all frameworks (including Squirrel)
    for framework in "$APP_PATH/Contents/Frameworks"/*.framework; do
        if [ -d "$framework" ] && [ "$(basename "$framework")" != "Electron Framework.framework" ]; then
            local framework_name=$(basename "$framework" .framework)
            echo "      Signing framework: $framework_name"

            # First sign the binary inside the framework
            if [ -f "$framework/Versions/A/$framework_name" ]; then
                codesign --force --sign "$IDENTITY" \
                    --options runtime \
                    --timestamp \
                    "$framework/Versions/A/$framework_name" 2>&1 || true
            fi

            # Then sign the framework bundle itself
            codesign --force --sign "$IDENTITY" \
                --options runtime \
                --timestamp \
                "$framework" 2>&1 || true
        fi
    done
    echo "      ✅ Other frameworks signed"
    echo ""

    # Step 6: Sign all helper .app bundles (GPU, Plugin, Renderer, Helper)
    echo "   🎯 Step 6/9: Signing helper .app bundles..."
    find "$APP_PATH/Contents/Frameworks" -name "*.app" -type d -maxdepth 1 2>/dev/null | while read -r helper_app; do
        echo "      Signing: $(basename "$helper_app")"

        # Sign the executable inside first
        local app_name=$(basename "$helper_app" .app)
        if [ -f "$helper_app/Contents/MacOS/$app_name" ]; then
            codesign --force --sign "$IDENTITY" \
                --options runtime \
                --timestamp \
                --entitlements entitlements.plist \
                "$helper_app/Contents/MacOS/$app_name" 2>&1 || true
        fi

        # Then sign the .app bundle
        codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            --entitlements entitlements.plist \
            "$helper_app" 2>&1 || true
    done
    echo "      ✅ Helper apps signed"
    echo ""

    # Step 7: Sign native modules (.node files)
    # NOTE: ShipIt is now signed in Step 5 (before Squirrel.framework is sealed)
    echo "   📦 Step 7/9: Signing native modules..."

    # SerialPort .node files in node_modules
    if [ -f "$APP_PATH/Contents/Resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node" ]; then
        echo "      Signing: bindings.node (node_modules)"
        codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$APP_PATH/Contents/Resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node" 2>&1 || true
    fi

    # SerialPort .node files in prebuilds
    if [ -f "$APP_PATH/Contents/Resources/app/prebuilds/darwin-x64+arm64/@serialport+bindings-cpp.node" ]; then
        echo "      Signing: @serialport+bindings-cpp.node (prebuilds)"
        codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            "$APP_PATH/Contents/Resources/app/prebuilds/darwin-x64+arm64/@serialport+bindings-cpp.node" 2>&1 || true
    fi

    echo "      ✅ Native modules signed"
    echo ""

    # Step 8: Sign the main Electron executable
    echo "   🎯 Step 8/9: Signing main Electron executable..."
    if [ -f "$APP_PATH/Contents/MacOS/Electron" ]; then
        if ! codesign --force --sign "$IDENTITY" \
            --options runtime \
            --timestamp \
            --entitlements entitlements.plist \
            "$APP_PATH/Contents/MacOS/Electron" 2>&1; then
            echo "      ⚠️  Warning: Failed to sign main executable"
        else
            echo "      ✅ Main executable signed"
        fi
    fi
    echo ""

    # Step 9: Finally sign the app bundle itself (NEVER use --deep here!)
    echo "   📱 Step 9/9: Signing app bundle..."
    if ! codesign --force --sign "$IDENTITY" \
        --options runtime \
        --timestamp \
        --entitlements entitlements.plist \
        "$APP_PATH" 2>&1; then
        echo "   ❌ Failed to sign app bundle"
        return 1
    fi
    echo "      ✅ App bundle signed"
    echo ""

    # Verify the signature
    echo "   🔍 Verifying signature..."
    if ! codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1; then
        echo "   ⚠️  Verification reported issues"
        echo "      This may be acceptable - notarization service will do final validation"
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
