const esbuild = require('esbuild');

// SEA-specific build configuration that externalizes native modules
Promise.all([
  esbuild.build({
    entryPoints: ['src/pnut-term-ts.ts'],
    bundle: true,
    outfile: 'dist/pnut-term-ts-sea.js',
    platform: 'node',
    target: 'node23',
    external: [
      'electron',
      'serialport',
      '@serialport/bindings-cpp',
      '@serialport/parser-delimiter',
      '@serialport/parser-readline'
    ],
    minify: false,
    sourcemap: false // SEA doesn't support sourcemaps
  })
]).catch(() => process.exit(1));