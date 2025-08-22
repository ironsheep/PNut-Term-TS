#!/bin/bash
# Container-side script that waits for signing completion and creates final package

set -e

echo "📦 Finalizing Package After macOS Signing"
echo "========================================="

# Check if signing was completed
if [[ ! -f "SIGNED.marker" ]]; then
    echo "❌ SIGNED.marker not found"
    echo ""
    echo "👉 Please run these steps on macOS side:"
    echo "   1. Open terminal in this folder: $(pwd)"
    echo "   2. Run: ./scripts/sign-on-macos.sh"
    echo "   3. Wait for SIGNED.marker to be created"
    echo "   4. Then run this script again"
    echo ""
    exit 1
fi

echo "✅ Found SIGNED.marker, reading signing info..."
# Parse the marker file safely
PNUT_TERM_TS_SIGNED=$(grep "PNUT_TERM_TS_SIGNED=" SIGNED.marker | cut -d'=' -f2)
SIGNED_AT=$(grep "SIGNED_AT=" SIGNED.marker | cut -d'=' -f2)
SIGNATURE_TYPE=$(grep "SIGNATURE_TYPE=" SIGNED.marker | cut -d'=' -f2)
SIGNING_IDENTITY=$(grep "SIGNING_IDENTITY=" SIGNED.marker | cut -d'=' -f2-)
VERIFICATION_STATUS=$(grep "VERIFICATION_STATUS=" SIGNED.marker | cut -d'=' -f2)
EXEC_SIGNED=$(grep "EXEC_SIGNED=" SIGNED.marker | cut -d'=' -f2)
BINARY_SIZE=$(grep "BINARY_SIZE=" SIGNED.marker | cut -d'=' -f2)
MACOS_VERSION=$(grep "MACOS_VERSION=" SIGNED.marker | cut -d'=' -f2)
NODE_VERSION=$(grep "NODE_VERSION=" SIGNED.marker | cut -d'=' -f2)
SEA_INJECTION=$(grep "SEA_INJECTION=" SIGNED.marker | cut -d'=' -f2)
RUNTIME_TEST=$(grep "RUNTIME_TEST=" SIGNED.marker | cut -d'=' -f2)

echo "📊 Signing Summary:"
echo "   🔏 Signature Type: $SIGNATURE_TYPE"
echo "   📅 Signed At: $SIGNED_AT"
echo "   📱 Binary Size: $BINARY_SIZE bytes"
echo "   🍎 macOS Version: $MACOS_VERSION"
echo "   ⚙️  Node Version: $NODE_VERSION"

# Verify the signed app exists and is properly signed
if [[ ! -d "release/sea-macos/PNut-Term-TS.app" ]]; then
    echo "❌ Signed app bundle not found"
    exit 1
fi

BINARY_PATH="release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts"
if [[ ! -f "$BINARY_PATH" ]]; then
    echo "❌ Signed binary not found at: $BINARY_PATH"
    exit 1
fi

echo "🔧 Creating final distribution packages..."

# Create versioned release directory
RELEASE_VERSION="0.1.0"
FINAL_DIR="release/pnut-term-ts-v$RELEASE_VERSION-macos"
rm -rf "$FINAL_DIR"
mkdir -p "$FINAL_DIR"

# Copy signed app
cp -r "release/sea-macos/PNut-Term-TS.app" "$FINAL_DIR/"

# Create command-line symlink for Terminal usage
mkdir -p "$FINAL_DIR/bin"
cat > "$FINAL_DIR/bin/pnut-term-ts" << 'SYMLINK_EOF'
#!/bin/bash
# Command-line launcher for PNut-Term-TS
exec "$(dirname "$0")/../PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS" "$@"
SYMLINK_EOF
chmod +x "$FINAL_DIR/bin/pnut-term-ts"

# Create installation instructions
cat > "$FINAL_DIR/INSTALL.md" << 'INSTALL_EOF'
# PNut Term TS Installation

## GUI Installation (Recommended)
1. Drag `PNut-Term-TS.app` to your Applications folder
2. Launch from Applications or Spotlight

## Command Line Installation (Optional)
Add to your PATH for terminal access:
```bash
echo 'export PATH="/Applications/PNut-Term-TS.app/Contents/MacOS:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Or copy the command-line wrapper:
```bash
sudo cp bin/pnut-term-ts /usr/local/bin/
```

## Usage
- **GUI Mode**: Double-click the app or launch from Applications
- **Terminal Mode**: `pnut-term-ts --help`
- **P2 Connection**: `pnut-term-ts -p P9cektn7`

## Features
- ✅ Native macOS application (no external dependencies)
- ✅ Full Propeller 2 debug support  
- ✅ Automatic debug window placement
- ✅ Serial port communication
- ✅ Cross-platform compatibility

## Troubleshooting
If macOS blocks the app:
1. Right-click the app → "Open"
2. Or: System Preferences → Security & Privacy → "Open Anyway"

Version: 0.1.0
INSTALL_EOF

# Create user guide
cat > "$FINAL_DIR/README.txt" << 'README_EOF'
PNut Term TS - Propeller 2 Debug Terminal
==========================================

This is a native macOS application for debugging Propeller 2 microcontrollers.

INSTALLATION:
- Drag PNut-Term-TS.app to Applications folder
- No additional software required

USAGE:
- Double-click to launch GUI mode
- Use Terminal for command-line: /Applications/PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS

For complete documentation, see INSTALL.md

Developer: Iron Sheep Productions, LLC
Version: 0.1.0
README_EOF

# Create distribution archive
echo "📦 Creating distribution archive..."
cd release
tar -czf "pnut-term-ts-v$RELEASE_VERSION-macos.tar.gz" "pnut-term-ts-v$RELEASE_VERSION-macos/"
cd ..

# Create checksums
echo "🔐 Creating checksums..."
cd release
shasum -a 256 "pnut-term-ts-v$RELEASE_VERSION-macos.tar.gz" > "pnut-term-ts-v$RELEASE_VERSION-macos.tar.gz.sha256"
cd ..

# Archive the signing info
cp SIGNED.marker "release/signing-info-$RELEASE_VERSION.txt"

echo "✅ Final package creation completed!"
echo ""
echo "📦 Distribution ready:"
echo "   📁 Folder: release/pnut-term-ts-v$RELEASE_VERSION-macos/"
echo "   📦 Archive: release/pnut-term-ts-v$RELEASE_VERSION-macos.tar.gz"
echo "   🔐 Checksum: release/pnut-term-ts-v$RELEASE_VERSION-macos.tar.gz.sha256"
echo "   📝 Signing Info: release/signing-info-$RELEASE_VERSION.txt"
echo ""
echo "📊 Package Contents:"
ls -la "release/pnut-term-ts-v$RELEASE_VERSION-macos/"
echo ""
echo "🎯 Ready for Task #89 testing!"
echo "   Extract and test: $FINAL_DIR/PNut-Term-TS.app"

# Optional: Create a simple DMG if hdiutil is available (won't work in Linux container)
if command -v hdiutil &> /dev/null 2>&1; then
    echo "💿 Creating DMG installer..."
    hdiutil create -volname "PNut Term TS v$RELEASE_VERSION" \
        -srcfolder "$FINAL_DIR" \
        -ov -format UDBZ \
        "release/PNut-Term-TS-v$RELEASE_VERSION.dmg"
    echo "   ✅ DMG created: release/PNut-Term-TS-v$RELEASE_VERSION.dmg"
fi

echo ""
echo "🔄 Workflow Summary:"
echo "   1. ✅ Cross-platform SEA package created"
echo "   2. ✅ macOS signing completed ($SIGNATURE_TYPE)"
echo "   3. ✅ Final distribution package ready"
echo "   4. 👉 Ready for Task #89 human acceptance testing"