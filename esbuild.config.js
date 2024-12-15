const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/dbg-term-ts.ts"],
    bundle: true,
    outfile: "dist/dbg-term-ts.js",
    platform: "node",
    target: "node18",
    format: "cjs",
    minify: false, // Disable esbuild minification we'll use terser instead
    sourcemap: true,
  })
  .catch(() => process.exit(1));
