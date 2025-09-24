const esbuild = require('esbuild');

// Production build - build both entry points
Promise.all([
  // CLI entry point
  esbuild.build({
    entryPoints: ['src/pnut-term-ts.ts'],
    bundle: true,
    outfile: 'dist/pnut-term-ts.min.js',
    platform: 'node',
    target: 'node18', // More compatible than node23
    external: [
      // Don't bundle these - they'll be loaded at runtime if available
      'electron',
      '@serialport/bindings-cpp', // Native module, can't bundle
      'usb' // Native module, can't bundle
    ],
    minify: true,
    sourcemap: false, // No sourcemap for production
    treeShaking: true,
    // Removed banner - shebang already exists in source file
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    logLevel: 'info'
  }),
  // Electron entry point
  esbuild.build({
    entryPoints: ['src/electron-main.ts'],
    bundle: true,
    outfile: 'dist/electron-main.js',
    platform: 'node',
    target: 'node18',
    external: [
      'electron',
      '@serialport/bindings-cpp',
      'usb'
    ],
    minify: true,
    sourcemap: false,
    treeShaking: true,
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    logLevel: 'info'
  })
]).then(() => {
  console.log('✅ Production bundles created:');
  console.log('   - dist/pnut-term-ts.min.js (CLI entry)');
  console.log('   - dist/electron-main.js (Electron entry)');
}).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});