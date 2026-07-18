/* eslint-disable no-console */
// build-release.js
//
// Runs the normal build with PNUT_RELEASE=1 set, which flips esbuild's
// ENABLE_DIAGNOSTICS define to false (see esbuild.config.js) so every packaged
// bundle ships with transport diagnostics stripped.
//
// WHY A NODE WRAPPER instead of `"build:release": "PNUT_RELEASE=1 npm run build"`:
// that POSIX inline-env syntax is not understood by cmd.exe, and npm executes
// package.json scripts through cmd.exe on Windows REGARDLESS of the shell the
// caller used — so the Windows package build died with "'PNUT_RELEASE' is not
// recognized as an internal or external command" (v0.9.98 release workflow).
// Setting the variable in-process here works identically on all three platforms.

const { spawnSync } = require('child_process');
const path = require('path');

// npm is a .cmd shim on Windows; exec it directly rather than via a shell so we
// don't reintroduce a platform-specific quoting problem.
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const result = spawnSync(npmCommand, ['run', 'build'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PNUT_RELEASE: '1' },
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(`build:release failed to start the build: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
