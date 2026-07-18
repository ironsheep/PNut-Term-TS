/**
 * Compile-time transport-diagnostics gate.
 *
 * The value is injected at bundle time by esbuild's `define` (see esbuild.config.js):
 *   dev / pre-release build            → true  (verbose [CTRL]/[DEBUGGER] transport traffic)
 *   release build (PNUT_RELEASE=1)     → false (diagnostic call sites are dead-code-eliminated)
 *
 * Because it is a compile-time constant, `if (ENABLE_DIAGNOSTICS)` collapses to nothing in a
 * release bundle — zero runtime cost, no protocol noise in the user's log. In tests it is
 * provided as a jest global (false); this ambient declaration keeps tsc/editors happy.
 */
declare const ENABLE_DIAGNOSTICS: boolean;
