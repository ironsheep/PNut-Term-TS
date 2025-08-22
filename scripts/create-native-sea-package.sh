#!/bin/bash
set -e

echo "Creating native SEA package for macOS..."

# Create package directory
PACKAGE_DIR="release/pnut-term-ts-native-macos"
mkdir -p "$PACKAGE_DIR"

echo "Building SEA executable..."
# Build SEA-compatible bundle
node esbuild.sea.config.js

# Generate SEA blob
node --experimental-sea-config sea-config-native.json

# Create SEA executable
cp $(command -v node) "$PACKAGE_DIR/pnut-term-ts"
npx postject "$PACKAGE_DIR/pnut-term-ts" NODE_SEA_BLOB sea-prep-native.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

chmod +x "$PACKAGE_DIR/pnut-term-ts"

echo "Copying native modules..."
# Copy node_modules for external dependencies
mkdir -p "$PACKAGE_DIR/node_modules"
cp -r node_modules/serialport "$PACKAGE_DIR/node_modules/"
cp -r node_modules/@serialport "$PACKAGE_DIR/node_modules/"

# Copy prebuilt binaries
mkdir -p "$PACKAGE_DIR/prebuilds"
cp -r prebuilds/* "$PACKAGE_DIR/prebuilds/"

# Copy fonts
mkdir -p "$PACKAGE_DIR/fonts"
cp -r fonts/* "$PACKAGE_DIR/fonts/"

echo "Creating package.json for native module resolution..."
cat > "$PACKAGE_DIR/package.json" << 'EOF'
{
  "name": "pnut-term-ts-standalone",
  "version": "0.1.0",
  "type": "commonjs",
  "dependencies": {
    "serialport": "*",
    "@serialport/bindings-cpp": "*",
    "@serialport/parser-delimiter": "*",
    "@serialport/parser-readline": "*"
  }
}
EOF

echo "Creating wrapper script..."
cat > "$PACKAGE_DIR/run.sh" << 'EOF'
#!/bin/bash
# Set NODE_PATH to find native modules
export NODE_PATH="$(dirname "$0")/node_modules:$NODE_PATH"
exec "$(dirname "$0")/pnut-term-ts" "$@"
EOF
chmod +x "$PACKAGE_DIR/run.sh"

echo "Creating macOS .app bundle structure..."
APP_DIR="$PACKAGE_DIR/PNut-Term-TS.app"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Move everything into the app bundle
mv "$PACKAGE_DIR/pnut-term-ts" "$APP_DIR/Contents/MacOS/"
mv "$PACKAGE_DIR/node_modules" "$APP_DIR/Contents/MacOS/"
mv "$PACKAGE_DIR/prebuilds" "$APP_DIR/Contents/MacOS/"
mv "$PACKAGE_DIR/fonts" "$APP_DIR/Contents/MacOS/"
mv "$PACKAGE_DIR/package.json" "$APP_DIR/Contents/MacOS/"

# Create launcher script
cat > "$APP_DIR/Contents/MacOS/PNut-Term-TS" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH="./node_modules:$NODE_PATH"
exec ./pnut-term-ts "$@"
EOF
chmod +x "$APP_DIR/Contents/MacOS/PNut-Term-TS"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PNut-Term-TS</string>
    <key>CFBundleIdentifier</key>
    <string>biz.ironsheep.pnut-term-ts</string>
    <key>CFBundleName</key>
    <string>PNut Term TS</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "Creating archive..."
cd release
tar -czf pnut-term-ts-native-macos.tar.gz pnut-term-ts-native-macos/
cd ..

# Clean up temporary files
rm -f sea-prep-native.blob sea-config-native.json

echo "✅ Native SEA package created!"
echo "📦 Package: release/pnut-term-ts-native-macos/"
echo "🍎 macOS App: release/pnut-term-ts-native-macos/PNut-Term-TS.app"
echo "📦 Archive: release/pnut-term-ts-native-macos.tar.gz"
echo ""
echo "🎯 To test:"
echo "   cd release/pnut-term-ts-native-macos"
echo "   ./PNut-Term-TS.app/Contents/MacOS/PNut-Term-TS --help"
echo ""
echo "📋 Next steps:"
echo "   - Test functionality"
echo "   - Code sign the .app bundle"
echo "   - Create .dmg installer"