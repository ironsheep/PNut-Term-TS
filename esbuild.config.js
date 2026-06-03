const esbuild = require('esbuild');

Promise.all([
  // Build the CLI entry point
  esbuild.build({
    entryPoints: ['src/pnut-term-ts.ts'],
    bundle: true,
    outfile: 'dist/pnut-term-ts.js',
    platform: 'node',
    target: 'node23',
    external: ['electron'],
    minify: false, // Disable esbuild minification we'll use terser instead
    sourcemap: true
  }),
  // Build the Electron entry point
  esbuild.build({
    entryPoints: ['src/electron-main.ts'],
    bundle: true,
    outfile: 'dist/electron-main.js',
    platform: 'node',
    target: 'node23',
    external: ['electron'],
    minify: false,
    sourcemap: true
  }),
  // Build the Worker (bundle all dependencies into single file)
  esbuild.build({
    entryPoints: ['src/workers/extractionWorker.ts'],
    bundle: true,
    outfile: 'dist/workers/extractionWorker.bundled.js',
    platform: 'node',
    target: 'node23',
    external: ['worker_threads'], // Keep worker_threads external (Node.js built-in)
    minify: true,
    sourcemap: true,
    format: 'cjs' // CommonJS format for worker threads
  }),
  // Build the renderer-side debugger bundle (loaded by the debugger window HTML)
  esbuild.build({
    entryPoints: ['src/classes/debugger/renderer/index.ts'],
    bundle: true,
    outfile: 'dist/debugger-renderer.js',
    platform: 'browser',    // runs in Electron's Chromium renderer, not Node
    target: 'chrome120',
    external: ['electron'], // ipcRenderer is available via Electron when nodeIntegration=true
    minify: false,
    sourcemap: true,
    format: 'iife'          // self-contained <script> inclusion
  })
]).catch(() => process.exit(1));
