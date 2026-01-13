#!/bin/bash
# Create standard DMG installers with drag-to-install UI

# Don't exit on error immediately - we want to see what happens
set +e

# Function to handle errors
error_exit() {
    echo ""
    echo "❌ ERROR: $1"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
}

echo "📦 PNut-Term-TS Standard DMG Creation"
echo "======================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📍 Script directory: $SCRIPT_DIR"
cd "$SCRIPT_DIR" || error_exit "Failed to change to script directory"
echo "   Current directory: $(pwd)"

# Auto-detect version from existing package directories
echo "🔍 Auto-detecting package version from directories..."
X64_APP=""
ARM64_APP=""
VERSION=""

# Find x64 app by pattern
X64_DIR=$(find . -maxdepth 1 -type d -name "pnut-term-ts-macos-x64-*" | head -1)
if [ -n "$X64_DIR" ] && [ -d "$X64_DIR/PNut-Term-TS.app" ]; then
    X64_APP="$X64_DIR/PNut-Term-TS.app"
    # Extract version from directory name
    VERSION=$(basename "$X64_DIR" | sed 's/pnut-term-ts-macos-x64-//')
    echo "✅ Found x64 app at: $X64_APP"
    echo "   Detected version: $VERSION"
else
    echo "⚠️  x64 app not found"
fi

# Find arm64 app by pattern
ARM64_DIR=$(find . -maxdepth 1 -type d -name "pnut-term-ts-macos-arm64-*" | head -1)
if [ -n "$ARM64_DIR" ] && [ -d "$ARM64_DIR/PNut-Term-TS.app" ]; then
    ARM64_APP="$ARM64_DIR/PNut-Term-TS.app"
    # If VERSION not set from x64, extract from arm64
    if [ -z "$VERSION" ]; then
        VERSION=$(basename "$ARM64_DIR" | sed 's/pnut-term-ts-macos-arm64-//')
        echo "✅ Found arm64 app at: $ARM64_APP"
        echo "   Detected version: $VERSION"
    else
        echo "✅ Found arm64 app at: $ARM64_APP"
    fi
else
    echo "⚠️  arm64 app not found"
fi

if [ -z "$X64_APP" ] && [ -z "$ARM64_APP" ]; then
    echo ""
    echo "❌ No apps found!"
    echo ""
    echo "Please:"
    echo "  1. Extract the tar.gz files"
    echo "  2. Run SIGN-APPS.command"
    echo "  3. Then run this script"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

echo ""

# Function to create standard DMG with drag-to-install UI
create_standard_dmg() {
    local APP_PATH=$1
    local ARCH=$2
    local DMG_NAME="pnut-term-ts-macos-${ARCH}-${VERSION}.dmg"

    echo "💾 Creating standard DMG for $ARCH..."
    echo "   App: $APP_PATH"
    echo "   DMG: $DMG_NAME"
    echo ""

    # Create staging directory
    STAGING="dmg-staging-$ARCH"
    rm -rf "$STAGING"
    mkdir -p "$STAGING"

    # Copy ONLY the app bundle
    echo "   📋 Copying app bundle..."
    cp -r "$APP_PATH" "$STAGING/" || error_exit "Failed to copy app bundle from $APP_PATH"

    # Replace generic Electron icon with our custom PNut-Term-TS icon
    echo "   🎨 Replacing app icon..."
    CUSTOM_APP_ICON="$SCRIPT_DIR/../../assets/app-icon.icns"
    if [ -f "$CUSTOM_APP_ICON" ]; then
        # Copy as icon.icns to match CFBundleIconFile in Info.plist
        cp "$CUSTOM_APP_ICON" "$STAGING/PNut-Term-TS.app/Contents/Resources/icon.icns" || error_exit "Failed to copy app icon"
        echo "   ✅ Custom PNut-Term-TS app icon applied"
    else
        echo "   ⚠️  Custom app icon not found at: $CUSTOM_APP_ICON"
        echo "   ℹ️  Using default Electron icon"
    fi

    # Set DMG volume icon
    echo "   🎨 Setting DMG volume icon..."
    VOLUME_ICON="$SCRIPT_DIR/../../assets/volume-icon.icns"
    if [ -f "$VOLUME_ICON" ]; then
        cp "$VOLUME_ICON" "$STAGING/.VolumeIcon.icns" || error_exit "Failed to copy volume icon"
        echo "   ✅ DMG volume icon staged"
    else
        echo "   ⚠️  Volume icon not found at: $VOLUME_ICON"
    fi

    # Calculate size needed for DMG (app size + 25% padding for HFS+ overhead)
    APP_SIZE_KB=$(du -sk "$STAGING" | cut -f1)
    APP_SIZE_MB=$((APP_SIZE_KB / 1024))
    PADDING=$((APP_SIZE_MB * 25 / 100))
    # Ensure minimum 200MB padding
    if [ $PADDING -lt 200 ]; then
        PADDING=200
    fi
    DMG_SIZE=$((APP_SIZE_MB + PADDING))
    echo "   📊 App size: ${APP_SIZE_MB}MB, DMG size: ${DMG_SIZE}MB"

    # Create Applications symlink
    echo "   🔗 Creating Applications symlink..."
    ln -s /Applications "$STAGING/Applications" || error_exit "Failed to create Applications symlink"

    # Remove old DMG if exists
    rm -f "$DMG_NAME"

    # Unmount any existing PNut-Term-TS volumes to avoid conflicts
    echo "   🔄 Checking for mounted PNut-Term-TS volumes..."
    if hdiutil info | grep -q "/Volumes/PNut-Term-TS"; then
        echo "   ⚠️  Unmounting existing PNut-Term-TS volume..."
        hdiutil detach "/Volumes/PNut-Term-TS" -quiet 2>/dev/null || true
    fi

    # Check if background image exists
    if [ -f "$SCRIPT_DIR/dmg-background.png" ]; then
        echo "   🎨 Found background image, creating styled DMG..."

        # Copy background to staging
        mkdir -p "$STAGING/.background"
        cp "$SCRIPT_DIR/dmg-background.png" "$STAGING/.background/background.png"

        # Create temporary DMG with calculated size (use HFS+ for custom icon support)
        echo "   📦 Building DMG with custom background (${DMG_SIZE}MB)..."
        hdiutil create -volname "PNut-Term-TS" \
            -srcfolder "$STAGING" \
            -fs HFS+ \
            -ov -format UDRW \
            -size ${DMG_SIZE}m \
            "temp-$DMG_NAME" || error_exit "Failed to create temporary DMG"

        # Mount and customize
        echo "   🎨 Applying custom styling..."
        MOUNT_OUTPUT=$(hdiutil attach -readwrite -noverify -noautoopen "temp-$DMG_NAME" 2>&1)
        if [ $? -ne 0 ]; then
            echo "Mount output: $MOUNT_OUTPUT"
            error_exit "Failed to mount temporary DMG"
        fi
        DEVICE=$(echo "$MOUNT_OUTPUT" | egrep '^/dev/' | sed 1q | awk '{print $1}')

        sleep 2

        # Apply custom view with AppleScript
        echo '
        tell application "Finder"
            tell disk "PNut-Term-TS"
                open
                set current view of container window to icon view
                set toolbar visible of container window to false
                set statusbar visible of container window to false
                set the bounds of container window to {400, 100, 900, 400}
                set theViewOptions to the icon view options of container window
                set arrangement of theViewOptions to not arranged
                set icon size of theViewOptions to 72
                set background picture of theViewOptions to file ".background:background.png"
                set position of item "PNut-Term-TS.app" of container window to {125, 150}
                set position of item "Applications" of container window to {375, 150}
                close
                open
                update without registering applications
                delay 2
                close
            end tell
        end tell
        ' | osascript || true

        sync
        sync

        sleep 1

        # Set custom volume icon AFTER AppleScript (AppleScript can delete the icon file)
        if [ -f "$VOLUME_ICON" ]; then
            echo "   🎨 Setting volume icon (after AppleScript)..."
            # Re-copy the icon in case AppleScript deleted it
            cp "$VOLUME_ICON" "/Volumes/PNut-Term-TS/.VolumeIcon.icns"
            # Set icon file creator code
            SetFile -c icnC "/Volumes/PNut-Term-TS/.VolumeIcon.icns" 2>/dev/null || true
            # Set custom icon flag on volume
            SetFile -a C "/Volumes/PNut-Term-TS" 2>/dev/null || true
            echo "   ✅ Volume icon set"
        fi

        sync
        sync
        sleep 1

        # Unmount
        hdiutil detach "${DEVICE}" || {
            echo "   ⚠️  Normal unmount failed, forcing..."
            hdiutil detach "${DEVICE}" -force
        }

        # Convert to compressed read-only
        echo "   🗜️  Compressing DMG..."
        hdiutil convert "temp-$DMG_NAME" -format UDZO -imagekey zlib-level=9 -o "$DMG_NAME" || error_exit "Failed to compress DMG"
        rm -f "temp-$DMG_NAME"

    else
        echo "   📦 Building standard DMG (no background image found)..."
        echo "   💡 Tip: Run create-dmg-background.sh to create a background"

        # Create the DMG directly with proper settings (no custom icon without background workflow)
        hdiutil create \
            -volname "PNut-Term-TS" \
            -srcfolder "$STAGING" \
            -ov \
            -format UDZO \
            "$DMG_NAME" || error_exit "Failed to create DMG"
    fi

    # Clean up staging
    rm -rf "$STAGING"

    if [ -f "$DMG_NAME" ]; then
        echo "   ✅ Created $DMG_NAME"
        echo "   📊 Size: $(du -h "$DMG_NAME" | cut -f1)"
    else
        echo "   ❌ Failed to create $DMG_NAME"
    fi
    echo ""
}

# Create x64 DMG
if [ -n "$X64_APP" ]; then
    create_standard_dmg "$X64_APP" "x64"
fi

# Create arm64 DMG
if [ -n "$ARM64_APP" ]; then
    create_standard_dmg "$ARM64_APP" "arm64"
fi

echo "=========================================="
echo "✅ Standard DMG creation complete!"
echo "=========================================="
echo ""

# Check what was actually created
echo "📦 DMG files in directory:"
ls -la *.dmg 2>/dev/null || echo "   No DMG files found"

echo ""
echo "🎯 Next steps:"
echo "   1. Run SIGN-DMGS.command to sign the DMG files"
echo "   2. Run NOTARIZE-AND-STAPLE.command to notarize with Apple"
echo ""
echo "Press any key to exit..."
read -n 1 -s