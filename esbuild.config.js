const esbuild = require("esbuild");

Promise.all([
  esbuild.build({
    entryPoints: ["src/pnut-termdebug-ts.ts"],
    bundle: true,
    outfile: "dist/pnut-termdebug-ts.js",
    platform: "node",
    target: "node23",
    external: ["electron"],
    minify: false, // Disable esbuild minification we'll use terser instead
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ["src/renderer.ts"],
    bundle: true,
    outfile: "dist/renderer.js",
    platform: "node",
  }),
]).catch(() => process.exit(1));
