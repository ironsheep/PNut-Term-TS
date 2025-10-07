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

    # Set up package directory structure
    if [ "$arch" = "linux-x64" ]; then
        pkg_name="pnut-term-ts-linux-x64-${VERSION_FORMATTED}"
    else
        pkg_name="pnut-term-ts-linux-arm64-${VERSION_FORMATTED}"
    fi

    pkg_dir="$PACKAGE_DIR/$pkg_name/opt/pnut-term-ts"
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
    cat > "$pkg_dir/resources/app/package.json" << 'PACKAGE_EOF'
{
  "name": "pnut-term-ts",
  "version": "0.5.0",
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

    # Copy documentation
    if [ -d "DOCs" ]; then
        mkdir -p "$pkg_dir/resources/app/DOCs"
        cp -r DOCs/* "$pkg_dir/resources/app/DOCs/"
        echo "   ✅ Copied documentation files"
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
    if [ -d "prebuilds" ]; then
        cp -r prebuilds "$pkg_dir/resources/app/"
        echo "   ✅ Copied prebuilds"
    fi

    echo "📄 Step 4: Adding documentation files..."
    # Copy LICENSE, COPYRIGHT, and CHANGELOG to package root
    cp LICENSE "$PACKAGE_DIR/$pkg_name/LICENSE"
    cp copyright "$PACKAGE_DIR/$pkg_name/COPYRIGHT"
    cp CHANGELOG.md "$PACKAGE_DIR/$pkg_name/CHANGELOG.md"
    echo "   ✅ Added LICENSE, COPYRIGHT, and CHANGELOG"

    echo "🚀 Step 5: Creating command-line launcher..."
    # Create the launcher script in bin/
    cat > "$pkg_dir/bin/pnut-term-ts" << 'LAUNCHER_EOF'
#!/bin/bash
# pnut-term-ts launcher script for Linux
# Get the installation root (go up from bin/ to get to /opt/pnut-term-ts)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Run the CLI directly with Node - it will launch Electron when needed
exec node "$DIR/resources/app/dist/pnut-term-ts.min.js" "$@"
LAUNCHER_EOF

    # Make launcher executable
    chmod +x "$pkg_dir/bin/pnut-term-ts"
    echo "   ✅ Created launcher at bin/pnut-term-ts"

    echo "📄 Step 6: Creating installation script..."
    install_script="$PACKAGE_DIR/$pkg_name/install.sh"
    cat > "$install_script" << 'INSTALL_EOF'
#!/bin/bash
# Installation script for PNut-Term-TS on Linux

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "Installing PNut-Term-TS to /opt/pnut-term-ts..."

# Remove old installation if exists
if [ -d "/opt/pnut-term-ts" ]; then
    echo "Removing old installation..."
    rm -rf /opt/pnut-term-ts
fi

# Copy to /opt
cp -r opt/pnut-term-ts /opt/
echo "✅ Installed to /opt/pnut-term-ts"

# Set permissions
chmod -R 755 /opt/pnut-term-ts
chmod +x /opt/pnut-term-ts/electron
chmod +x /opt/pnut-term-ts/bin/pnut-term-ts

echo ""
echo "✅ Installation complete!"
echo ""
echo "To use pnut-term-ts from the command line, add to your PATH:"
echo ""
echo "  For bash (~/.bashrc):"
echo "    export PATH=\"/opt/pnut-term-ts/bin:\$PATH\""
echo ""
echo "  For zsh (~/.zshrc):"
echo "    export PATH=\"/opt/pnut-term-ts/bin:\$PATH\""
echo ""
echo "Then reload your shell or run: source ~/.bashrc"
INSTALL_EOF

    chmod +x "$install_script"
    echo "   ✅ Created install.sh"

    echo "📄 Step 7: Creating README..."
    cat > "$PACKAGE_DIR/$pkg_name/README.md" << 'README_EOF'
# PNut-Term-TS for Linux

## Quick Start

1. Extract this archive
2. Run the installer (as root):
   ```bash
   sudo ./install.sh
   ```
3. Add to PATH (in ~/.bashrc or ~/.zshrc):
   ```bash
   export PATH="/opt/pnut-term-ts/bin:$PATH"
   ```
4. Reload your shell:
   ```bash
   source ~/.bashrc
   ```
5. Run:
   ```bash
   pnut-term-ts
   ```

## Manual Installation

If you prefer not to use the installer:

1. Copy `opt/pnut-term-ts` to `/opt/`:
   ```bash
   sudo cp -r opt/pnut-term-ts /opt/
   sudo chmod -R 755 /opt/pnut-term-ts
   ```

2. Add `/opt/pnut-term-ts/bin` to your PATH

## Directory Structure

```
/opt/pnut-term-ts/
├── electron              # Electron runtime
├── resources/
│   └── app/
│       └── dist/
│           └── pnut-term-ts.min.js
├── bin/
│   └── pnut-term-ts     # Command-line launcher
└── [other electron files]
```

## Uninstall

To remove PNut-Term-TS:
```bash
sudo rm -rf /opt/pnut-term-ts
```
Then remove the PATH entry from your shell configuration.

## Troubleshooting

- If "command not found": Ensure `/opt/pnut-term-ts/bin` is in your PATH
- Run `echo $PATH` to verify
- Check permissions: `ls -la /opt/pnut-term-ts/bin/pnut-term-ts`
README_EOF

    echo "   ✅ Created README.md"

    echo "📦 Step 8: Creating tar.gz archive..."
    # Create the tar.gz file
    cd "$PACKAGE_DIR"
    tar -czf "${pkg_name}.tar.gz" "$pkg_name"
    echo "   ✅ Created ${pkg_name}.tar.gz"
    cd - > /dev/null

    # Clean up the uncompressed directory
    rm -rf "$PACKAGE_DIR/$pkg_name"

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
        pkg_name="pnut-term-ts-linux-x64-${VERSION_FORMATTED}"
    else
        pkg_name="pnut-term-ts-linux-arm64-${VERSION_FORMATTED}"
    fi
    echo "   - ${pkg_name}.tar.gz"
done
echo ""
echo "📍 Location: $PACKAGE_DIR/"
echo ""
echo "These are complete, ready-to-run packages with Electron included!"
echo ""
echo "Users can:"
echo "1. Extract the tar.gz file"
echo "2. Run sudo ./install.sh"
echo "3. Add /opt/pnut-term-ts/bin to PATH"
echo "4. Run: pnut-term-ts"