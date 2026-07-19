# Packaging Guide for PNut-Term-TS

## Production Build Scripts (Use These!)

### 🎯 All Platforms at Once (RECOMMENDED)
**Command**: `npm run packageAll`
**What it does**: Builds all 6 architecture packages (Windows x64/arm64, Linux x64/arm64, macOS x64/arm64)

### Individual Platform Scripts

#### 🪟 Windows Package
**Script**: `./scripts/create-windows-package.sh`
**Command**: `npm run packageWin`
**Output**: `release/windows-package/` (x64 and arm64 ZIP files)
**Size**: ~230MB per architecture

#### 🐧 Linux Package
**Script**: `./scripts/create-linux-package.sh`
**Command**: `npm run packageLinux`
**Output**: `release/linux-package/` (x64 and arm64 ZIP files)
**Size**: ~220MB per architecture

#### 🍎 macOS Package
**Script**: `./scripts/create-macos-packages.sh`
**Command**: `npm run packageMac`
**Output**: `release/macos-package/` (x64 and arm64 TAR.GZ). DMGs are **not** produced
here — they are created by CI, or locally by `scripts/macOS-package/CREATE-STANDARD-DMGS.command`.
**Size**: ~105MB per architecture

Artifacts are named `pnut-term-ts-<platform>-<arch>-<MMmmpp>.<ext>`, where `MMmmpp` is the
zero-padded version — v0.9.99 → `000999`. The release workflow globs these names.

## Important Notes

- **Do NOT run `npm run build` first.** Each `packageX` script is self-contained: it runs
  `build:release` then `build:production`, and `build-production.sh` begins with `rm -rf dist`,
  so anything you built beforehand is deleted. `npm run build` is a **dev** build
  (diagnostics ON) and must never be the source of a shipped artifact.
- Each script builds TWO architectures (x64 and arm64)
- All packages are production-ready with proper Electron bundling
- Old/deprecated build scripts have been archived to `scripts/archive-old-builds/`

## What a packaging run actually does

`npm run packageWin|packageLinux|packageMac` performs, in order:

1. **`npm run build:release`** → `node scripts/build-release.js`, which sets `PNUT_RELEASE=1`
   and runs the normal build.
   > ⚠️ This must stay a Node wrapper. It was previously `PNUT_RELEASE=1 npm run build` —
   > POSIX-only inline-env syntax that npm cannot execute on Windows (npm runs package.json
   > scripts through `cmd.exe` regardless of the caller's shell). That broke the v0.9.98
   > Windows package build. **Never reintroduce an env-var prefix into a `package.json` script.**
2. **`npm run build:production`** → `scripts/build-production.sh`, which wipes `dist/`,
   exports `PNUT_RELEASE=1` itself (a production build *is* a release build), and rebuilds
   all **five** bundles:
   - `dist/pnut-term-ts.js` / `.min.js` — CLI
   - `dist/electron-main.js` — Electron main process
   - `dist/workers/extractionWorker.bundled.js`
   - `dist/workers/serialIoHost.bundled.js`
   - `dist/debugger-renderer.js`
3. **`scripts/create-<platform>-package.sh`** → assembles and compresses the artifact.

### Compile-time defines — `scripts/build-defines.js`

`ENABLE_DIAGNOSTICS` and `APP_VERSION` are substituted at build time. `scripts/build-defines.js`
is the **single source of truth**, required by both `esbuild.config.js` and every inline esbuild
call in `build-production.sh`.

**Any new esbuild call must pull its `define` from that module.** When the production build had
no `define` block, packaged bundles shipped with the constants unsubstituted and threw
`ReferenceError: APP_VERSION is not defined` the moment a log file opened (v0.9.98).

### 🚦 Release gate verification

A packaging run must log:

```
esbuild: ENABLE_DIAGNOSTICS=false (RELEASE — diagnostics stripped), APP_VERSION=<version>
```

If it says `dev — diagnostics on`, **the artifact must not ship.**

`build-production.sh` verification is **fatal** (it was advisory before v0.9.98 — a warning
scrolled past in CI and the broken package was built anyway). It aborts packaging if:
- any of the five bundles still contains an unsubstituted `APP_VERSION` / `ENABLE_DIAGNOSTICS`
  (checked against a minified copy, so comments don't false-positive), or
- `node dist/pnut-term-ts.min.js --version` fails to run.

## What ships inside a package

Only these documentation files are included — no other repo docs:
- `DOCs/APP-HELP.md` (the in-app F1 help)
- `CHANGELOG.md`, `LICENSE`, `COPYRIGHT`, and a generated `README`

`USER-GUIDE.md`, `QUICK-START.md`, `CommandLine.md` and everything else stay in the repo. This
is why **APP-HELP.md must be self-contained** and must never link to another `DOCs/` path.

## Releasing (CI)

Pushing a `vX.Y.Z` tag triggers `.github/workflows/release.yml`:
`build-windows` + `build-linux` + `build-macos` → `macos-sign` (signing, DMG creation,
notarization) → `release` (publishes, and requires all three build jobs to succeed).

macOS signing and notarization happen **in CI**, not in this container — a container cannot sign.
The manual equivalents are `scripts/macOS-package/{CREATE-STANDARD-DMGS,SIGN-APPS,SIGN-DMGS,NOTARIZE-AND-STAPLE}.command`.
`ci.yml` also runs `npm run build:production` as a gate on every push to `main`.

Local `packageAll` is for **testing** the packaging path; releases come from the tag workflow.

## Quick Commands

```bash
# All platforms (dual architecture):
npm run packageAll

# Individual platforms (each builds x64 + arm64):
npm run packageWin        # Windows
npm run packageLinux      # Linux
npm run packageMac        # macOS

# Basic build only:
npm run build
```

## Container Limitations

Running in a Linux container (GitHub Codespaces/Docker) means:
- Cannot create macOS DMG files (DMG creation requires macOS)
- Cannot sign macOS applications (code signing requires macOS + certificates)
- Cannot use macOS-specific packaging tools
- Cross-compilation has limitations

## Current Solution

All packaging scripts create **dual-architecture** packages (x64 + arm64):
- Packages are production-ready with Electron bundled
- Each package is ~100MB per architecture
- Works across Intel and Apple Silicon Macs
- TAR.GZ format for easy distribution

## Testing Workflow

1. Make code changes
2. Run `npm run build`
3. Run appropriate package command (`npm run packageWin`, `packageLinux`, or `packageMac`)
4. Copy generated package from `release/` directory to target machine
5. Extract and run
6. Test with P2 hardware

---
Last Updated: 2026-07-19 (v0.10.0)
Documents the release-gated build chain (build:release → build:production), the
scripts/build-defines.js single source of truth, the fatal packaging verification, and
the CI release workflow.