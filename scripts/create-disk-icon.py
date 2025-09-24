#!/usr/bin/env python3
"""
Create a disk icon for DMG volume when macOS system icons aren't available.
This generates a simple external disk icon similar to macOS style.
"""

import sys
import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ Python PIL library not available")
    print("   Install with: pip3 install Pillow")
    sys.exit(1)

def create_disk_icon(output_dir):
    """Create disk icon in multiple sizes for iconset."""

    sizes = [16, 32, 64, 128, 256, 512]
    iconset_dir = Path(output_dir) / "disk.iconset"
    iconset_dir.mkdir(parents=True, exist_ok=True)

    for size in sizes:
        # Create standard resolution
        img = create_single_disk_icon(size)
        img.save(iconset_dir / f"icon_{size}x{size}.png", "PNG")

        # Create @2x resolution
        img2x = create_single_disk_icon(size * 2)
        img2x.save(iconset_dir / f"icon_{size}x{size}@2x.png", "PNG")

    print(f"✅ Generated disk iconset in {iconset_dir}")
    return str(iconset_dir)

def create_single_disk_icon(size):
    """Create a single disk icon at the specified size."""

    # Create transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Calculate dimensions
    margin = size // 10
    disk_width = size - (2 * margin)
    disk_height = int(disk_width * 0.7)  # Disk is wider than tall

    # Position disk in center
    x1 = margin
    y1 = (size - disk_height) // 2
    x2 = size - margin
    y2 = y1 + disk_height

    # Colors for disk appearance
    base_color = (160, 160, 165, 255)  # Gray metallic
    highlight_color = (200, 200, 205, 255)  # Lighter gray
    shadow_color = (120, 120, 125, 255)  # Darker gray
    edge_color = (100, 100, 105, 255)  # Dark edge

    # Draw main disk body with rounded corners
    corner_radius = size // 12

    # Shadow/3D effect
    shadow_offset = max(1, size // 100)
    draw.rounded_rectangle(
        [(x1 + shadow_offset, y1 + shadow_offset), (x2 + shadow_offset, y2 + shadow_offset)],
        radius=corner_radius,
        fill=(80, 80, 80, 128)  # Semi-transparent shadow
    )

    # Main disk body
    draw.rounded_rectangle(
        [(x1, y1), (x2, y2)],
        radius=corner_radius,
        fill=base_color,
        outline=edge_color,
        width=max(1, size // 50)
    )

    # Top highlight (simulate metallic reflection)
    highlight_height = disk_height // 3
    draw.rounded_rectangle(
        [(x1 + margin//2, y1 + margin//2),
         (x2 - margin//2, y1 + highlight_height)],
        radius=corner_radius // 2,
        fill=highlight_color
    )

    # Add a subtle gradient effect by drawing multiple thin rectangles
    gradient_steps = min(10, size // 20)
    for i in range(gradient_steps):
        alpha = int(255 * (1 - i / gradient_steps) * 0.3)
        gradient_y = y1 + highlight_height + (i * 2)
        if gradient_y < y2 - corner_radius:
            gradient_color = (*highlight_color[:3], alpha)
            draw.rectangle(
                [(x1 + corner_radius, gradient_y),
                 (x2 - corner_radius, gradient_y + 1)],
                fill=gradient_color
            )

    # Add USB/connection indicator (small rectangle on right)
    if size >= 32:  # Only on larger icons
        connector_width = max(4, size // 16)
        connector_height = max(6, size // 10)
        connector_x = x2 - 2
        connector_y = y1 + (disk_height - connector_height) // 2

        draw.rectangle(
            [(connector_x, connector_y),
             (connector_x + connector_width, connector_y + connector_height)],
            fill=shadow_color,
            outline=edge_color
        )

    # Add subtle texture/details for larger sizes
    if size >= 128:
        # Add some subtle horizontal lines for texture
        line_spacing = max(8, size // 32)
        line_y = y1 + highlight_height + line_spacing
        while line_y < y2 - corner_radius:
            draw.line(
                [(x1 + corner_radius, line_y), (x2 - corner_radius, line_y)],
                fill=(*shadow_color[:3], 30),
                width=1
            )
            line_y += line_spacing

    return img

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Create disk icon for DMG volume")
    parser.add_argument("output_dir", help="Output directory for iconset")

    args = parser.parse_args()

    try:
        iconset_path = create_disk_icon(args.output_dir)
        print(f"✅ Disk icon created successfully")
        print(f"   Location: {iconset_path}")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error creating disk icon: {e}")
        sys.exit(1)