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

# Build the single production bundle WITHOUT minification first
echo "📦 Building production bundle..."
# Create non-minified version first for date insertion (no shebang yet)
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
}).then(() => console.log('   ✅ Bundle created'));
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

# Add shebang to minified file
echo "📝 Adding shebang..."
echo '#!/usr/bin/env node' | cat - dist/pnut-term-ts.min.js > dist/temp && mv dist/temp dist/pnut-term-ts.min.js

# Clean up temp file
rm -f dist/pnut-term-ts.temp.js

# Make executable
chmod +x dist/pnut-term-ts.min.js

# Check size
SIZE=$(du -h dist/pnut-term-ts.min.js | cut -f1)
echo ""
echo "✅ Production build complete!"
echo "   Bundle size: $SIZE"
echo "   Location: dist/pnut-term-ts.min.js"
echo ""

# Verify it works
echo "🧪 Verifying build..."
node dist/pnut-term-ts.min.js --version > /dev/null 2>&1 && echo "   ✅ Build verified" || echo "   ⚠️  Build verification failed"