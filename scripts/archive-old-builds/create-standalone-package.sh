#!/bin/bash
# scripts/create-standalone-package.sh
# Creates a standalone package that uses external Node.js environment

set -e  # Exit on any error

# Configuration
PACKAGE_NAME="pnut-term-ts-macos"
OUTPUT_DIR="release"
PACKAGE_DIR="$OUTPUT_DIR/$PACKAGE_NAME"

echo "Creating standalone macOS package..."

# Clean and create directories
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy built application
echo "Copying application files..."
cp -r dist "$PACKAGE_DIR/"
cp -r prebuilds "$PACKAGE_DIR/"
cp -r fonts "$PACKAGE_DIR/"

# Copy essential files
cp package.json "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/" 2>/dev/null || echo "README.md not found, skipping"
cp LICENSE "$PACKAGE_DIR/" 2>/dev/null || echo "LICENSE not found, skipping"

# Create launcher script
echo "Creating launcher script..."
cat > "$PACKAGE_DIR/pnut-term-ts" << 'EOF'
#!/bin/bash
# PNut-Term-TS Launcher for macOS
# Requires Node.js to be installed on the system

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed."
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo "Minimum version required: 18.0.0"
    echo ""
    echo "After installation, restart your terminal and try again."
    exit 1
fi

# Check Node.js version (require 18+)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18 or higher required."
    echo "Current version: $(node -v)"
    echo "Please update Node.js from: https://nodejs.org"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if the main application exists
MAIN_APP="$SCRIPT_DIR/dist/pnut-term-ts.min.js"
if [ ! -f "$MAIN_APP" ]; then
    echo "❌ Error: Application not found at $MAIN_APP"
    echo "Package may be corrupted."
    exit 1
fi

# Set NODE_PATH to include local dependencies if needed
export NODE_PATH="$SCRIPT_DIR/node_modules:$NODE_PATH"

# Launch the application with all passed arguments
echo "🚀 Starting PNut-Term-TS..."
exec node "$MAIN_APP" "$@"
EOF

# Make launcher executable
chmod +x "$PACKAGE_DIR/pnut-term-ts"

# Create installation instructions
cat > "$PACKAGE_DIR/INSTALL.md" << 'EOF'
# PNut-Term-TS for macOS - Installation Instructions

## Prerequisites
- **Node.js 18+** must be installed on your system
- Download from: https://nodejs.org

## Installation
1. Extract this package to your desired location (e.g., `/Applications/PNut-Term-TS/`)
2. Open Terminal
3. Navigate to the package directory
4. Run: `./pnut-term-ts --help`

## Adding to PATH (Optional)
To run `pnut-term-ts` from anywhere:

```bash
# Add to your ~/.bash_profile or ~/.zshrc:
export PATH="/path/to/pnut-term-ts-macos:$PATH"

# Or create a symlink:
sudo ln -s /path/to/pnut-term-ts-macos/pnut-term-ts /usr/local/bin/pnut-term-ts
```

## Usage
```bash
# Show help
./pnut-term-ts --help

# Run with specific port
./pnut-term-ts --port /dev/tty.usbserial-P2

# Enable verbose logging
./pnut-term-ts --verbose
```

## Troubleshooting
- **"command not found"**: Make sure the launcher script is executable: `chmod +x pnut-term-ts`
- **"Node.js required"**: Install Node.js from https://nodejs.org
- **Permission denied**: Run `chmod +x pnut-term-ts`

## Package Contents
- `pnut-term-ts` - Launcher script
- `dist/` - Application bundle
- `prebuilds/` - Native serialport bindings
- `fonts/` - Application fonts
EOF

# Create version info
PACKAGE_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
cat > "$PACKAGE_DIR/VERSION.txt" << EOF
PNut-Term-TS for macOS
Version: $PACKAGE_VERSION
Built: $BUILD_DATE
Node.js Runtime: External (18+ required)
Architecture: Universal (requires Node.js)
EOF

# Create archive
echo "Creating archive..."
cd "$OUTPUT_DIR"
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"
echo "✅ Package created: $OUTPUT_DIR/$PACKAGE_NAME.tar.gz"

# Show package info
echo ""
echo "📦 Package Information:"
echo "   Name: $PACKAGE_NAME"
echo "   Location: $PACKAGE_DIR"
echo "   Archive: $OUTPUT_DIR/$PACKAGE_NAME.tar.gz"
echo "   Size: $(du -sh "$PACKAGE_NAME" | cut -f1)"
echo ""
echo "🎯 To test the package:"
echo "   cd $PACKAGE_DIR"
echo "   ./pnut-term-ts --help"
echo ""
echo "📋 Distribution:"
echo "   Share: $OUTPUT_DIR/$PACKAGE_NAME.tar.gz"
echo "   Users extract and run: ./pnut-term-ts"