#!/bin/bash
set -e

echo "🍎 Creating macOS Packages for PNut-Term-TS"
echo "==========================================="

# Configuration
ELECTRON_VERSION="v33.3.1"  # Match tested version from create-electron-ready-package.sh
ARCHITECTURES=("darwin-x64" "darwin-arm64")

# Extract version from package.json and format as six digits
VERSION=$(grep '"version"' package.json | sed -E 's/.*"version": "([0-9]+)\.([0-9]+)\.([0-9]+)".*/\1.\2.\3/')
VERSION_MAJOR=$(echo $VERSION | cut -d'.' -f1)
VERSION_MINOR=$(echo $VERSION | cut -d'.' -f2)
VERSION_PATCH=$(echo $VERSION | cut -d'.' -f3)
VERSION_FORMATTED=$(printf "%02d%02d%02d" $VERSION_MAJOR $VERSION_MINOR $VERSION_PATCH)

echo "📌 Building version: $VERSION (${VERSION_FORMATTED})"
echo ""

# Create package directory (preserve existing scripts)
PACKAGE_DIR="release/macos-package"
mkdir -p "$PACKAGE_DIR"
# Remove only generated packages, preserve DMG scripts
rm -rf "$PACKAGE_DIR"/*.tar.gz "$PACKAGE_DIR"/pnut-term-ts-macos-* 2>/dev/null || true

echo "📋 Step 1: Checking build..."
if [ ! -d "dist" ]; then
    echo "   ❌ No build found. Please run 'npm run build' first"
    exit 1
fi

# Function to download and extract Electron
download_electron() {
    local arch=$1
    local cache_dir="tasks/electron-cache"
    local electron_zip="${cache_dir}/electron-${arch}.zip"
    local electron_dir="${cache_dir}/electron-${arch}"

    mkdir -p "$cache_dir"

    # Check if already cached
    if [ -d "$electron_dir" ] && [ -d "$electron_dir/Electron.app" ]; then
        echo "   ✅ Using cached Electron for $arch"
        return 0
    fi

    # Download if not cached
    echo "   📥 Downloading Electron $ELECTRON_VERSION for $arch..."
    local url="https://github.com/electron/electron/releases/download/${ELECTRON_VERSION}/electron-${ELECTRON_VERSION}-${arch}.zip"

    if command -v curl > /dev/null; then
        curl -L -o "$electron_zip" "$url"
    elif command -v wget > /dev/null; then
        wget -O "$electron_zip" "$url"
    else
        echo "   ❌ Neither curl nor wget found. Please install one."
        return 1
    fi

    # Extract
    echo "   📦 Extracting Electron..."
    rm -rf "$electron_dir"
    mkdir -p "$electron_dir"
    unzip -q "$electron_zip" -d "$electron_dir"
    rm "$electron_zip"

    echo "   ✅ Electron $arch ready"
    return 0
}

# Build packages for each architecture
for arch in "${ARCHITECTURES[@]}"; do
    echo ""
    echo "🏗️  Building package for $arch..."
    echo "================================"

    # Download Electron if needed
    download_electron "$arch"

    # Set up package directory
    if [ "$arch" = "darwin-x64" ]; then
        pkg_name="pnut-term-ts-macos-x64-${VERSION_FORMATTED}"
    else
        pkg_name="pnut-term-ts-macos-arm64-${VERSION_FORMATTED}"
    fi

    pkg_dir="$PACKAGE_DIR/$pkg_name"
    mkdir -p "$pkg_dir"

    echo "📦 Step 2: Creating app bundle..."
    # Copy Electron.app as PNut-Term-TS.app
    cp -R "tasks/electron-cache/electron-${arch}/Electron.app" "$pkg_dir/PNut-Term-TS.app"
    echo "   ✅ Created app bundle"

    echo "📦 Step 3: Copying application files..."
    APP_DIR="$pkg_dir/PNut-Term-TS.app"

    # Copy all necessary files to Resources/app
    cp -r dist "$APP_DIR/Contents/Resources/app/"

    # Copy ext directory with flash_loader.obj and other external files
    if [ -d "src/ext" ]; then
        mkdir -p "$APP_DIR/Contents/Resources/app/dist/ext"
        cp -r src/ext/* "$APP_DIR/Contents/Resources/app/dist/ext/"
        echo "   ✅ Copied external files (flash_loader.obj, etc.)"
    fi

    # IMPORTANT: Fonts go directly into Resources/fonts, NOT Resources/app/fonts
    cp -r fonts "$APP_DIR/Contents/Resources/"
    cp -r prebuilds "$APP_DIR/Contents/Resources/app/"
    cp -r node_modules "$APP_DIR/Contents/Resources/app/"

    # Create package.json for Electron (pointing to electron-main.js)
    cat > "$APP_DIR/Contents/Resources/app/package.json" << 'PACKAGE_EOF'
{
  "name": "pnut-term-ts",
  "version": "0.5.0",
  "main": "dist/electron-main.js",
  "description": "Propeller 2 Debug Terminal",
  "author": "Iron Sheep Productions, LLC",
  "license": "MIT"
}
PACKAGE_EOF

    echo "📄 Step 4: Adding documentation files..."
    # Copy LICENSE, COPYRIGHT, and CHANGELOG to package root
    cp LICENSE "$pkg_dir/LICENSE"
    cp copyright "$pkg_dir/COPYRIGHT"
    cp CHANGELOG.md "$pkg_dir/CHANGELOG.md"
    echo "   ✅ Added LICENSE, COPYRIGHT, and CHANGELOG"

    echo "🚀 Step 5: Creating command-line launcher..."
    # Create bin directory for command-line tools
    mkdir -p "$APP_DIR/Contents/Resources/bin"

    # Create launcher script in the bin directory
    cat > "$APP_DIR/Contents/Resources/bin/pnut-term-ts" << 'LAUNCHER_EOF'
#!/bin/bash
# pnut-term-ts launcher script
# Get the app bundle root (go up from Resources/bin to get to Contents)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Run the CLI directly with Node - it will launch Electron when needed
exec node "$DIR/Resources/app/dist/pnut-term-ts.min.js" "$@"
LAUNCHER_EOF

    # Make launcher executable
    chmod +x "$APP_DIR/Contents/Resources/bin/pnut-term-ts"
    echo "   ✅ Created command-line launcher"

    echo "📝 Step 6: Updating Info.plist..."
    # Update Info.plist with our app information
    INFO_PLIST="$APP_DIR/Contents/Info.plist"

    # Use PlistBuddy if on macOS, otherwise use sed
    if [[ "$OSTYPE" == "darwin"* ]]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier biz.ironsheep.pnut-term-ts" "$INFO_PLIST"
        /usr/libexec/PlistBuddy -c "Set :CFBundleName PNut-Term-TS" "$INFO_PLIST"
        /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName PNut Term TS" "$INFO_PLIST"
    else
        echo "   ⚠️  Not on macOS, Info.plist updates skipped"
    fi

    echo "📄 Step 7: Creating README..."
    cat > "$pkg_dir/README.md" << 'README_EOF'
# PNut-Term-TS for macOS

## Installation

1. Drag `PNut-Term-TS.app` to `/Applications`
2. For command-line access, add to PATH:
   ```bash
   export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:$PATH"
   ```

## Usage

GUI: Double-click the app
CLI: `pnut-term-ts [options]`

## First Run

macOS may require you to allow the app in System Preferences → Security & Privacy
README_EOF

    echo "   ✅ Created README"

    # Create tar.gz since we're not on macOS
    echo "📦 Step 8: Creating archive..."
    cd "$PACKAGE_DIR"
    tar -czf "${pkg_name}.tar.gz" "$pkg_name"
    echo "   ✅ Created ${pkg_name}.tar.gz"
    cd - > /dev/null

    echo ""
    echo "✅ Package for $arch complete!"
done

echo ""
echo "========================================="
echo "✅ macOS packages created successfully!"
echo "========================================="
echo ""
echo "📦 Packages ready for macOS:"
for arch in "${ARCHITECTURES[@]}"; do
    if [ "$arch" = "darwin-x64" ]; then
        echo "   - pnut-term-ts-macos-x64-${VERSION_FORMATTED}.tar.gz"
    else
        echo "   - pnut-term-ts-macos-arm64-${VERSION_FORMATTED}.tar.gz"
    fi
done
echo ""
echo "📍 Location: $PACKAGE_DIR/"
echo ""
echo "⚠️  Note: Since we're not on macOS:"
echo "   - Apps are not signed"
echo "   - DMGs not created"
echo ""
echo "On macOS, you would:"
echo "1. Extract the tar.gz"
echo "2. Sign the .app with codesign"
echo "3. Create and sign a DMG"
echo ""
echo "These packages include:"
echo "• Electron framework bundled"
echo "• Command-line launcher in Resources/bin"
echo "• Ready for signing and DMG creation"