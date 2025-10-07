#!/bin/bash
# Create optimized macOS packages with minimal size

set -e

echo "🎯 Creating Optimized macOS Packages"
echo "====================================="
echo ""

# Get version
VERSION="000500"
VERSION_DOT="0.5.0"

# Create package directory (preserve existing scripts!)
PACKAGE_DIR="release/macos-package"
# Don't delete the whole directory - just the old app packages
rm -rf "$PACKAGE_DIR"/pnut-term-ts-macos-*
mkdir -p "$PACKAGE_DIR"

echo "📦 Building optimized packages for both architectures..."
echo ""

# Function to download and setup Electron
download_electron() {
    local ARCH=$1
    local PLATFORM="darwin"
    local ELECTRON_VERSION="33.3.1"

    echo "⬇️  Downloading Electron for $PLATFORM-$ARCH..."

    local CACHE_DIR="$HOME/.pnut-term-ts-cache"
    mkdir -p "$CACHE_DIR"

    local ZIP_FILE="$CACHE_DIR/electron-v${ELECTRON_VERSION}-${PLATFORM}-${ARCH}.zip"
    local EXTRACT_DIR="electron-${PLATFORM}-${ARCH}"

    # Download if not cached
    if [ ! -f "$ZIP_FILE" ]; then
        local ELECTRON_URL="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-${PLATFORM}-${ARCH}.zip"
        curl -L -o "$ZIP_FILE" "$ELECTRON_URL" || {
            echo "❌ Failed to download Electron"
            return 1
        }
    else
        echo "   Using cached Electron"
    fi

    # Extract
    rm -rf "$EXTRACT_DIR"
    unzip -q "$ZIP_FILE" -d "$EXTRACT_DIR"

    echo "   ✅ Electron ready"
    return 0
}

# Function to create optimized package
create_package() {
    local ARCH=$1
    local PKG_NAME="pnut-term-ts-macos-${ARCH}-${VERSION}"
    local PKG_DIR="$PACKAGE_DIR/$PKG_NAME"

    echo "🏗️  Building optimized package for $ARCH..."
    echo "================================"

    # Download Electron
    download_electron "$ARCH"

    # Create package structure
    rm -rf "$PKG_DIR"
    mkdir -p "$PKG_DIR"

    # Move Electron app to package
    mv "electron-darwin-${ARCH}/Electron.app" "$PKG_DIR/PNut-Term-TS.app"
    rm -rf "electron-darwin-${ARCH}"

    # Keep the Electron executable name unchanged for simplicity
    # Our CLI spawns it as a separate process anyway

    # Create Resources/app directory
    local APP_DIR="$PKG_DIR/PNut-Term-TS.app/Contents/Resources/app"
    mkdir -p "$APP_DIR/dist"

    echo "📦 Copying optimized application files..."

    # Copy the bundled files (CLI and Electron entry points)
    cp dist/pnut-term-ts.min.js "$APP_DIR/dist/"
    cp dist/electron-main.js "$APP_DIR/dist/"
    echo "   ✅ Copied bundled application files (CLI and Electron entry points)"

    # Copy workers directory
    if [ -d "dist/workers" ]; then
        cp -r dist/workers "$APP_DIR/dist/"
        echo "   ✅ Copied worker files"
    fi

    # Copy external files
    if [ -d "src/ext" ]; then
        mkdir -p "$APP_DIR/dist/ext"
        cp -r src/ext/* "$APP_DIR/dist/ext/"
        echo "   ✅ Copied external files"
    fi

    # Copy fonts
    cp -r fonts "$PKG_DIR/PNut-Term-TS.app/Contents/Resources/"

    # Copy prebuilds
    cp -r prebuilds "$APP_DIR/"

    # Copy ONLY essential native modules
    echo "   📦 Copying native dependencies..."
    mkdir -p "$APP_DIR/node_modules"

    # SerialPort bindings - use macOS universal binary
    if [ -d "node_modules/@serialport" ]; then
        mkdir -p "$APP_DIR/node_modules/@serialport"
        # Copy everything except the build folder (which contains Linux binaries)
        for dir in node_modules/@serialport/*; do
            basename_dir=$(basename "$dir")
            if [ "$basename_dir" != "bindings-cpp" ]; then
                cp -r "$dir" "$APP_DIR/node_modules/@serialport/"
            else
                # For bindings-cpp, copy everything except the build folder
                mkdir -p "$APP_DIR/node_modules/@serialport/bindings-cpp"
                cp -r node_modules/@serialport/bindings-cpp/dist "$APP_DIR/node_modules/@serialport/bindings-cpp/"
                cp -r node_modules/@serialport/bindings-cpp/package.json "$APP_DIR/node_modules/@serialport/bindings-cpp/"
                # Create the build/Release directory and copy the macOS universal binary
                mkdir -p "$APP_DIR/node_modules/@serialport/bindings-cpp/build/Release"
                cp prebuilds/darwin-x64+arm64/@serialport+bindings-cpp.node \
                   "$APP_DIR/node_modules/@serialport/bindings-cpp/build/Release/bindings.node"
            fi
        done
        echo "   ✅ Copied SerialPort bindings with macOS universal binary"
    fi

    # USB bindings
    if [ -d "node_modules/usb" ]; then
        cp -r node_modules/usb "$APP_DIR/node_modules/"
        echo "   ✅ Copied USB bindings"
    fi

    # node-gyp-build for native loading
    if [ -d "node_modules/node-gyp-build" ]; then
        cp -r node_modules/node-gyp-build "$APP_DIR/node_modules/"
    fi

    # debug module (required by @serialport/bindings-cpp)
    if [ -d "node_modules/debug" ]; then
        cp -r node_modules/debug "$APP_DIR/node_modules/"
    fi

    # ms module (required by debug)
    if [ -d "node_modules/ms" ]; then
        cp -r node_modules/ms "$APP_DIR/node_modules/"
    fi

    # Create package.json for Electron (pointing to electron-main.js)
    cat > "$APP_DIR/package.json" << 'PACKAGE_EOF'
{
  "name": "pnut-term-ts",
  "version": "0.5.0",
  "main": "dist/electron-main.js",
  "description": "Propeller 2 Debug Terminal",
  "author": "Iron Sheep Productions, LLC",
  "license": "MIT"
}
PACKAGE_EOF

    # Copy app icon if it exists
    if [ -f "assets/icon.icns" ]; then
        cp assets/icon.icns "$PKG_DIR/PNut-Term-TS.app/Contents/Resources/"
        echo "   ✅ Copied app icon"
    fi

    # Update Info.plist
    cat > "$PKG_DIR/PNut-Term-TS.app/Contents/Info.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Electron</string>
    <key>CFBundleName</key>
    <string>PNut-Term-TS</string>
    <key>CFBundleIdentifier</key>
    <string>com.ironsheep.pnut-term-ts</string>
    <key>CFBundleVersion</key>
    <string>${VERSION_DOT}</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION_DOT}</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST_EOF

    # Create CLI launcher
    mkdir -p "$PKG_DIR/PNut-Term-TS.app/Contents/Resources/bin"
    cat > "$PKG_DIR/PNut-Term-TS.app/Contents/Resources/bin/pnut-term-ts" << 'LAUNCHER_EOF'
#!/bin/bash
# pnut-term-ts launcher script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Run the CLI directly with Node - it will launch Electron when needed
exec node "$DIR/Resources/app/dist/pnut-term-ts.min.js" "$@"
LAUNCHER_EOF
    chmod +x "$PKG_DIR/PNut-Term-TS.app/Contents/Resources/bin/pnut-term-ts"

    # Add documentation
    cp LICENSE "$PKG_DIR/" 2>/dev/null || true
    cp COPYRIGHT "$PKG_DIR/" 2>/dev/null || true
    cp CHANGELOG.md "$PKG_DIR/" 2>/dev/null || true

    # Create README
    cat > "$PKG_DIR/README.md" << README_EOF
# PNut-Term-TS v${VERSION_DOT} - Optimized Build

## Installation
1. Drag PNut-Term-TS.app to your Applications folder
2. On first launch, macOS may ask for permission in System Preferences

## Command Line Usage
Add to your PATH:
export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:\$PATH"

Then use: pnut-term-ts [options]

## Package Info
- Architecture: $ARCH
- Build: Optimized single-file bundle
- Size: ~50MB (vs 1.1GB unoptimized)
README_EOF

    echo "   ✅ Package created: $PKG_NAME"
    echo "   📊 Size: $(du -sh "$PKG_DIR" | cut -f1)"

    # Create tar.gz archive (like Linux script does)
    echo "   📦 Creating tar.gz archive..."
    cd "$PACKAGE_DIR"
    tar czf "${PKG_NAME}.tar.gz" "${PKG_NAME}/"
    echo "   ✅ Archive created: ${PKG_NAME}.tar.gz ($(du -h "${PKG_NAME}.tar.gz" | cut -f1))"
    cd - > /dev/null
    echo ""
}

# Build for both architectures
create_package "x64"
create_package "arm64"

echo "=========================================="
echo "✅ Optimized macOS packages created!"
echo "=========================================="
echo ""
echo "📦 Packages created in: $PACKAGE_DIR/"
echo ""
echo "Package sizes:"
echo "  Apps:"
du -sh "$PACKAGE_DIR"/pnut-term-ts-macos-*/PNut-Term-TS.app 2>/dev/null | sed 's/^/    /'
echo "  Archives:"
ls -lah "$PACKAGE_DIR"/*.tar.gz 2>/dev/null | awk '{print "    " $5 " " $9}'
echo ""
echo "🎯 Next steps:"
echo "   1. Test the apps"
echo "   2. Run SIGN-APPS.command to sign them"
echo "   3. Run CREATE-STANDARD-DMGS.command to create DMGs"
echo ""