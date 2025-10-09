# DMG Volume Icon Setup Instructions

## Overview
The DMG volume icon is a composite image that combines the macOS external drive icon with the PNut-Term-TS application icon overlaid in the center. This provides a professional appearance when the DMG is mounted.

## Prerequisites
- macOS system (for running the icon creation script)
- Python 3 with Pillow library (optional, for Linux generation)

## Method 1: Using macOS Script (Recommended)

Run on a Mac to generate the composite volume icon:

```bash
# Run the volume icon creation script
./scripts/create-volume-icon.sh
```

This script will:
1. Extract the system external drive icon from macOS
2. Extract the PNut-Term-TS app icon from `assets/icon.icns`
3. Overlay the app icon at 40% size in the center of the disk icon
4. Generate `dmg-assets/VolumeIcon.icns`

## Method 2: Using Python Script (Linux/Cross-platform)

For generating a placeholder icon on non-macOS systems:

```bash
# Install Python dependencies
pip3 install Pillow

# Run the Linux-compatible script
python3 scripts/create-volume-icon-linux.py
```

This will create:
- `dmg-assets/VolumeIcon.png` - PNG version of the composite icon
- `dmg-assets/VolumeIcon.iconset/` - Individual size PNG files
- Instructions for converting to .icns format on macOS

## Converting PNG to ICNS (macOS only)

If you generated the icon on Linux, convert it to .icns on macOS:

```bash
# On macOS, convert the iconset to .icns
iconutil -c icns -o dmg-assets/VolumeIcon.icns dmg-assets/VolumeIcon.iconset
```

## Automatic Application

The volume icon is automatically applied when creating DMGs:

```bash
# The DMG creation scripts automatically detect and use the volume icon
./release/macos-package/CREATE-STANDARD-DMGS.command
```

The scripts check for:
- `dmg-assets/VolumeIcon.icns` (primary location)
- `release/macos-package/VolumeIcon.icns` (fallback)

## Manual Testing

To verify the icon is working:

1. Create a DMG using the standard scripts
2. Mount the DMG
3. Check that the mounted volume shows the custom icon in Finder

## Troubleshooting

If the icon doesn't appear:
1. Ensure the .icns file exists in `dmg-assets/`
2. Check that SetFile command is available (part of Xcode Command Line Tools)
3. Try the alternative xattr method if SetFile isn't available
4. Rebuild the DMG after placing the icon file

## Icon Design

The composite icon consists of:
- **Base**: macOS standard external disk icon (gray/silver disk shape)
- **Overlay**: PNut-Term-TS propeller icon at 40% of disk size, centered
- **Sizes**: Full iconset from 16x16 to 512x512 with @2x retina versions

## Files Created

- `dmg-assets/VolumeIcon.icns` - The final composite icon (macOS)
- `dmg-assets/.VolumeIcon.icns` - Hidden version for DMG usage
- `dmg-assets/VolumeIcon.png` - PNG version (if generated on Linux)
- `dmg-assets/VolumeIcon.iconset/` - Individual size PNGs

## Integration

The volume icon is automatically integrated into the DMG creation process. No additional configuration is required once the icon files are in place.