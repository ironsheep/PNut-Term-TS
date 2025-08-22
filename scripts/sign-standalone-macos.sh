#!/bin/bash
# scripts/sign-standalone-macos.sh
# Code sign the standalone macOS package

SCRIPT=${0##*/}
SCRIPT_VERSION="1.0"
PACKAGE_DIR="release/pnut-term-ts-macos"
DEVELOPER_ID="Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)"

set -e

if [ ! -d "$PACKAGE_DIR" ]; then
    echo "❌ Package not found. Run 'npm run packageStandaloneMacOS' first."
    exit 1
fi

echo "🔐 Code signing standalone macOS package..."

# Sign native binaries first (deepest level)
echo "Signing native serialport bindings..."
find "$PACKAGE_DIR/prebuilds" -name "*.node" | while read -r file; do
    if [ -f "$file" ]; then
        echo "Signing: $file"
        (set -x; codesign --verbose=4 --options=runtime -s "$DEVELOPER_ID" "$file")
        echo "Code signing completed successfully for $file"
    else
        echo "File $file does not exist."
    fi
done

# Sign the launcher script
echo "Signing launcher script..."
if [ -f "$PACKAGE_DIR/pnut-term-ts" ]; then
    (set -x; codesign --verbose=4 --options=runtime -s "$DEVELOPER_ID" "$PACKAGE_DIR/pnut-term-ts")
    echo "Code signing completed successfully for launcher script."
else
    echo "File $PACKAGE_DIR/pnut-term-ts does not exist."
fi

# Sign the main JavaScript file (optional but recommended)
echo "Signing main application file..."
if [ -f "$PACKAGE_DIR/dist/pnut-term-ts.min.js" ]; then
    (set -x; codesign --verbose=4 --options=runtime -s "$DEVELOPER_ID" "$PACKAGE_DIR/dist/pnut-term-ts.min.js")
    echo "Code signing completed successfully for main application."
else
    echo "File $PACKAGE_DIR/dist/pnut-term-ts.min.js does not exist."
fi

echo "✅ Code signing complete!"

# Verify signatures
echo "🔍 Verifying signatures..."
codesign --verify --verbose=2 "$PACKAGE_DIR/pnut-term-ts"
echo "✅ Launcher signature verified!"

# Test execution policy
echo "🔍 Testing execution policy..."
spctl --assess --type execute "$PACKAGE_DIR/pnut-term-ts" && echo "✅ Execution policy passed!" || echo "⚠️  Execution policy failed (may still work)"