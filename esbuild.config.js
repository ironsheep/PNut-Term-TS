const esbuild = require('esbuild');

Promise.all([
  esbuild.build({
    entryPoints: ['src/pnut-term-ts.ts'],
    bundle: true,
    outfile: 'dist/pnut-term-ts.js',
    platform: 'node',
    target: 'node23',
    external: ['electron'],
    minify: false, // Disable esbuild minification we'll use terser instead
    sourcemap: true
  })
]).catch(() => process.exit(1));
