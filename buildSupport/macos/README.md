# macOS Build Support

This directory contains all macOS-specific build configuration and assets for PNut-Term-TS.

## Directory Structure

```
buildSupport/macos/
├── README.md                       # This file
├── Info.plist                      # macOS app bundle information
├── entitlements.mac.plist          # App entitlements for code signing
├── entitlementsInherit.mac.plist   # Inherited entitlements for child processes
└── dmg/
    ├── README.md                   # DMG volume icon instructions
    ├── DMG-ASSETS-README.md        # DMG assets documentation
    └── source-assets/
        ├── iron-sheep-logo.png     # Iron Sheep Productions logo
        ├── propeller.ico           # Propeller icon
        └── create-dmg-volume-icon.html  # HTML tool for icon creation
```

## Configuration Files

### Info.plist
Extended app bundle information that supplements the Electron defaults. Referenced by `electron.builder.json`.

### Entitlements
- **entitlements.mac.plist**: Main app entitlements for hardened runtime
- **entitlementsInherit.mac.plist**: Entitlements inherited by child processes

Both are required for proper code signing and notarization on macOS.

## DMG Creation

See `dmg/README.md` for detailed instructions on creating DMG installers with custom volume icons.

### Quick Start
```bash
# Create all macOS packages (x64 + arm64)
npm run packageMac

# Or use the script directly
./scripts/create-macos-packages.sh
```

## Usage in Build System

These files are referenced in:
- `electron.builder.json` - Build configuration
- `scripts/create-macos-packages.sh` - Packaging script
- `scripts/sign-on-macos.sh` - Code signing script

## Requirements

- macOS system for building and signing
- Xcode Command Line Tools
- Valid Apple Developer certificate for code signing
- Node.js 18+ and npm

## Related Documentation

- [PACKAGING.md](/PACKAGING.md) - Complete packaging guide
- [dmg/README.md](dmg/README.md) - DMG volume icon setup
- [BUILD_ON_MACOS.md](/DOCs/project-specific/BUILD_ON_MACOS.md) - macOS-specific build notes
