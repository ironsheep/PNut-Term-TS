#!/usr/bin/env python3
"""
Create a composite DMG volume icon by overlaying the app icon on a disk icon.
This script works on Linux and can generate a placeholder icon for DMG packaging.
"""

import os
import sys
import subprocess
from pathlib import Path

def check_dependencies():
    """Check if required tools are available."""
    has_imagemagick = subprocess.run(['which', 'convert'], capture_output=True).returncode == 0
    has_pil = False

    try:
        from PIL import Image, ImageDraw
        has_pil = True
    except ImportError:
        pass

    return has_imagemagick, has_pil

def create_disk_icon_placeholder(output_path, size=512):
    """Create a simple disk icon placeholder using PIL."""
    try:
        from PIL import Image, ImageDraw

        # Create a new RGBA image
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw a disk shape (rounded rectangle)
        margin = size // 10
        disk_color = (200, 200, 200, 255)  # Light gray
        shadow_color = (100, 100, 100, 128)  # Dark gray with transparency

        # Draw shadow
        shadow_offset = size // 50
        draw.rounded_rectangle(
            [(margin + shadow_offset, margin + shadow_offset),
             (size - margin + shadow_offset, size - margin + shadow_offset)],
            radius=size // 20,
            fill=shadow_color
        )

        # Draw main disk body
        draw.rounded_rectangle(
            [(margin, margin), (size - margin, size - margin)],
            radius=size // 20,
            fill=disk_color
        )

        # Add a highlight
        highlight_color = (255, 255, 255, 100)
        draw.rounded_rectangle(
            [(margin, margin), (size - margin, size // 2)],
            radius=size // 20,
            fill=highlight_color
        )

        # Draw disk label area
        label_margin = size // 5
        label_color = (240, 240, 240, 255)
        draw.rectangle(
            [(label_margin, size // 3), (size - label_margin, size * 2 // 3)],
            fill=label_color
        )

        # Add some disk details (lines)
        line_color = (180, 180, 180, 255)
        for i in range(3):
            y = size // 3 + (i + 1) * size // 12
            draw.line(
                [(label_margin + 10, y), (size - label_margin - 10, y)],
                fill=line_color,
                width=1
            )

        img.save(output_path, 'PNG')
        return True
    except Exception as e:
        print(f"Error creating disk placeholder: {e}")
        return False

def create_composite_icon(app_icon_path, output_path):
    """Create composite icon with app icon overlaid on disk icon."""
    try:
        from PIL import Image

        # Create or load disk icon
        disk_icon_path = '/tmp/disk_icon.png'
        if not create_disk_icon_placeholder(disk_icon_path, 512):
            print("Failed to create disk icon")
            return False

        # Load the disk icon
        disk_img = Image.open(disk_icon_path).convert('RGBA')
        base_size = disk_img.size[0]

        # Load and resize app icon
        if Path(app_icon_path).suffix.lower() == '.png':
            app_img = Image.open(app_icon_path).convert('RGBA')
        elif Path(app_icon_path).suffix.lower() == '.icns':
            # Try to extract PNG from icns using iconutil (macOS) or icns2png
            png_path = '/tmp/app_icon.png'

            # Try different methods to extract PNG from ICNS
            if subprocess.run(['which', 'icns2png'], capture_output=True).returncode == 0:
                subprocess.run(['icns2png', '-x', app_icon_path], cwd='/tmp')
                # Find the largest extracted PNG
                pngs = list(Path('/tmp').glob('*_512x512*.png'))
                if not pngs:
                    pngs = list(Path('/tmp').glob('*_256x256*.png'))
                if pngs:
                    app_img = Image.open(pngs[0]).convert('RGBA')
                else:
                    print(f"Could not extract PNG from {app_icon_path}")
                    return False
            else:
                # Fallback: use ImageMagick to extract first image
                result = subprocess.run(
                    ['convert', f'{app_icon_path}[0]', png_path],
                    capture_output=True
                )
                if result.returncode == 0:
                    app_img = Image.open(png_path).convert('RGBA')
                else:
                    print(f"Could not convert {app_icon_path} to PNG")
                    # Try to use the PNG version if it exists
                    png_alt = app_icon_path.replace('.icns', '.png')
                    if Path(png_alt).exists():
                        app_img = Image.open(png_alt).convert('RGBA')
                    else:
                        return False
        else:
            print(f"Unsupported icon format: {app_icon_path}")
            return False

        # Resize app icon to 40% of disk icon size
        overlay_size = int(base_size * 0.4)
        app_img = app_img.resize((overlay_size, overlay_size), Image.Resampling.LANCZOS)

        # Calculate position (center)
        x = (base_size - overlay_size) // 2
        y = (base_size - overlay_size) // 2

        # Composite the images
        disk_img.paste(app_img, (x, y), app_img)

        # Save as PNG
        disk_img.save(output_path, 'PNG')

        # Also save as multiple sizes for iconset
        sizes = [16, 32, 64, 128, 256, 512]
        iconset_dir = Path(output_path).parent / 'VolumeIcon.iconset'
        iconset_dir.mkdir(exist_ok=True)

        for size in sizes:
            resized = disk_img.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(iconset_dir / f'icon_{size}x{size}.png', 'PNG')

            # Also create @2x versions for retina
            if size <= 256:
                size2x = size * 2
                resized2x = disk_img.resize((size2x, size2x), Image.Resampling.LANCZOS)
                resized2x.save(iconset_dir / f'icon_{size}x{size}@2x.png', 'PNG')

        print(f"✅ Created composite icon: {output_path}")
        print(f"✅ Created iconset in: {iconset_dir}")

        # Clean up temp files
        if Path(disk_icon_path).exists():
            os.remove(disk_icon_path)

        return True

    except Exception as e:
        print(f"Error creating composite icon: {e}")
        return False

def main():
    """Main function."""
    print("🎨 Creating DMG Volume Icon (Linux Version)")
    print("=" * 45)

    # Check dependencies
    has_imagemagick, has_pil = check_dependencies()

    if not has_pil:
        print("❌ Python PIL/Pillow is required but not installed")
        print("   Install with: pip install Pillow")
        sys.exit(1)

    # Set up paths
    script_dir = Path(__file__).parent.absolute()
    project_root = script_dir.parent
    output_dir = project_root / 'dmg-assets'
    output_dir.mkdir(exist_ok=True)

    # Find app icon
    app_icon_candidates = [
        project_root / 'assets' / 'icon.png',
        project_root / 'assets' / 'icon.icns',
        project_root / 'extracted-icons' / 'app-icon-set' / 'PNutTermTS.icns',
    ]

    app_icon = None
    for candidate in app_icon_candidates:
        if candidate.exists():
            app_icon = candidate
            print(f"📍 Found app icon: {app_icon}")
            break

    if not app_icon:
        print("❌ Could not find app icon")
        print("   Looked for:")
        for candidate in app_icon_candidates:
            print(f"   - {candidate}")
        sys.exit(1)

    # Create the composite icon
    output_path = output_dir / 'VolumeIcon.png'

    if create_composite_icon(str(app_icon), str(output_path)):
        # Also create hidden version
        import shutil
        hidden_path = output_dir / '.VolumeIcon.png'
        shutil.copy(output_path, hidden_path)

        print()
        print("✨ Volume icon creation complete!")
        print()
        print("📝 Created files:")
        print(f"   - {output_path}")
        print(f"   - {hidden_path}")
        print(f"   - {output_dir}/VolumeIcon.iconset/")
        print()
        print("📝 To convert to .icns on macOS, run:")
        print(f"   iconutil -c icns -o {output_dir}/VolumeIcon.icns {output_dir}/VolumeIcon.iconset")
        print()
        print("📝 The icon will be automatically used when creating DMGs")
    else:
        print("❌ Failed to create composite icon")
        sys.exit(1)

if __name__ == '__main__':
    main()