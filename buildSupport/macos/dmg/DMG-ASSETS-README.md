# DMG Assets Directory

This directory contains visual assets for creating professional DMG packages.

## Required Files:

1. **dmg-background.png** (600x400px)
   - Background image for DMG window
   - Should include PNut-Term-TS branding
   - Drag arrow from app to Applications
   - Parallax and Iron Sheep Productions credits

2. **app-icon.icns** 
   - Application icon in Apple Icon format
   - Should include propeller logo

3. **volume-icon.icns**
   - Icon for the mounted DMG volume
   - Usually same as app icon

## Color Scheme:
- Parallax Blue: #1E3A5F
- Text: White/Light gray
- Accents: Parallax green (#00C851)

## Creating Icons:
```bash
# Convert PNG to ICNS (on macOS):
iconutil -c icns icon.iconset
```

## DropDMG Templates:
Store DropDMG configuration templates here for consistent builds.