#!/usr/bin/env node
/* eslint-disable */
/**
 * check-floating-promises.js — a FLOATING PROMISE gate for src/.
 *
 * WHY THIS EXISTS
 * ---------------
 * v1.0.3 shipped an intermittent defect where a headless run computed exit code 0,
 * printed it, and then exited 1. The cause was one line:
 *
 *     try {
 *       this.serialPort.close();      // async — NOT awaited
 *     } catch (error) { ... }         // can never see an async rejection
 *
 * A rejected promise nobody handles becomes an uncaught exception under Node >= 15
 * (`--unhandled-rejections=throw`), and Node then FORCES exit status 1 — silently
 * overwriting the exit code this app had already decided. The documented exit-code
 * contract in src/utils/exitCodes.ts is a product promise ("a launching script can
 * branch on $? the same way regardless of how PNut-Term-TS was run"), so any
 * construct that can rewrite the exit status behind our back is a defect class, not
 * a style nit.
 *
 * The project has no ESLint (and adding a type-aware ESLint toolchain is a much
 * larger dependency than the problem warrants), so this uses the TypeScript compiler
 * API directly. `typescript` is already a devDependency: ZERO new dependencies.
 *
 * WHAT IT FLAGS
 * -------------
 *   1. A statement whose value is a promise and which is neither awaited, returned,
 *      nor given a rejection handler.        →  `foo.close();`
 *   2. The same thing behind `void`.         →  `void this.shutdown();`
 *      `void` is NOT a fix. It silences a linter; the rejection is every bit as
 *      unhandled. This checker deliberately does NOT treat it as a suppression —
 *      that difference is the entire reason v1.0.3 shipped the bug.
 *   3. `.then(onFulfilled)` with no rejection handler, unhandled at statement level.
 *
 * WHAT COUNTS AS HANDLED
 * ----------------------
 *   await p            p.catch(fn)            p.then(ok, err)
 *   return p           p.catch(fn).finally(fn)
 *
 * ESCAPE HATCH (deliberate, and deliberately noisy)
 * -------------------------------------------------
 * A genuinely fire-and-forget call is marked at its site:
 *
 *     // floating-promise-ok: <reason it can never reject, or why a rejection is safe>
 *     void this.thing();
 *
 * A gate people route around detects nothing forever, so the exception is a comment
 * that names a reason and shows up in review — never a flag that turns the gate off.
 *
 * SCOPE — GATED vs ADVISORY, and why it is split
 * ----------------------------------------------
 * GATED (exit 1 on any finding) is the code that runs in the CLI / headless / serial-
 * worker processes. Those processes have no `unhandledRejection` handler of their own
 * beyond the deliberate safety net at the bottom of pnut-term-ts.ts, and they are the
 * ones that OWN the exit status. A floating promise there rewrites what the shell
 * sees. That set is clean as of v1.0.4 and must stay clean.
 *
 * ADVISORY (reported, does not fail) is the Electron main process — mainWindow and the
 * debug windows. Same construct, different blast radius: electron-main.ts installs its
 * own unhandledRejection handler, so a stray rejection there does not rewrite the exit
 * code. There is a large pre-existing population; converting them is real work with
 * real render-path regression risk and it is punch-listed, not smuggled into a patch
 * release. Reporting them keeps the number visible and falling.
 *
 * USAGE
 *   node scripts/check-floating-promises.js            # gate the critical set
 *   node scripts/check-floating-promises.js --list     # report everything, exit 0
 *   node scripts/check-floating-promises.js --all      # gate EVERYTHING (aspirational)
 */

'use strict';

const path = require('path');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUPPRESSION = /floating-promise-ok/;

/**
 * The exit-status-critical set: everything that runs in the CLI, headless, or serial
 * worker process. A floating promise in here can rewrite the process exit code.
 * Matched as path prefixes, relative to the repo root, with forward slashes.
 */
const GATED_PREFIXES = [
  'src/pnut-term-ts.ts',
  'src/classes/headlessController.ts',
  'src/classes/downloader.ts',
  'src/classes/shared/headlessFileLogger.ts',
  'src/classes/shared/usbTrafficLogger.ts',
  'src/utils/usb.serial.ts',
  'src/utils/winSyncPort.ts',
  'src/workers/'
];

function isGated(rel) {
  const p = rel.split(path.sep).join('/');
  return GATED_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

function main() {
  const listOnly = process.argv.includes('--list');
  const gateAll = process.argv.includes('--all');

  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    console.error(`check-floating-promises: cannot read tsconfig.json: ${configFile.error.messageText}`);
    process.exit(2);
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, REPO_ROOT);

  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();

  const findings = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const rel = path.relative(REPO_ROOT, sourceFile.fileName);
    if (rel.startsWith('..') || !rel.startsWith('src' + path.sep)) continue;
    visit(sourceFile, sourceFile, rel);
  }

  /** Does this type have a callable `then`? (unions: any constituent counts) */
  function isThenable(type, node) {
    if (!type) return false;
    const parts = type.isUnion() ? type.types : [type];
    for (const part of parts) {
      const then = part.getProperty('then');
      if (!then) continue;
      const thenType = checker.getTypeOfSymbolAtLocation(then, node);
      if (thenType.getCallSignatures().length > 0) return true;
    }
    return false;
  }

  /**
   * Walk a promise chain from the outside in and decide whether a rejection can
   * reach the floor. `.catch(fn)` and `.then(ok, err)` handle it; `.finally(fn)`
   * and `.then(ok)` pass it straight through to whatever is underneath.
   */
  function chainHandlesRejection(expr) {
    let node = expr;
    while (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === 'catch') return true;
      if (method === 'then' && node.arguments.length >= 2) return true;
      if (method === 'then' || method === 'finally') {
        node = node.expression.expression; // transparent — keep looking underneath
        continue;
      }
      return false;
    }
    return false;
  }

  function isSuppressed(node, sourceFile) {
    const full = node.getFullText(sourceFile);
    const leading = full.slice(0, full.length - node.getText(sourceFile).length);
    return SUPPRESSION.test(leading);
  }

  function visit(node, sourceFile, rel) {
    if (ts.isExpressionStatement(node)) {
      let expr = node.expression;
      let viaVoid = false;
      if (ts.isVoidExpression(expr)) {
        viaVoid = true;
        expr = expr.expression;
      }

      // An assignment CAPTURES the promise (`this._closePromise = this._doClose();`),
      // so responsibility moves to whoever holds it — same call the TS-ESLint rule makes.
      const captured = ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken;

      if (!captured && !ts.isAwaitExpression(expr) && !chainHandlesRejection(expr)) {
        const type = checker.getTypeAtLocation(expr);
        if (isThenable(type, expr) && !isSuppressed(node, sourceFile)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(expr.getStart(sourceFile));
          const text = expr.getText(sourceFile).replace(/\s+/g, ' ');
          findings.push({
            file: rel,
            line: line + 1,
            viaVoid,
            text: text.length > 96 ? text.slice(0, 93) + '...' : text
          });
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, sourceFile, rel));
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const gated = findings.filter((f) => gateAll || isGated(f.file));
  const advisory = findings.filter((f) => !gated.includes(f));

  function print(list) {
    for (const f of list) {
      console.log(`  ${f.file}:${f.line}${f.viaVoid ? '  [via void]' : ''}`);
      console.log(`      ${f.text}`);
    }
  }

  if (listOnly) {
    console.log(`Floating promises in src/: ${findings.length}\n`);
    print(findings);
    process.exit(0);
  }

  if (gated.length > 0) {
    console.log(`❌ check-floating-promises: ${gated.length} unhandled promise(s) in the exit-status-critical set\n`);
    print(gated);
    console.log('');
    console.log('A rejection here becomes an uncaught exception and FORCES process exit 1,');
    console.log('overwriting the exit code this app decided (see src/utils/exitCodes.ts).');
    console.log('Fix by awaiting it, returning it, or attaching .catch(...).');
    console.log('If it is genuinely fire-and-forget, mark the site:');
    console.log('    // floating-promise-ok: <why a rejection here is safe>');
    process.exit(1);
  }

  console.log('✅ check-floating-promises: exit-status-critical set is clean');
  if (advisory.length > 0) {
    console.log(`   (advisory: ${advisory.length} in the Electron main process — run with --list to see them)`);
  }
  process.exit(0);
}

main();
