#!/bin/bash

# Download IBM 3270 font for terminal emulation
# This font provides authentic IBM mainframe terminal appearance

echo "Downloading IBM 3270 font..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Download the font archive
echo "Fetching font files from GitHub..."
wget -q https://github.com/rbanffy/3270font/releases/download/v3.0.1/3270_fonts_d916271.zip

if [ $? -ne 0 ]; then
    echo "Error: Failed to download font archive"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Extract the archive
echo "Extracting font files..."
unzip -q 3270_fonts_d916271.zip

# Copy the TTF files to our fonts directory
FONTS_DIR="$(dirname "$0")/../src/assets/fonts"
mkdir -p "$FONTS_DIR"

echo "Installing font files..."
cp -f "3270 Narrow.ttf" "$FONTS_DIR/3270-Narrow.ttf"
cp -f "3270 Semi-Narrow.ttf" "$FONTS_DIR/3270-SemiNarrow.ttf"
cp -f "3270-Regular.ttf" "$FONTS_DIR/3270-Regular.ttf"

# Clean up
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "✅ IBM 3270 fonts installed successfully in src/assets/fonts/"
echo "Available variants:"
echo "  - 3270-Regular.ttf (standard width)"
echo "  - 3270-SemiNarrow.ttf (semi-narrow)"
echo "  - 3270-Narrow.ttf (narrow)"