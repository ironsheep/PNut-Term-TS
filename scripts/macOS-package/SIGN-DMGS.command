#!/bin/bash
# Sign DMG files for distribution

set -e

echo "🔐 PNut-Term-TS DMG Signing"
echo "============================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Auto-detect DMG files by pattern
echo "🔍 Auto-detecting DMG files..."
X64_DMG=""
ARM64_DMG=""

# Find x64 DMG by pattern
X64_DMG=$(find . -maxdepth 1 -type f -name "pnut-term-ts-macos-x64-*.dmg" | head -1)
if [ -n "$X64_DMG" ]; then
    X64_DMG=$(basename "$X64_DMG")
    echo "✅ Found x64 DMG: $X64_DMG"
else
    echo "⚠️  x64 DMG not found"
fi

# Find arm64 DMG by pattern
ARM64_DMG=$(find . -maxdepth 1 -type f -name "pnut-term-ts-macos-arm64-*.dmg" | head -1)
if [ -n "$ARM64_DMG" ]; then
    ARM64_DMG=$(basename "$ARM64_DMG")
    echo "✅ Found arm64 DMG: $ARM64_DMG"
else
    echo "⚠️  arm64 DMG not found"
fi

if [ -z "$X64_DMG" ] && [ -z "$ARM64_DMG" ]; then
    echo ""
    echo "❌ No DMG files found!"
    echo ""
    echo "Please run CREATE-STANDARD-DMGS.command first"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

echo ""
echo "🔑 Available signing identities:"
security find-identity -v -p codesigning | grep "Developer ID Application" || echo "   No Developer ID found"
echo ""

# Get the signing identity
IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk -F'"' '{print $2}')

if [ -z "$IDENTITY" ]; then
    echo "❌ No Developer ID Application certificate found!"
    echo ""
    echo "To sign DMGs, you need a Developer ID certificate from Apple."
    echo "Visit: https://developer.apple.com/account/resources/certificates"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

echo "📝 Will sign with: $IDENTITY"
echo ""

# Function to sign a DMG
sign_dmg() {
    local DMG_FILE=$1
    local ARCH=$2

    echo "🔏 Signing $ARCH DMG..."

    # Sign the DMG
    codesign --force --sign "$IDENTITY" \
        --options runtime \
        --timestamp \
        "$DMG_FILE"

    # Verify the signature
    echo "🔍 Verifying signature..."
    codesign --verify --verbose=2 "$DMG_FILE"

    echo "✅ $ARCH DMG signed successfully!"
    echo ""
}

# Sign x64 DMG if present
if [ -n "$X64_DMG" ]; then
    sign_dmg "$X64_DMG" "x64"
fi

# Sign arm64 DMG if present
if [ -n "$ARM64_DMG" ]; then
    sign_dmg "$ARM64_DMG" "arm64"
fi

echo "=========================================="
echo "✅ DMG signing complete!"
echo "=========================================="
echo ""
echo "📦 Signed DMGs:"
[ -n "$X64_DMG" ] && echo "   - $X64_DMG"
[ -n "$ARM64_DMG" ] && echo "   - $ARM64_DMG"
echo ""
echo "🎯 Next step: Run NOTARIZE-AND-STAPLE.command"
echo ""
echo "Press any key to exit..."
read -n 1 -s