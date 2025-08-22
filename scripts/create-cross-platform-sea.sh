#!/bin/bash
set -e

echo "🔧 Creating Cross-Platform SEA Package System"
echo "=============================================="

# Clean up any previous attempts
rm -rf release/sea-*
rm -f sea-*.blob sea-*.json pnut-term-ts-sea*

echo "📦 Step 1: Building platform-neutral JavaScript bundle..."
node esbuild.sea.config.js

echo "📝 Step 2: Creating SEA configuration files..."

# macOS SEA config
cat > sea-config-macos.json << 'EOF'
{
  "main": "dist/pnut-term-ts-sea.js",
  "output": "sea-prep-macos.blob",
  "disableExperimentalSEAWarning": true,
  "useCodeCache": true
}
EOF

# Linux SEA config  
cat > sea-config-linux.json << 'EOF'
{
  "main": "dist/pnut-term-ts-sea.js", 
  "output": "sea-prep-linux.blob",
  "disableExperimentalSEAWarning": true,
  "useCodeCache": true
}
EOF

# Windows SEA config
cat > sea-config-windows.json << 'EOF'
{
  "main": "dist/pnut-term-ts-sea.js",
  "output": "sea-prep-windows.blob", 
  "disableExperimentalSEAWarning": true,
  "useCodeCache": true
}
EOF

echo "🏗️  Step 3: Generating SEA blobs..."
node --experimental-sea-config sea-config-macos.json
node --experimental-sea-config sea-config-linux.json  
node --experimental-sea-config sea-config-windows.json

echo "📁 Step 4: Creating package structures..."

# Create base directories
mkdir -p release/sea-{macos,linux,windows}

# Copy shared assets to all platforms
for platform in macos linux windows; do
    echo "   📋 Setting up $platform package..."
    
    # Copy native modules
    mkdir -p "release/sea-$platform/node_modules"
    cp -r node_modules/serialport "release/sea-$platform/node_modules/"
    cp -r node_modules/@serialport "release/sea-$platform/node_modules/"
    
    # Copy fonts
    mkdir -p "release/sea-$platform/fonts"
    cp -r fonts/* "release/sea-$platform/fonts/"
    
    # Copy prebuilds (platform-specific will be filtered later)
    mkdir -p "release/sea-$platform/prebuilds"
    cp -r prebuilds/* "release/sea-$platform/prebuilds/"
    
    # Create package.json
    cat > "release/sea-$platform/package.json" << 'PACKAGE_EOF'
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
PACKAGE_EOF
done

echo "🍎 Step 5: Creating macOS-specific structure..."
# Create macOS .app bundle
APP_DIR="release/sea-macos/PNut-Term-TS.app"
mkdir -p "$APP_DIR/Contents/"{MacOS,Resources}

# Move macOS files into app bundle
mv release/sea-macos/node_modules "$APP_DIR/Contents/MacOS/"
mv release/sea-macos/fonts "$APP_DIR/Contents/MacOS/"
mv release/sea-macos/prebuilds "$APP_DIR/Contents/MacOS/"
mv release/sea-macos/package.json "$APP_DIR/Contents/MacOS/"

# Create macOS launcher script  
cat > "$APP_DIR/Contents/MacOS/PNut-Term-TS" << 'MACOS_EOF'
#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH="./node_modules:$NODE_PATH"
exec ./pnut-term-ts "$@"
MACOS_EOF
chmod +x "$APP_DIR/Contents/MacOS/PNut-Term-TS"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'PLIST_EOF'
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
PLIST_EOF

echo "🐧 Step 6: Creating Linux launcher..."
cat > "release/sea-linux/pnut-term-ts.sh" << 'LINUX_EOF'
#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH="./node_modules:$NODE_PATH"
exec ./pnut-term-ts "$@"
LINUX_EOF
chmod +x "release/sea-linux/pnut-term-ts.sh"

echo "🪟 Step 7: Creating Windows launcher..."
cat > "release/sea-windows/pnut-term-ts.bat" << 'WINDOWS_EOF'
@echo off
cd /d "%~dp0"
set NODE_PATH=%~dp0node_modules;%NODE_PATH%
pnut-term-ts.exe %*
WINDOWS_EOF

echo "📋 Step 8: Creating build instructions..."
cat > release/BUILD_INSTRUCTIONS.md << 'BUILD_EOF'
# Cross-Platform SEA Build Instructions

This package contains platform-neutral JavaScript bundles and platform-specific package structures.

## Building Platform-Specific Executables

### macOS (requires macOS system):
```bash
# Generate SEA executable
cp $(command -v node) release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts
npx postject release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts \
    NODE_SEA_BLOB sea-prep-macos.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Code sign (requires Developer ID)
codesign --remove-signature release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts
codesign --sign "Developer ID Application: YOUR_NAME" release/sea-macos/PNut-Term-TS.app

# Create DMG
hdiutil create -volname "PNut Term TS" -srcfolder release/sea-macos/PNut-Term-TS.app \
    -ov -format UDBZ release/PNut-Term-TS.dmg
```

### Linux (requires Linux system):
```bash
cp $(command -v node) release/sea-linux/pnut-term-ts
npx postject release/sea-linux/pnut-term-ts \
    NODE_SEA_BLOB sea-prep-linux.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
chmod +x release/sea-linux/pnut-term-ts

# Create tarball
tar -czf release/pnut-term-ts-linux.tar.gz -C release sea-linux/
```

### Windows (requires Windows system):
```bash
# Copy node.exe to the package
copy "%NODE_HOME%\node.exe" release\sea-windows\pnut-term-ts.exe

# Inject (using PowerShell or cmd)
npx postject release\sea-windows\pnut-term-ts.exe ^
    NODE_SEA_BLOB sea-prep-windows.blob ^
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Create ZIP
powershell Compress-Archive -Path release\sea-windows -DestinationPath release\pnut-term-ts-windows.zip
```

## File Structure

- `sea-prep-*.blob` - Platform-specific SEA preparation blobs
- `release/sea-macos/` - macOS .app bundle structure  
- `release/sea-linux/` - Linux package structure
- `release/sea-windows/` - Windows package structure

## Testing

Each platform package includes:
- Native SEA executable (to be created on target platform)
- Native modules (serialport, etc.)
- Fonts and assets
- Platform-specific launcher scripts

The application will run in CLI mode (no Electron GUI) and handle serial communication via the bundled native modules.
BUILD_EOF

echo "✅ Cross-platform SEA package system created!"
echo ""
echo "📁 Packages ready for platform-specific builds:"
echo "   🍎 macOS: release/sea-macos/PNut-Term-TS.app"
echo "   🐧 Linux: release/sea-linux/"
echo "   🪟 Windows: release/sea-windows/"
echo ""
echo "📋 Next steps:"
echo "   1. Transfer to target platforms"
echo "   2. Follow BUILD_INSTRUCTIONS.md"
echo "   3. Build native executables"
echo "   4. Code sign and create installers"
echo ""
echo "🎯 For pnut_ts compiler: Use same approach!"

# Clean up temporary files
rm -f sea-config-*.json