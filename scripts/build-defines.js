/* eslint-disable no-console */
// build-defines.js
//
// SINGLE SOURCE OF TRUTH for the esbuild `define` block — the compile-time
// constants substituted into every bundle.
//
// WHY THIS FILE EXISTS: the defines used to live only in esbuild.config.js, but
// scripts/build-production.sh does `rm -rf dist` and then re-builds all five
// bundles with its own inline esbuild calls. Those calls had NO define block, so
// the PACKAGED artifact — the only one users ever run — shipped with both
// constants unsubstituted:
//   - APP_VERSION  → ReferenceError the moment a log file opened (v0.9.98 Linux)
//   - ENABLE_DIAGNOSTICS → the "structural" release gate never actually applied
// Both build paths now require THIS module, so they cannot drift apart again.
//
// ENABLE_DIAGNOSTICS gates the verbose transport diagnostics ([CTRL]/[DEBUGGER]
// framing traffic). When false, esbuild dead-code-eliminates every diagnostic
// call site: zero runtime cost, no protocol noise in the user's log.
//   dev build (default)                → true
//   release build (PNUT_RELEASE=1)     → false   🚦 RELEASE GATE
//
// APP_VERSION is baked from package.json so the running app — and the
// session-start line in the debug log — records the exact version built, with no
// runtime file read.

const APP_VERSION = require('../package.json').version;
const DIAG = process.env.PNUT_RELEASE === '1' ? 'false' : 'true';

module.exports = {
  defines: {
    ENABLE_DIAGNOSTICS: DIAG,
    APP_VERSION: JSON.stringify(APP_VERSION)
  },
  describe() {
    return `ENABLE_DIAGNOSTICS=${DIAG} (${
      DIAG === 'false' ? 'RELEASE — diagnostics stripped' : 'dev — diagnostics on'
    }), APP_VERSION=${APP_VERSION}`;
  }
};
