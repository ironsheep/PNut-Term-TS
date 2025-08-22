#!/bin/bash
# Build and package script for PNut-Term-TS

echo "Starting build and package process..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist/ release/

# Build the application
echo "Building application..."
npm run build

# Check if build succeeded
if [ ! -f "dist/pnut-term-ts.min.js" ]; then
    echo "Build failed - dist/pnut-term-ts.min.js not found"
    exit 1
fi

echo "Build successful!"

# Create package
echo "Creating Electron package..."
./scripts/create-electron-ready-package.sh

echo "Package creation complete!"
echo "Package available at: release/electron-ready-macos.tar.gz"