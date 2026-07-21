const esbuild = require('esbuild');

// ── Compile-time transport-diagnostics gate ────────────────────────────────────
// ENABLE_DIAGNOSTICS gates the verbose transport diagnostics ([CTRL]/[DEBUGGER] framing
// traffic). It is a COMPILE-TIME constant: when false, esbuild dead-code-eliminates every
// diagnostic call site, so a released build carries zero runtime cost and no protocol noise.
//   dev / pre-release build (default)      → true  (we keep diagnostics on while auditing)
//   release build  (PNUT_RELEASE=1)        → false (🚦 RELEASE GATE — packaged builds set this)
// The package scripts run the build with PNUT_RELEASE=1, so every shipped bundle is OFF.
// The define block lives in scripts/build-defines.js so this config and
// scripts/build-production.sh (which rebuilds every bundle for packaging) cannot
// drift apart — see that file's header for the v0.9.98 failure that forced it.
const buildDefines = require('./scripts/build-defines');
const sharedDefine = buildDefines.defines;
console.log(`esbuild: ${buildDefines.describe()}`);

Promise.all([
  // Build the CLI entry point
  esbuild.build({
    entryPoints: ['src/pnut-term-ts.ts'],
    bundle: true,
    outfile: 'dist/pnut-term-ts.js',
    platform: 'node',
    target: 'node23',
    // koffi is a native FFI module (synchronous Windows download transport) — keep it external
    // and require()'d at runtime, like the serialport binding.
    external: ['electron', 'koffi'],
    minify: false, // Disable esbuild minification we'll use terser instead
    sourcemap: true,
    define: sharedDefine
  }),
  // Build the Electron entry point
  esbuild.build({
    define: sharedDefine,
    entryPoints: ['src/electron-main.ts'],
    bundle: true,
    outfile: 'dist/electron-main.js',
    platform: 'node',
    target: 'node23',
    external: ['electron', 'koffi'],
    minify: false,
    sourcemap: true
  }),
  // Build the Worker (bundle all dependencies into single file)
  esbuild.build({
    define: sharedDefine,
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
  // [#31] Build the Serial I/O host — an Electron UtilityProcess that owns the SerialPort in
  // its own process (worker_threads can't host serialport: its native poller binds
  // uv_default_loop()). Inline serialport's JS, keep ONLY the native binding external (mirror
  // the main bundle; the packaged app ships @serialport/bindings-cpp resolvable).
  esbuild.build({
    define: sharedDefine,
    entryPoints: ['src/workers/serialIoHost.ts'],
    bundle: true,
    outfile: 'dist/workers/serialIoHost.bundled.js',
    platform: 'node',
    target: 'node23',
    external: ['electron', '@serialport/bindings-cpp', 'usb', 'koffi'],
    minify: true,
    sourcemap: true,
    format: 'cjs'
  }),
  // Build the renderer-side debugger bundle (loaded by the debugger window HTML)
  esbuild.build({
    define: sharedDefine,
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
