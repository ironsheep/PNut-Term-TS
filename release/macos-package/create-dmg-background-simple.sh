#!/bin/bash
# Create DMG background image using native macOS tools (simplified version)

set -e

echo "🎨 Creating DMG Background Image (Simple Version)"
echo "================================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create a simple Python script to generate the image using PIL (if available)
# Most macOS systems have Python with PIL/Pillow
cat > create_bg.py << 'PYTHON_EOF'
#!/usr/bin/env python3
import sys

try:
    from PIL import Image, ImageDraw, ImageFont

    # Create image
    width, height = 500, 300
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)

    # Create gradient background (simplified)
    for y in range(height):
        # Gradient from purple to blue
        r = int(102 + (118 - 102) * y / height)
        g = int(126 + (75 - 126) * y / height)
        b = int(234 + (162 - 234) * y / height)
        draw.rectangle([(0, y), (width, y+1)], fill=(r, g, b))

    # Draw arrow only (no icon placeholders)
    draw.polygon([(220, 150), (270, 150), (270, 145), (280, 150), (270, 155), (270, 150)], fill='white')
    draw.rectangle([(220, 148), (270, 152)], fill='white')

    # Add text
    draw.text((250, 30), "PNut-Term-TS", fill='white', anchor="mm")
    draw.text((250, 50), "by Iron Sheep Productions, LLC", fill='white', anchor="mm")
    draw.text((250, 260), "Drag to Applications Folder to Install", fill='white', anchor="mm")

    img.save('dmg-background.png')
    print("✅ Background created with Python PIL")

except ImportError:
    print("❌ PIL/Pillow not available")
    sys.exit(1)
PYTHON_EOF

echo "🐍 Trying Python with PIL..."
if python3 create_bg.py 2>/dev/null; then
    rm create_bg.py
    echo ""
    echo "✅ DMG background created successfully!"
    echo "   File: dmg-background.png (500x300)"
else
    echo "⚠️  Python PIL not available, creating with sips..."

    # Create a basic image using sips (built into macOS)
    # First create an HTML file and render it
    cat > dmg-background.html << 'HTML_EOF'
<!DOCTYPE html>
<html>
<head>
<style>
body {
    margin: 0;
    width: 500px;
    height: 300px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    color: white;
    position: relative;
}
.title {
    position: absolute;
    top: 30px;
    width: 100%;
    text-align: center;
    font-size: 24px;
    font-weight: bold;
}
.company {
    position: absolute;
    top: 58px;
    width: 100%;
    text-align: center;
    font-size: 12px;
    opacity: 0.8;
}
.instruction {
    position: absolute;
    bottom: 40px;
    width: 100%;
    text-align: center;
    font-size: 18px;
}
.arrow {
    position: absolute;
    left: 200px;
    top: 140px;
    width: 100px;
    height: 20px;
}
.arrow::before {
    content: '→';
    font-size: 40px;
    color: white;
}
</style>
</head>
<body>
<div class="title">PNut-Term-TS</div>
<div class="company">by Iron Sheep Productions, LLC</div>
<div class="arrow"></div>
<div class="instruction">Drag to Applications Folder to Install</div>
</body>
</html>
HTML_EOF

    echo "📷 Opening in Safari and capturing..."

    # Open in Safari
    open -a Safari dmg-background.html

    echo "⏳ Waiting for page to load..."
    sleep 3

    # Use screencapture with specific window bounds
    osascript << 'APPLESCRIPT_EOF'
tell application "Safari"
    set allWindows to every window
    repeat with aWindow in allWindows
        set currentURL to URL of current tab of aWindow
        if currentURL contains "dmg-background.html" then
            -- Set exact window size
            set bounds of aWindow to {100, 100, 600, 400}
            activate
            delay 1

            -- Take screenshot of just the content area
            do shell script "screencapture -c -x -R100,122,500,300"

            -- Save from clipboard
            do shell script "osascript -e 'set png_data to the clipboard as «class PNGf»' -e 'set the_file to open for access POSIX file \"/tmp/dmg-bg-temp.png\" with write permission' -e 'write png_data to the_file' -e 'close access the_file'"

            -- Close the Safari tab
            close current tab of aWindow

            exit repeat
        end if
    end repeat
end tell
APPLESCRIPT_EOF

    if [ -f "/tmp/dmg-bg-temp.png" ]; then
        mv /tmp/dmg-bg-temp.png dmg-background.png
        echo "✅ Screenshot captured and cropped"
        rm -f dmg-background.html
    else
        echo "❌ Screenshot capture failed"
        echo ""
        echo "📝 Manual steps required:"
        echo "1. Open dmg-background.html in Safari"
        echo "2. Resize window to show exactly 500x300 content"
        echo "3. Take a screenshot (Cmd+Shift+4)"
        echo "4. Save as dmg-background.png"
    fi

    rm -f create_bg.py
fi

if [ -f "dmg-background.png" ]; then
    echo ""
    echo "=========================================="
    echo "✅ DMG Background Ready!"
    echo "=========================================="
    echo ""
    echo "Background image: dmg-background.png"
    echo ""
    echo "🎯 Next step: Run CREATE-STANDARD-DMGS.command"
    echo "   The script will use this background automatically"
else
    echo ""
    echo "⚠️  Background image creation needs manual completion"
fi

echo ""
echo "Press any key to exit..."
read -n 1 -s