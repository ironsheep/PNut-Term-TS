#!/usr/bin/env python3
"""
Add rounded corners to an icon for macOS style
"""

from PIL import Image, ImageDraw
import sys
import os

def add_rounded_corners(image_path, output_path, radius_percent=20):
    """
    Add rounded corners to an image

    Args:
        image_path: Path to input image
        output_path: Path to output image
        radius_percent: Corner radius as percentage of image size (0-50)
    """
    # Open the image
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size

    # Calculate radius based on percentage of smaller dimension
    radius = int(min(width, height) * radius_percent / 100)

    # Create a mask for rounded corners
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)

    # Draw rounded rectangle on mask
    draw.rounded_rectangle(
        [(0, 0), (width, height)],
        radius=radius,
        fill=255
    )

    # Create output image with transparent background
    output = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    output.paste(img, (0, 0))

    # Apply the mask
    output.putalpha(mask)

    # Save the result
    output.save(output_path, 'PNG')
    print(f"Created rounded corner image: {output_path}")
    print(f"  Size: {width}x{height}")
    print(f"  Corner radius: {radius}px ({radius_percent}% of {min(width, height)}px)")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 add-rounded-corners.py <input_image> [output_image] [radius_percent]")
        print("  input_image: Path to input PNG")
        print("  output_image: Optional output path (default: adds -rounded suffix)")
        print("  radius_percent: Optional corner radius as % of size (default: 20)")
        sys.exit(1)

    input_path = sys.argv[1]

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    # Determine output path
    if len(sys.argv) > 2:
        output_path = sys.argv[2]
    else:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}-rounded{ext}"

    # Get radius percentage
    radius_percent = 20  # Default for macOS style
    if len(sys.argv) > 3:
        try:
            radius_percent = int(sys.argv[3])
            if not 0 <= radius_percent <= 50:
                print("Error: Radius percent must be between 0 and 50")
                sys.exit(1)
        except ValueError:
            print("Error: Invalid radius percentage")
            sys.exit(1)

    try:
        add_rounded_corners(input_path, output_path, radius_percent)
    except Exception as e:
        print(f"Error processing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()