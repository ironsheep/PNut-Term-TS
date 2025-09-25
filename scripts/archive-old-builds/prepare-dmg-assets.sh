#!/bin/bash

# Prepare visual assets for DMG packaging
# Uses the logos provided in DOCs/images/

echo "🎨 Preparing DMG Visual Assets"
echo "==============================="

ASSETS_DIR="buildSupport/dmg-assets"
IMAGES_DIR="DOCs/images"

# Create assets directory
mkdir -p "$ASSETS_DIR"

echo "📸 Processing logos..."

# Copy Iron Sheep logo (already perfect size at 132x132)
if [ -f "$IMAGES_DIR/ISP-FinalLogoV5-m-sheepOnly-132x132.png" ]; then
    cp "$IMAGES_DIR/ISP-FinalLogoV5-m-sheepOnly-132x132.png" "$ASSETS_DIR/iron-sheep-logo.png"
    echo "✅ Iron Sheep logo copied (132x132)"
fi

# Copy Propeller icon (ICO format)
if [ -f "$IMAGES_DIR/Propeller.ico" ]; then
    cp "$IMAGES_DIR/Propeller.ico" "$ASSETS_DIR/propeller.ico"
    echo "✅ Propeller icon copied"
    
    # Note: On macOS, you can convert ICO to ICNS with:
    # sips -s format icns Propeller.ico --out propeller.icns
fi

# Create Python script to generate DMG background
cat > "$ASSETS_DIR/create-dmg-background.py" << 'EOF'
#!/usr/bin/env python3
"""
Create custom DMG background image (600x400) with logos and branding
"""
import sys

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    import os
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sheep_logo_path = os.path.join(script_dir, "iron-sheep-logo.png")
    
    # Create base image (600x400) with gradient background
    width, height = 600, 400
    img = Image.new('RGB', (width, height), color='#1E3A5F')
    draw = ImageDraw.Draw(img)
    
    # Create gradient effect (darker at edges)
    for i in range(50):
        alpha = int(255 * (i / 50))
        color = (30 + i, 58 + i, 95 + i)  # Gradient from darker to lighter blue
        draw.rectangle([(i, i), (width-i, height-i)], outline=color)
    
    # Load and place Iron Sheep logo (top left corner, small)
    if os.path.exists(sheep_logo_path):
        sheep_logo = Image.open(sheep_logo_path)
        # Resize to 60x60 for subtle branding
        sheep_logo = sheep_logo.resize((60, 60), Image.Resampling.LANCZOS)
        # Make semi-transparent
        sheep_logo.putalpha(180)
        img.paste(sheep_logo, (20, 20), sheep_logo)
        print("  ✓ Added Iron Sheep logo")
    
    # Try to use better fonts
    title_font = None
    subtitle_font = None
    instruction_font = None
    credit_font = None
    
    try:
        # Try macOS system fonts
        title_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 42)
        subtitle_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
        instruction_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
        credit_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 11)
    except:
        try:
            # Try Linux fonts
            title_font = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 42)
            subtitle_font = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 14)
            instruction_font = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 18)
            credit_font = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 11)
        except:
            # Fallback to default
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            instruction_font = ImageFont.load_default()
            credit_font = ImageFont.load_default()
            print("  ⚠ Using default fonts")
    
    # Add title text with shadow effect
    title = "PNut-Term-TS"
    subtitle = "Debug Terminal for Propeller 2"
    
    # Draw shadow for title
    draw.text((302, 82), title, fill=(0, 0, 0, 80), font=title_font, anchor='mm')
    # Draw title
    draw.text((300, 80), title, fill=(255, 255, 255, 240), font=title_font, anchor='mm')
    
    # Draw subtitle
    draw.text((300, 115), subtitle, fill=(200, 220, 255, 220), font=subtitle_font, anchor='mm')
    
    # Draw installation arrow (stylized)
    arrow_y = 200
    arrow_color = (255, 255, 255, 200)
    
    # Arrow shaft with gradient
    for i in range(3):
        alpha = 200 - (i * 30)
        draw.line([(150, arrow_y + i), (420, arrow_y + i)], 
                  fill=(255, 255, 255, alpha), width=1)
    
    # Arrowhead
    points = [(420, arrow_y-8), (420, arrow_y+8), (435, arrow_y)]
    draw.polygon(points, fill=arrow_color)
    
    # Add app icon placeholder (left side of arrow)
    app_box = [(120, 170), (180, 230)]
    draw.rounded_rectangle(app_box, radius=10, outline=(255, 255, 255, 150), width=2)
    draw.text((150, 200), "App", fill=(255, 255, 255, 180), font=subtitle_font, anchor='mm')
    
    # Add Applications folder icon (right side of arrow)
    folder_box = [(440, 170), (500, 230)]
    draw.rounded_rectangle(folder_box, radius=10, outline=(255, 255, 255, 150), width=2)
    draw.text((470, 200), "Apps", fill=(255, 255, 255, 180), font=subtitle_font, anchor='mm')
    
    # Installation instruction
    draw.text((300, 260), "Drag to Applications folder to install", 
              fill=(255, 255, 255, 230), font=instruction_font, anchor='mm')
    
    # Add version info (bottom left)
    version_text = "Version 0.1.0"
    draw.text((30, 370), version_text, fill=(150, 170, 200, 180), 
              font=credit_font, anchor='lm')
    
    # Add credits (bottom center)
    credits = "Iron Sheep Productions, LLC"
    draw.text((300, 350), credits, fill=(180, 200, 230, 200), 
              font=credit_font, anchor='mm')
    
    # Add Parallax credit (bottom)
    parallax_text = "for Parallax Inc."
    draw.text((300, 365), parallax_text, fill=(180, 200, 230, 200), 
              font=credit_font, anchor='mm')
    
    # Add decorative propeller icon (simple drawing)
    prop_x, prop_y = 300, 320
    prop_color = (200, 220, 255, 120)
    
    # Draw simple propeller blades
    for angle in [0, 120, 240]:
        import math
        rad = math.radians(angle)
        # Blade positions
        x1 = prop_x + 15 * math.cos(rad)
        y1 = prop_y + 15 * math.sin(rad)
        x2 = prop_x + 5 * math.cos(rad)
        y2 = prop_y + 5 * math.sin(rad)
        # Draw blade
        draw.ellipse([x1-6, y1-6, x1+6, y1+6], fill=prop_color, outline=None)
        draw.line([(x2, y2), (x1, y1)], fill=prop_color, width=2)
    
    # Center hub
    draw.ellipse([prop_x-4, prop_y-4, prop_x+4, prop_y+4], 
                 fill=(255, 255, 255, 150), outline=None)
    
    # Save the image
    output_path = os.path.join(script_dir, 'dmg-background.png')
    img.save(output_path, 'PNG')
    print(f"✅ Created DMG background: {output_path}")
    
    # Also create a smaller version for preview
    preview = img.resize((300, 200), Image.Resampling.LANCZOS)
    preview_path = os.path.join(script_dir, 'dmg-background-preview.png')
    preview.save(preview_path, 'PNG')
    print(f"✅ Created preview: {preview_path}")
    
except ImportError as e:
    print(f"❌ Error: Missing required module - {e}")
    print("   Install with: pip install pillow")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error creating background: {e}")
    sys.exit(1)
EOF

# Try to create the background
echo ""
echo "🖼️  Creating DMG background..."
if command -v python3 &> /dev/null && python3 -c "import PIL" 2>/dev/null; then
    python3 "$ASSETS_DIR/create-dmg-background.py"
else
    echo "⚠️  Python PIL not available"
    echo "   To create custom background: pip install pillow"
    echo "   Skipping background generation"
fi

# Create ICNS conversion script for macOS
cat > "$ASSETS_DIR/create-icns.sh" << 'EOF'
#!/bin/bash
# Run this on macOS to create ICNS files from ICO

echo "Converting icons to ICNS format (macOS only)..."

# Convert Propeller.ico to ICNS
if [ -f "propeller.ico" ]; then
    sips -s format icns propeller.ico --out app-icon.icns
    echo "✅ Created app-icon.icns"
fi

# Create volume icon from Iron Sheep logo
if [ -f "iron-sheep-logo.png" ]; then
    # Create iconset directory
    mkdir -p volume.iconset
    
    # Generate different sizes
    sips -z 16 16 iron-sheep-logo.png --out volume.iconset/icon_16x16.png
    sips -z 32 32 iron-sheep-logo.png --out volume.iconset/icon_16x16@2x.png
    sips -z 32 32 iron-sheep-logo.png --out volume.iconset/icon_32x32.png
    sips -z 64 64 iron-sheep-logo.png --out volume.iconset/icon_32x32@2x.png
    sips -z 128 128 iron-sheep-logo.png --out volume.iconset/icon_128x128.png
    sips -z 256 256 iron-sheep-logo.png --out volume.iconset/icon_128x128@2x.png
    sips -z 256 256 iron-sheep-logo.png --out volume.iconset/icon_256x256.png
    sips -z 512 512 iron-sheep-logo.png --out volume.iconset/icon_256x256@2x.png
    sips -z 512 512 iron-sheep-logo.png --out volume.iconset/icon_512x512.png
    cp iron-sheep-logo.png volume.iconset/icon_512x512@2x.png
    
    # Convert to ICNS
    iconutil -c icns volume.iconset
    rm -rf volume.iconset
    echo "✅ Created volume.icns"
fi
EOF
chmod +x "$ASSETS_DIR/create-icns.sh"

echo ""
echo "📦 DMG Assets Summary:"
echo "====================="
ls -la "$ASSETS_DIR/"
echo ""
echo "🎯 Next steps:"
echo "1. On macOS, run: $ASSETS_DIR/create-icns.sh"
echo "2. Review dmg-background.png and adjust if needed"
echo "3. Use these assets with DropDMG:"
echo "   - Background: $ASSETS_DIR/dmg-background.png"
echo "   - App Icon: $ASSETS_DIR/app-icon.icns (after conversion)"
echo "   - Volume Icon: $ASSETS_DIR/volume.icns (after conversion)"
echo ""
echo "🎨 Assets are ready for professional DMG creation!"