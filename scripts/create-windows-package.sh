#!/bin/bash
set -e

echo "📦 Creating Windows Package for PNut-Term-TS"
echo "==========================================="

# Configuration
ELECTRON_VERSION="v33.3.1"  # Match tested version from create-electron-ready-package.sh
ARCHITECTURES=("win32-x64" "win32-arm64")

# Extract version from package.json and format as six digits
VERSION=$(grep '"version"' package.json | sed -E 's/.*"version": "([0-9]+)\.([0-9]+)\.([0-9]+)".*/\1.\2.\3/')
VERSION_MAJOR=$(echo $VERSION | cut -d'.' -f1)
VERSION_MINOR=$(echo $VERSION | cut -d'.' -f2)
VERSION_PATCH=$(echo $VERSION | cut -d'.' -f3)
VERSION_FORMATTED=$(printf "%02d%02d%02d" $VERSION_MAJOR $VERSION_MINOR $VERSION_PATCH)

echo "📌 Building version: $VERSION (${VERSION_FORMATTED})"
echo ""

# Create package directory
PACKAGE_DIR="release/windows-package"
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
    if [ -d "$electron_dir" ] && [ -f "$electron_dir/electron.exe" ]; then
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
    if [ "$arch" = "win32-x64" ]; then
        pkg_name="pnut-term-ts-windows-x64-${VERSION_FORMATTED}"
    else
        pkg_name="pnut-term-ts-windows-arm64-${VERSION_FORMATTED}"
    fi

    pkg_dir="$PACKAGE_DIR/$pkg_name"
    mkdir -p "$pkg_dir"

    echo "📦 Step 2: Copying Electron files..."
    # Copy all Electron files
    cp -r "tasks/electron-cache/electron-${arch}"/* "$pkg_dir/"
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

    # Copy fonts
    if [ -d "fonts" ]; then
        cp -r fonts "$pkg_dir/resources/"
        echo "   ✅ Copied fonts"
    fi

    # Copy app icon if it exists
    if [ -f "assets/icon.ico" ]; then
        cp assets/icon.ico "$pkg_dir/resources/"
        echo "   ✅ Copied app icon"
    fi

    # Copy ONLY essential native modules
    echo "   📦 Copying native dependencies..."
    mkdir -p "$pkg_dir/resources/app/node_modules"

    # SerialPort bindings - use Windows architecture-specific binary
    if [ -d "node_modules/@serialport" ]; then
        mkdir -p "$pkg_dir/resources/app/node_modules/@serialport"
        # Copy everything except the build folder (which contains Linux binaries)
        for dir in node_modules/@serialport/*; do
            basename_dir=$(basename "$dir")
            if [ "$basename_dir" != "bindings-cpp" ]; then
                cp -r "$dir" "$pkg_dir/resources/app/node_modules/@serialport/"
            else
                # For bindings-cpp, copy everything except the build folder
                mkdir -p "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp"
                cp -r node_modules/@serialport/bindings-cpp/dist "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/"
                cp -r node_modules/@serialport/bindings-cpp/package.json "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/"
                # Create the build/Release directory and copy the Windows binary
                mkdir -p "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/build/Release"
                if [ "$arch" = "win32-x64" ]; then
                    cp prebuilds/win32-x64/@serialport+bindings-cpp.node \
                       "$pkg_dir/resources/app/node_modules/@serialport/bindings-cpp/build/Release/bindings.node"
                else
                    # Windows ARM64 uses different naming
                    cp prebuilds/win32-arm64/@serialport+bindings-cpp.armv8.node \
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
    if [ -d "prebuilds" ]; then
        cp -r prebuilds "$pkg_dir/resources/app/"
        echo "   ✅ Copied prebuilds"
    fi

    echo "📄 Step 4: Adding documentation files..."
    # Copy LICENSE, COPYRIGHT, and CHANGELOG to package root
    cp LICENSE "$pkg_dir/LICENSE.txt"
    cp copyright "$pkg_dir/COPYRIGHT.txt"
    cp CHANGELOG.md "$pkg_dir/CHANGELOG.md"
    echo "   ✅ Added LICENSE, COPYRIGHT, and CHANGELOG"

    echo "🚀 Step 5: Creating command-line launcher..."
    # Create the batch launcher script
    cat > "$pkg_dir/pnut-term-ts.cmd" << 'CMD_EOF'
@echo off
REM pnut-term-ts launcher script for Windows - updated for new architecture
REM Get the directory where this script is located
set DIR=%~dp0
REM Remove trailing backslash if present
if "%DIR:~-1%"=="\" set DIR=%DIR:~0,-1%
REM Run CLI entry point with node - it will spawn Electron if GUI is needed
REM First try to use system node, fall back to electron's node if not available
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node "%DIR%\resources\app\dist\pnut-term-ts.min.js" %*
) else (
    "%DIR%\electron.exe" "%DIR%\resources\app\dist\pnut-term-ts.min.js" %*
)
CMD_EOF

    echo "   ✅ Created pnut-term-ts.cmd launcher"

    echo "📄 Step 6: Creating README..."
    cat > "$pkg_dir/README.txt" << 'README_EOF'
PNut-Term-TS for Windows
========================

Quick Start:
1. Extract this folder to your preferred location (e.g., C:\Program Files\pnut-term-ts)
2. Add the folder to your PATH environment variable
3. Open a new Command Prompt or PowerShell
4. Run: pnut-term-ts

Adding to PATH:
---------------
Option A - Command Line (as Administrator):
  setx /M PATH "%PATH%;C:\Program Files\pnut-term-ts"

Option B - GUI:
  1. Right-click "This PC" → Properties
  2. Click "Advanced system settings"
  3. Click "Environment Variables"
  4. Under "System variables", select "Path" and click "Edit"
  5. Click "New" and add the folder path
  6. Click OK on all windows

Usage:
------
Once in PATH, run from any Command Prompt or PowerShell:
  pnut-term-ts [options]

The pnut-term-ts.cmd file launches the application with all
command-line arguments properly passed through.

Troubleshooting:
----------------
- If "command not found", ensure the folder is in PATH
- You may need to restart your terminal after adding to PATH
- Run "echo %PATH%" to verify the path is included
README_EOF

    echo "   ✅ Created README.txt"

    echo "📦 Step 7: Creating ZIP file..."
    # Create the zip file
    cd "$PACKAGE_DIR"
    if command -v zip > /dev/null; then
        zip -q -r "${pkg_name}.zip" "$pkg_name"
        echo "   ✅ Created ${pkg_name}.zip"
        # Remove the uncompressed folder after successful ZIP creation
        rm -rf "$pkg_name"
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
echo "✅ Windows packages created successfully!"
echo "========================================="
echo ""
echo "📦 Packages created:"
for arch in "${ARCHITECTURES[@]}"; do
    if [ "$arch" = "win32-x64" ]; then
        pkg_name="pnut-term-ts-windows-x64-${VERSION_FORMATTED}"
    else
        pkg_name="pnut-term-ts-windows-arm64-${VERSION_FORMATTED}"
    fi
    echo "   - ${pkg_name}.zip"
done
echo ""
echo "📍 Location: $PACKAGE_DIR/"
echo ""
echo "These are complete, ready-to-run packages with Electron included!"