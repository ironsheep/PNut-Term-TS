#!/bin/bash
set -e

echo "🐧 Creating Linux Packages for PNut-Term-TS"
echo "==========================================="

# Configuration
ELECTRON_VERSION="v33.3.1"  # Match tested version from create-electron-ready-package.sh
ARCHITECTURES=("linux-x64" "linux-arm64")

# Extract version from package.json and format as six digits
VERSION=$(grep '"version"' package.json | sed -E 's/.*"version": "([0-9]+)\.([0-9]+)\.([0-9]+)".*/\1.\2.\3/')
VERSION_MAJOR=$(echo $VERSION | cut -d'.' -f1)
VERSION_MINOR=$(echo $VERSION | cut -d'.' -f2)
VERSION_PATCH=$(echo $VERSION | cut -d'.' -f3)
VERSION_FORMATTED=$(printf "%02d%02d%02d" $VERSION_MAJOR $VERSION_MINOR $VERSION_PATCH)

echo "📌 Building version: $VERSION (${VERSION_FORMATTED})"
echo ""

# Create package directory
PACKAGE_DIR="release/linux-package"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

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
    if [ -d "$electron_dir" ] && [ -f "$electron_dir/electron" ]; then
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

    # Make electron executable
    chmod +x "$electron_dir/electron"

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

    # Set up package directory structure - always use pnut_term_ts folder
    # tar.gz file name will include arch and version
    if [ "$arch" = "linux-x64" ]; then
        tar_name="pnut-term-ts-linux-x64-${VERSION_FORMATTED}"
    else
        tar_name="pnut-term-ts-linux-arm64-${VERSION_FORMATTED}"
    fi

    pkg_dir="$PACKAGE_DIR/pnut_term_ts"
    mkdir -p "$pkg_dir/bin"

    echo "📦 Step 2: Copying Electron files..."
    # Copy all Electron files
    cp -r "tasks/electron-cache/electron-${arch}"/* "$pkg_dir/"
    chmod +x "$pkg_dir/electron"
    echo "   ✅ Copied Electron runtime"

    echo "📦 Step 3: Copying application files..."
    # Create resources/app structure
    mkdir -p "$pkg_dir/resources/app"

    # Copy application files
    cp -r dist "$pkg_dir/resources/app/"

    # Create package.json for Electron (pointing to electron-main.js)
    cat > "$pkg_dir/resources/app/package.json" << PACKAGE_EOF
{
  "name": "pnut-term-ts",
  "version": "${VERSION}",
  "main": "dist/electron-main.js",
  "description": "Propeller 2 Debug Terminal",
  "author": "Iron Sheep Productions, LLC",
  "license": "MIT"
}
PACKAGE_EOF

    # Copy external files if they exist
    if [ -d "src/ext" ]; then
        mkdir -p "$pkg_dir/resources/app/dist/ext"
        cp -r src/ext/* "$pkg_dir/resources/app/dist/ext/"
        echo "   ✅ Copied external files (flash_loader.obj, etc.)"
    fi

    # Copy user documentation (APP-HELP.md only - not dev docs)
    if [ -f "DOCs/APP-HELP.md" ]; then
        mkdir -p "$pkg_dir/resources/app/DOCs"
        cp DOCs/APP-HELP.md "$pkg_dir/resources/app/DOCs/"
        echo "   ✅ Copied APP-HELP.md"
    fi

    # Copy fonts to resources (not resources/app)
    if [ -d "fonts" ]; then
        cp -r fonts "$pkg_dir/resources/"
        echo "   ✅ Copied fonts"
    fi

    # Copy app icon if it exists
    if [ -f "assets/icon.png" ]; then
        cp assets/icon.png "$pkg_dir/resources/"
        echo "   ✅ Copied app icon"
    fi

    # Copy ONLY essential native modules
    echo "   📦 Copying native dependencies..."
    mkdir -p "$pkg_dir/resources/app/node_modules"

    # Electron module (required by electron-main.js for app, BrowserWindow, etc.)
    if [ -d "node_modules/electron" ]; then
        cp -r node_modules/electron "$pkg_dir/resources/app/node_modules/"
        echo "   ✅ Copied electron module"
    fi

    # SerialPort bindings - use Linux architecture-specific binary
    if [ -d "node_modules/@serialport" ]; then
        mkdir -p "$pkg_dir/resources/app/node_modules/@serialport"
        # Copy everything except the build folder (which might contain wrong architecture)
        for dir in node_modules/@serialport/*; do
            basename_dir=$(basename "$dir")
            if [ "$basename_dir" != "bindings-cpp" ]; then
                cp -r "$dir" "$pkg_dir/resources/app/node_modules/@serialport/"
            else
                # For bindings-cpp, copy everything except the build folder
                mkdir -p "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp"
                cp -r node_modules/@serialport/bindings-cpp/dist "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/"
                cp -r node_modules/@serialport/bindings-cpp/package.json "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/"
                # Create the build/Release directory and copy the Linux binary
                mkdir -p "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/build/Release"
                if [ "$arch" = "linux-x64" ]; then
                    cp prebuilds/linux-x64/@serialport+bindings-cpp.glibc.node \
                       "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node"
                else
                    cp prebuilds/linux-arm64/@serialport+bindings-cpp.armv8.glibc.node \
                       "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node"
                fi
            fi
        done
    fi

    # USB bindings
    if [ -d "node_modules/usb" ]; then
        cp -r node_modules/usb "$pkg_dir/resources/app/node_modules/"
    fi

    # node-gyp-build for native loading
    if [ -d "node_modules/node-gyp-build" ]; then
        cp -r node_modules/node-gyp-build "$pkg_dir/resources/app/node_modules/"
    fi

    # debug module (required by @serialport/bindings-cpp)
    if [ -d "node_modules/debug" ]; then
        cp -r node_modules/debug "$pkg_dir/resources/app/node_modules/"
    fi

    # ms module (required by debug)
    if [ -d "node_modules/ms" ]; then
        cp -r node_modules/ms "$pkg_dir/resources/app/node_modules/"
    fi

    # NOTE: commander, markdown-it, jimp are bundled by esbuild - no need to copy

    if [ -d "prebuilds" ]; then
        cp -r prebuilds "$pkg_dir/resources/app/"
        echo "   ✅ Copied prebuilds"
    fi

    echo "📄 Step 4: Adding documentation files..."
    # Copy LICENSE, COPYRIGHT, and CHANGELOG to package root
    cp LICENSE "$pkg_dir/LICENSE"
    cp copyright "$pkg_dir/COPYRIGHT"
    cp CHANGELOG.md "$pkg_dir/CHANGELOG.md"
    echo "   ✅ Added LICENSE, COPYRIGHT, and CHANGELOG"

    echo "🚀 Step 5: Creating command-line launcher..."
    # Create the launcher script in bin/
    cat > "$pkg_dir/bin/pnut-term-ts" << 'LAUNCHER_EOF'
#!/bin/bash
# pnut-term-ts launcher script for Linux
# Get the directory where this script is located and go up one level
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Use Electron's built-in Node.js to run the CLI
# The CLI will launch Electron GUI only if needed (not for --help, --version, etc.)
ELECTRON_RUN_AS_NODE=1 exec "$DIR/electron" "$DIR/resources/app/dist/pnut-term-ts.min.js" "$@"
LAUNCHER_EOF

    # Make launcher executable
    chmod +x "$pkg_dir/bin/pnut-term-ts"
    echo "   ✅ Created launcher at bin/pnut-term-ts"

    echo "📄 Step 6: Creating README..."
    cat > "$pkg_dir/README.md" << 'README_EOF'
# PNut-Term-TS for Linux

Cross-platform debug terminal for Parallax Propeller 2.

## Package Contents

This package contains a complete, standalone installation of PNut-Term-TS with the Electron runtime included.

## Directory Structure

```
pnut_term_ts/
├── LICENSE
├── COPYRIGHT
├── CHANGELOG.md
├── README.md
├── electron             # Electron runtime
├── resources/
│   └── app/
│       └── dist/
│           └── pnut-term-ts.min.js  # Main application
├── bin/
│   └── pnut-term-ts    # Command-line launcher
└── [other electron files]
```

## Usage

Run the launcher script:
```bash
./bin/pnut-term-ts [options]
```

Or add the `bin` directory to your PATH for system-wide access.

## Documentation

For installation instructions, usage documentation, and support, please visit:
https://github.com/ironsheep/PNut-Term-TS
README_EOF

    echo "   ✅ Created README.md"

    echo "📦 Step 8: Creating ZIP archive..."
    # Create the zip file
    cd "$PACKAGE_DIR"
    if command -v zip > /dev/null; then
        zip -q -r "${tar_name}.zip" "pnut_term_ts"
        echo "   ✅ Created ${tar_name}.zip"
        # Remove the uncompressed folder after successful ZIP creation
        rm -rf "pnut_term_ts"
        echo "   🧹 Cleaned up uncompressed folder"
    else
        echo "   ⚠️  zip command not found. Package directory ready at: $pkg_dir"
        echo "   Install zip or manually create the archive"
    fi
    cd - > /dev/null

    echo ""
    echo "✅ Package for $arch complete!"
done

echo ""
echo "========================================="
echo "✅ Linux packages created successfully!"
echo "========================================="
echo ""
echo "📦 Packages created:"
for arch in "${ARCHITECTURES[@]}"; do
    if [ "$arch" = "linux-x64" ]; then
        tar_name="pnut-term-ts-linux-x64-${VERSION_FORMATTED}"
    else
        tar_name="pnut-term-ts-linux-arm64-${VERSION_FORMATTED}"
    fi
    echo "   - ${tar_name}.zip (unpacks to pnut_term_ts/)"
done
echo ""
echo "📍 Location: $PACKAGE_DIR/"
echo ""
echo "These are complete, ready-to-run packages with Electron included!"
echo ""
echo "Users can:"
echo "1. Extract the zip file to their preferred location"
echo "2. Add the pnut_term_ts/bin directory to PATH"
echo "3. Run: pnut-term-ts"