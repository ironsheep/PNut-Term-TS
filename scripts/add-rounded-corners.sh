#!/bin/bash

# Add rounded corners to icon for macOS style
# Usage: ./add-rounded-corners.sh <input.png> <output.png> [corner_radius]

set -e

INPUT="${1:-assets/icon.png}"
OUTPUT="${2:-assets/icon-rounded.png}"
SIZE=$(identify -format "%w" "$INPUT")
RADIUS="${3:-$((SIZE / 6))}"  # Default to 1/6 of image size for nice rounding

echo "Adding rounded corners to icon..."
echo "  Input: $INPUT"
echo "  Output: $OUTPUT"
echo "  Size: ${SIZE}x${SIZE}"
echo "  Corner radius: ${RADIUS}px"

# Create a mask with rounded corners
convert -size ${SIZE}x${SIZE} xc:none -draw "roundrectangle 0,0 $((SIZE-1)),$((SIZE-1)) ${RADIUS},${RADIUS}" mask.png

# Apply the mask to the original image
convert "$INPUT" mask.png -compose DstIn -composite "$OUTPUT"

# Clean up
rm mask.png

echo "✓ Created rounded corner icon: $OUTPUT"

# Show file size
ls -lh "$OUTPUT" | awk '{print "  File size: " $5}'