#!/bin/bash
# Build optimized production bundle for packaging

set -e

echo "🔨 Building Production Bundle"
echo "=============================="
echo ""

# Clean dist directory but keep structure
echo "🧹 Cleaning dist directory..."
rm -rf dist
mkdir -p dist

# Compile TypeScript first to get workers and other non-bundled files
echo "📝 Compiling TypeScript..."
npx tsc

# Copy required runtime assets
echo "📁 Copying runtime assets..."
mkdir -p ./prebuilds
if [ -d "node_modules/@serialport/bindings-cpp/prebuilds" ]; then
    cp -r ./node_modules/@serialport/bindings-cpp/prebuilds/* ./prebuilds/ 2>/dev/null || true
fi

mkdir -p ./fonts
if [ -d "src/assets/fonts" ]; then
    cp -r ./src/assets/fonts/* ./fonts/ 2>/dev/null || true
fi

# Build BOTH bundles - CLI and Electron entry points
echo "📦 Building production bundles..."

# Build the CLI bundle WITHOUT minification first
echo "   Building CLI bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['src/pnut-term-ts.ts'],
  bundle: true,
  outfile: 'dist/pnut-term-ts.temp.js',
  platform: 'node',
  target: 'node18',
  external: ['electron', '@serialport/bindings-cpp', 'usb'],
  minify: false  // Don't minify yet
}).then(() => console.log('   ✅ CLI bundle created'));
"

# Build the Electron main process bundle
echo "   Building Electron main bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['src/electron-main.ts'],
  bundle: true,
  outfile: 'dist/electron-main.js',
  platform: 'node',
  target: 'node18',
  external: ['electron', '@serialport/bindings-cpp', 'usb'],
  minify: true
}).then(() => console.log('   ✅ Electron bundle created'));
"

# Build the Worker bundle (includes all dependencies)
echo "   Building Worker bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['src/workers/extractionWorker.ts'],
  bundle: true,
  outfile: 'dist/workers/extractionWorker.bundled.js',
  platform: 'node',
  target: 'node18',
  external: ['worker_threads'],
  minify: false,
  format: 'cjs'
}).then(() => console.log('   ✅ Worker bundle created'));
"

# [#31] Build the Serial I/O worker bundle (hosts the SerialPort off the main loop).
# serialport's native binding stays EXTERNAL (required from node_modules at runtime).
echo "   Building Serial I/O worker bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['src/workers/serialIoWorker.ts'],
  bundle: true,
  outfile: 'dist/workers/serialIoWorker.bundled.js',
  platform: 'node',
  target: 'node18',
  external: ['worker_threads', 'serialport', '@serialport/bindings-cpp', 'usb'],
  minify: false,
  format: 'cjs'
}).then(() => console.log('   ✅ Serial I/O worker bundle created'));
"

# Build the renderer-side debugger bundle (loaded by the debugger window HTML)
echo "   Building debugger renderer bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['src/classes/debugger/renderer/index.ts'],
  bundle: true,
  outfile: 'dist/debugger-renderer.js',
  platform: 'browser',
  target: 'chrome120',
  external: ['electron'],
  minify: false,
  format: 'iife'
}).then(() => console.log('   ✅ Debugger renderer bundle created'));
"

# Insert build date into non-minified version
echo "📅 Inserting build date..."
node -e "
const fs = require('fs');
const content = fs.readFileSync('dist/pnut-term-ts.temp.js', 'utf8');
const updated = content.replace('{buildDateHere}', 'Build date: ' + new Date().toLocaleDateString());
fs.writeFileSync('dist/pnut-term-ts.temp.js', updated);
console.log('   ✅ Date inserted');
"

# Now minify the file with date already inserted
echo "🗜️  Minifying bundle..."
npx terser dist/pnut-term-ts.temp.js -c -m -o dist/pnut-term-ts.min.js

# Note: Shebang is already included from source file (src/pnut-term-ts.ts)

# Clean up temp file
rm -f dist/pnut-term-ts.temp.js

# Make executable
chmod +x dist/pnut-term-ts.min.js

# Check sizes
CLI_SIZE=$(du -h dist/pnut-term-ts.min.js | cut -f1)
ELECTRON_SIZE=$(du -h dist/electron-main.js | cut -f1)
echo ""
echo "✅ Production build complete!"
echo "   CLI bundle: $CLI_SIZE (dist/pnut-term-ts.min.js)"
echo "   Electron bundle: $ELECTRON_SIZE (dist/electron-main.js)"
echo ""

# Verify it works
echo "🧪 Verifying build..."
node dist/pnut-term-ts.min.js --version > /dev/null 2>&1 && echo "   ✅ Build verified" || echo "   ⚠️  Build verification failed"