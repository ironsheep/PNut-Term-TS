#!/bin/bash

# Create macOS ICNS file from rounded corner PNG
# Usage: ./create-macos-icns.sh <input.png> <output.icns>

set -e

INPUT="${1:-assets/icon-rounded.png}"
OUTPUT="${2:-assets/icon.icns}"
ICONSET_DIR="temp-iconset/icon.iconset"

echo "Creating macOS ICNS from rounded corner icon..."
echo "  Input: $INPUT"
echo "  Output: $OUTPUT"

# Create iconset directory
rm -rf temp-iconset
mkdir -p "$ICONSET_DIR"

# Generate all required sizes for macOS
echo "Generating icon sizes..."

# Standard sizes
convert "$INPUT" -resize 16x16     "$ICONSET_DIR/icon_16x16.png"
convert "$INPUT" -resize 32x32     "$ICONSET_DIR/icon_16x16@2x.png"
convert "$INPUT" -resize 32x32     "$ICONSET_DIR/icon_32x32.png"
convert "$INPUT" -resize 64x64     "$ICONSET_DIR/icon_32x32@2x.png"
convert "$INPUT" -resize 128x128   "$ICONSET_DIR/icon_128x128.png"
convert "$INPUT" -resize 256x256   "$ICONSET_DIR/icon_128x128@2x.png"
convert "$INPUT" -resize 256x256   "$ICONSET_DIR/icon_256x256.png"
convert "$INPUT" -resize 512x512   "$ICONSET_DIR/icon_256x256@2x.png"
convert "$INPUT" -resize 512x512   "$ICONSET_DIR/icon_512x512.png"
convert "$INPUT" -resize 1024x1024 "$ICONSET_DIR/icon_512x512@2x.png"

# Use png2icns to create ICNS file
echo "Creating ICNS file..."
png2icns "$OUTPUT" \
    "$ICONSET_DIR/icon_16x16.png" \
    "$ICONSET_DIR/icon_32x32.png" \
    "$ICONSET_DIR/icon_128x128.png" \
    "$ICONSET_DIR/icon_256x256.png" \
    "$ICONSET_DIR/icon_512x512.png" \
    "$ICONSET_DIR/icon_512x512@2x.png"

# Clean up
rm -rf temp-iconset

echo "✓ Created macOS ICNS: $OUTPUT"
ls -lh "$OUTPUT" | awk '{print "  File size: " $5}'