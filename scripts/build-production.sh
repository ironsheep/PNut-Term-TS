#!/bin/bash
# Build optimized production bundle for packaging

set -e

# A production build IS a release build. This script is reached only from the
# package* npm scripts, and it wipes dist/ and rebuilds every bundle itself — so
# the PNUT_RELEASE=1 that the preceding `build:release` step set in ITS process
# does not reach us here. Set it ourselves so the diagnostics gate is structural:
# every packaged bundle ships with transport diagnostics stripped, with no
# manual flip to forget. (Before v0.9.98 this was missing, and every shipped
# build silently carried diagnostics on.)
export PNUT_RELEASE=1

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
  define: require('./scripts/build-defines').defines,
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
  define: require('./scripts/build-defines').defines,
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
  define: require('./scripts/build-defines').defines,
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

# [#31] Build the Serial I/O host bundle — an Electron UtilityProcess that owns the SerialPort
# in its own process. serialport's native binding stays EXTERNAL (required at runtime).
echo "   Building Serial I/O host bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  define: require('./scripts/build-defines').defines,
  entryPoints: ['src/workers/serialIoHost.ts'],
  bundle: true,
  outfile: 'dist/workers/serialIoHost.bundled.js',
  platform: 'node',
  target: 'node18',
  external: ['electron', '@serialport/bindings-cpp', 'usb'],
  minify: false,
  format: 'cjs'
}).then(() => console.log('   ✅ Serial I/O host bundle created'));
"

# Build the renderer-side debugger bundle (loaded by the debugger window HTML)
echo "   Building debugger renderer bundle..."
node -e "
const esbuild = require('esbuild');
esbuild.build({
  define: require('./scripts/build-defines').defines,
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
#
# These checks are FATAL. They used to be advisory (`|| echo "⚠️ failed"`), which
# is precisely how v0.9.98 shipped a bundle that threw
# "ReferenceError: APP_VERSION is not defined" the moment it opened a log file:
# the warning scrolled past in CI and the package was built anyway.
echo "🧪 Verifying build..."

# 1. Compile-time defines actually substituted. A missed `define` leaves the bare
#    identifier in the bundle, which throws at the first line that touches it —
#    and --version alone never reaches those lines, so it cannot catch this.
#    We grep a MINIFIED copy of each bundle rather than the bundle itself:
#    minification strips comments (which legitimately mention these names and
#    would false-positive), but it cannot rename a free identifier — so a
#    genuinely unsubstituted define still survives and is caught.
for symbol in APP_VERSION ENABLE_DIAGNOSTICS; do
    for bundle in dist/pnut-term-ts.min.js dist/electron-main.js \
                  dist/workers/extractionWorker.bundled.js \
                  dist/workers/serialIoHost.bundled.js dist/debugger-renderer.js; do
        if npx esbuild --minify --log-level=silent < "$bundle" | grep -q "$symbol"; then
            echo "   ❌ $symbol left UNSUBSTITUTED in $bundle"
            echo "      The esbuild call that produced it is missing its 'define' block"
            echo "      (see scripts/build-defines.js). Refusing to package."
            exit 1
        fi
    done
done
echo "   ✅ Compile-time defines substituted in all bundles"

# 2. The bundle actually starts.
if ! node dist/pnut-term-ts.min.js --version > /dev/null 2>&1; then
    echo "   ❌ Build verification failed: dist/pnut-term-ts.min.js --version did not run"
    exit 1
fi
echo "   ✅ Build verified"