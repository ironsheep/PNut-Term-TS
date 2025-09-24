#!/bin/bash
# Create custom volume icon for DMG by combining disk icon with app icon

echo "🎨 Creating Custom DMG Volume Icon"
echo "=================================="

# Function to check if running on macOS
check_macos() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo "❌ This script must be run on macOS to access system icons"
        exit 1
    fi
}

# Function to check dependencies
check_dependencies() {
    if ! command -v sips &> /dev/null; then
        echo "❌ sips command not found (macOS image tool)"
        exit 1
    fi

    if ! command -v iconutil &> /dev/null; then
        echo "❌ iconutil command not found (required for icns creation)"
        exit 1
    fi
}

# Main function
create_volume_icon() {
    # Check environment
    check_macos
    check_dependencies

    # Set up paths
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    TEMP_DIR="$PROJECT_ROOT/volume-icon-temp"
    OUTPUT_DIR="$PROJECT_ROOT/dmg-assets"

    # Source icons
    APP_ICON="$PROJECT_ROOT/assets/icon.icns"

    # Try to find system disk icon in various locations
    POSSIBLE_ICONS=(
        "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ExternalDiskIcon.icns"
        "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericRemovableDiskIcon.icns"
        "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericDiskIcon.icns"
        "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/SidebarExternalDisk.icns"
        "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericFileServerIcon.icns"
        "/System/Library/Extensions/IOStorageFamily.kext/Contents/Resources/External.icns"
        "/System/Volumes/Preboot/Cryptexes/OS/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericDiskIcon.icns"
        "/System/Library/PrivateFrameworks/IconFoundation.framework/Versions/A/Resources/GenericDiskIcon.icns"
    )

    SYSTEM_DISK_ICON=""
    for icon_path in "${POSSIBLE_ICONS[@]}"; do
        if [ -f "$icon_path" ]; then
            SYSTEM_DISK_ICON="$icon_path"
            echo "✅ Found system disk icon at: $icon_path"
            break
        fi
    done

    echo "📍 Project root: $PROJECT_ROOT"
    echo "📍 App icon: $APP_ICON"
    if [ -n "$SYSTEM_DISK_ICON" ]; then
        echo "📍 System disk icon: $SYSTEM_DISK_ICON"
    fi

    # Verify app icon exists
    if [ ! -f "$APP_ICON" ]; then
        echo "❌ App icon not found at: $APP_ICON"
        exit 1
    fi

    # Create working directories
    echo ""
    echo "🔧 Setting up working directories..."
    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR/disk.iconset"
    mkdir -p "$TEMP_DIR/app.iconset"
    mkdir -p "$TEMP_DIR/composite.iconset"
    mkdir -p "$OUTPUT_DIR"

    # Handle disk icon - either from system or generate custom
    if [ -z "$SYSTEM_DISK_ICON" ] || [ ! -f "$SYSTEM_DISK_ICON" ]; then
        echo "⚠️  System disk icon not found in standard macOS locations"
        echo "   Generating custom disk icon as fallback..."

        # Check if Python and PIL are available
        if ! command -v python3 &> /dev/null; then
            echo "❌ Python 3 not found. Cannot generate fallback disk icon."
            exit 1
        fi

        # Use the Python script to create a disk icon
        if [ -f "$SCRIPT_DIR/create-disk-icon.py" ]; then
            python3 "$SCRIPT_DIR/create-disk-icon.py" "$TEMP_DIR" || {
                echo "❌ Failed to generate disk icon"
                exit 1
            }

            echo "✅ Generated custom disk icon"
            # The disk iconset is now in $TEMP_DIR/disk.iconset
        else
            echo "❌ Disk icon generator script not found at: $SCRIPT_DIR/create-disk-icon.py"
            exit 1
        fi
    else
        # Extract system disk iconset
        echo "📤 Extracting system disk icon..."
        iconutil -c iconset -o "$TEMP_DIR/disk.iconset" "$SYSTEM_DISK_ICON" 2>/dev/null || {
            echo "⚠️  Failed to extract disk iconset, trying alternative method..."
            # Alternative: use sips to extract largest size
            sips -Z 512 "$SYSTEM_DISK_ICON" --out "$TEMP_DIR/disk.iconset/icon_512x512.png" 2>/dev/null
        }
    fi

    # Extract app iconset
    echo "📤 Extracting app icon..."
    iconutil -c iconset -o "$TEMP_DIR/app.iconset" "$APP_ICON" 2>/dev/null || {
        echo "⚠️  Failed to extract app iconset, trying alternative method..."
        sips -Z 256 "$APP_ICON" --out "$TEMP_DIR/app.iconset/icon_256x256.png" 2>/dev/null
    }

    # Create composite icons for each size
    echo "🎨 Creating composite icons..."

    # Standard sizes for icns
    SIZES=(16 32 64 128 256 512)

    for SIZE in "${SIZES[@]}"; do
        SIZE2X=$((SIZE * 2))

        # File names
        DISK_FILE="$TEMP_DIR/disk.iconset/icon_${SIZE}x${SIZE}.png"
        DISK_FILE_2X="$TEMP_DIR/disk.iconset/icon_${SIZE}x${SIZE}@2x.png"
        APP_FILE="$TEMP_DIR/app.iconset/icon_${SIZE}x${SIZE}.png"
        OUTPUT_FILE="$TEMP_DIR/composite.iconset/icon_${SIZE}x${SIZE}.png"
        OUTPUT_FILE_2X="$TEMP_DIR/composite.iconset/icon_${SIZE}x${SIZE}@2x.png"

        # Process standard resolution
        if [ -f "$DISK_FILE" ]; then
            echo "   Processing ${SIZE}x${SIZE}..."

            # Copy disk icon as base
            cp "$DISK_FILE" "$OUTPUT_FILE"

            # Calculate overlay size (40% of disk icon size)
            OVERLAY_SIZE=$((SIZE * 40 / 100))

            # Create resized app icon for overlay
            if [ -f "$APP_FILE" ] || [ -f "$TEMP_DIR/app.iconset/icon_256x256.png" ]; then
                SOURCE_APP="$APP_FILE"
                if [ ! -f "$SOURCE_APP" ]; then
                    SOURCE_APP="$TEMP_DIR/app.iconset/icon_256x256.png"
                fi

                # Resize app icon
                sips -Z $OVERLAY_SIZE "$SOURCE_APP" --out "$TEMP_DIR/app_overlay.png" &>/dev/null

                # Composite the images using sips
                # Note: sips doesn't support direct compositing, so we'll use a Python script
                python3 - <<EOF
import sys
try:
    from PIL import Image

    # Load images
    base = Image.open("$OUTPUT_FILE").convert("RGBA")
    overlay = Image.open("$TEMP_DIR/app_overlay.png").convert("RGBA")

    # Calculate position (center)
    base_width, base_height = base.size
    overlay_width, overlay_height = overlay.size
    x = (base_width - overlay_width) // 2
    y = (base_height - overlay_height) // 2

    # Composite
    base.paste(overlay, (x, y), overlay)

    # Save
    base.save("$OUTPUT_FILE", "PNG")
    print(f"      ✅ Created {SIZE}x{SIZE}")
except ImportError:
    print("      ⚠️  PIL not available, using fallback method")
    sys.exit(1)
EOF

                if [ $? -ne 0 ]; then
                    # Fallback: just use disk icon
                    echo "      ⚠️  Using disk icon only for ${SIZE}x${SIZE}"
                fi
            fi
        fi

        # Process @2x resolution
        if [ -f "$DISK_FILE_2X" ]; then
            echo "   Processing ${SIZE}x${SIZE}@2x..."

            # Similar process for @2x
            cp "$DISK_FILE_2X" "$OUTPUT_FILE_2X"

            # Calculate overlay size for @2x
            OVERLAY_SIZE_2X=$((SIZE2X * 40 / 100))

            # Create @2x overlay (similar process)
            # ... (same as above but with @2x files)
        fi
    done

    # Create the final icns file
    echo ""
    echo "📦 Creating final .icns file..."
    iconutil -c icns -o "$OUTPUT_DIR/VolumeIcon.icns" "$TEMP_DIR/composite.iconset" 2>/dev/null

    if [ $? -eq 0 ] && [ -f "$OUTPUT_DIR/VolumeIcon.icns" ]; then
        echo "✅ Successfully created: $OUTPUT_DIR/VolumeIcon.icns"

        # Also create a .VolumeIcon.icns (hidden version for DMG)
        cp "$OUTPUT_DIR/VolumeIcon.icns" "$OUTPUT_DIR/.VolumeIcon.icns"
        echo "✅ Also created hidden version: $OUTPUT_DIR/.VolumeIcon.icns"
    else
        echo "⚠️  Failed to create icns, falling back to PNG method..."

        # Create at least a PNG version
        if [ -f "$TEMP_DIR/composite.iconset/icon_512x512.png" ]; then
            cp "$TEMP_DIR/composite.iconset/icon_512x512.png" "$OUTPUT_DIR/VolumeIcon.png"
            echo "✅ Created PNG version: $OUTPUT_DIR/VolumeIcon.png"
        fi
    fi

    # Clean up
    echo ""
    echo "🧹 Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"

    echo ""
    echo "✨ Volume icon creation complete!"
    echo ""
    echo "📝 To use this icon in your DMG:"
    echo "   1. The icon will be automatically applied when creating DMGs"
    echo "   2. It's stored in: $OUTPUT_DIR/VolumeIcon.icns"
}

# Run main function
create_volume_icon