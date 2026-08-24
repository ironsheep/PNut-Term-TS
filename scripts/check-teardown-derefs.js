#!/usr/bin/env node
/* eslint-disable */
/**
 * check-teardown-derefs.js — a TEARDOWN-RACE DEREF gate for src/.
 *
 * WHY THIS EXISTS
 * ---------------
 * A defect reported against v1.0.4:
 *
 *     PNut-Term-TS: unexpected failure: Cannot read properties of null (reading 'getCurrentBaudRate')
 *
 * ...and the shell got exit 1, whatever the run had actually decided. One line caused it,
 * in HeadlessController.downloadFile():
 *
 *     try {
 *       await this.downloader.download(filePath, toFlash);   // <-- shutdown can land here
 *     } finally {
 *       if (this.serialPort.getCurrentBaudRate() !== rate) { ... }   // <-- this.serialPort is now null
 *     }
 *
 * A shutdown (a --timeout expiry, SIGINT/SIGTERM, an end marker seen in the stream) runs
 * initiateShutdown(), which sets `this.serialPort = null`. Every await is a place where
 * that can happen. Re-reading the field afterwards dereferences null; thrown from a
 * `finally` it also DISCARDS the return value, escapes run(), and rewrites the process
 * exit status — the same product promise (src/utils/exitCodes.ts) that
 * check-floating-promises.js exists to protect.
 *
 * This is a RECURRING class, not a one-off. The GUI path hit it in v0.9.51
 * (MainWindow.executeDownload, "Cannot read properties of undefined (reading
 * 'getCurrentBaudRate')") and was fixed by capturing the port in a local; the headless
 * path was never given the same treatment, and three years of `if (this.x)` guards
 * written above an await went on looking correct.
 *
 * TypeScript itself cannot catch this: its control-flow analysis narrows `this.field`
 * from a guard and does NOT reset that narrowing across an `await`, so
 * `if (this.port) { await x(); this.port.y(); }` type-checks cleanly under strict null
 * checks. That unsoundness is exactly the hole this script covers. It uses the
 * TypeScript compiler API directly (`typescript` is already a devDependency: ZERO new
 * dependencies), same as its sibling gate.
 *
 * WHAT IT FLAGS
 * -------------
 * A property access on `this.FIELD` where:
 *   1. FIELD is assigned `null` or `undefined` somewhere in the file (i.e. it is a field
 *      something deliberately releases — a port, a window, a stream), AND
 *   2. an `await` occurs earlier in the SAME function, AND
 *   3. FIELD is neither re-assigned nor re-checked between that await and the deref.
 *
 * WHAT COUNTS AS SAFE
 * -------------------
 *   const port = this.port;  await x();  port.y();      // bound before the await  <-- THE FIX
 *   await x();  this.port = new P();  this.port.y();    // re-assigned after the await
 *   await x();  if (this.port) this.port.y();           // re-checked after the await
 *   await x();  this.port?.y();                         // optional chaining
 *
 * The first form is the one to reach for. A re-check is only as good as the gap between
 * it and the use: put another await in that gap and the guard is stale again.
 *
 * ESCAPE HATCH (deliberate, and deliberately noisy)
 * -------------------------------------------------
 *     // teardown-deref-ok: <why this field cannot be released while we await>
 *     this.thing.method();
 *
 * A gate people route around detects nothing forever, so the exception is a comment that
 * names a reason and shows up in review — never a flag that turns the gate off.
 *
 * SCOPE — GATED vs ADVISORY
 * -------------------------
 * Same split, and for the same reason, as check-floating-promises.js: GATED is the code
 * running in the CLI / headless / serial-worker processes, which OWN the exit status —
 * a throw there is what the user saw. ADVISORY is the Electron main process, where the
 * same construct produces a confusing error message but cannot rewrite the exit code.
 *
 * USAGE
 *   node scripts/check-teardown-derefs.js            # gate the critical set
 *   node scripts/check-teardown-derefs.js --list     # report everything, exit 0
 *   node scripts/check-teardown-derefs.js --all      # gate EVERYTHING (aspirational)
 */

'use strict';

const path = require('path');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUPPRESSION = /teardown-deref-ok/;

/**
 * The exit-status-critical set: everything that runs in the CLI, headless, or serial
 * worker process. Kept identical to check-floating-promises.js on purpose — the two
 * gates protect the same contract from two directions.
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

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

function main() {
  const listOnly = process.argv.includes('--list');
  const gateAll = process.argv.includes('--all');

  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    console.error(`check-teardown-derefs: cannot read tsconfig.json: ${configFile.error.messageText}`);
    process.exit(2);
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, REPO_ROOT);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });

  const findings = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const rel = path.relative(REPO_ROOT, sourceFile.fileName);
    if (rel.startsWith('..') || !rel.startsWith('src' + path.sep)) continue;
    scanFile(sourceFile, rel);
  }

  /** Fields this file deliberately releases: `this.X = null` / `this.X = undefined`. */
  function releasedFields(sourceFile) {
    const fields = new Set();
    (function walk(node) {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const { left, right } = node;
        if (ts.isPropertyAccessExpression(left) && left.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const nullish =
            right.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(right) && right.text === 'undefined');
          if (nullish) fields.add(left.name.text);
        }
      }
      ts.forEachChild(node, walk);
    })(sourceFile);
    return fields;
  }

  function scanFile(sourceFile, rel) {
    const fields = releasedFields(sourceFile);
    if (fields.size === 0) return;
    const text = sourceFile.getFullText();

    (function walk(node) {
      if (isFunctionLike(node) && node.body) {
        scanFunction(node, sourceFile, rel, fields, text);
      }
      ts.forEachChild(node, walk);
    })(sourceFile);
  }

  function scanFunction(fn, sourceFile, rel, fields, text) {
    const awaits = []; // end positions of awaits in THIS function's own scope
    const derefs = []; // `this.FIELD.member` accesses
    const rebinds = []; // `this.FIELD = <not nullish>` — a fresh value after the await is fine
    const guards = []; // positions where FIELD is re-checked

    (function inner(node, isRoot) {
      // A nested function has its own scope: its body is scanned by the outer walk.
      if (!isRoot && isFunctionLike(node)) return;

      if (ts.isAwaitExpression(node)) awaits.push(node.end);

      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const { left, right } = node;
        if (ts.isPropertyAccessExpression(left) && left.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const nullish =
            right.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(right) && right.text === 'undefined');
          if (!nullish) rebinds.push({ field: left.name.text, pos: node.end });
        }
      }

      // A re-check: the field appearing anywhere inside an if/while condition, a
      // ternary condition, or either side of && / ||.
      const conditions = [];
      if (ts.isIfStatement(node) || ts.isWhileStatement(node)) conditions.push(node.expression);
      if (ts.isConditionalExpression(node)) conditions.push(node.condition);
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        conditions.push(node.left);
      }
      for (const cond of conditions) {
        (function findRefs(n) {
          if (
            ts.isPropertyAccessExpression(n) &&
            n.expression.kind === ts.SyntaxKind.ThisKeyword &&
            fields.has(n.name.text)
          ) {
            guards.push({ field: n.name.text, pos: cond.getStart(sourceFile) });
          }
          ts.forEachChild(n, findRefs);
        })(cond);
      }

      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        // `this.f?.x` and `this.f!.x` are both explicit acknowledgements — skip them.
        const optional = node.questionDotToken !== undefined || ts.isNonNullExpression(node.expression);
        const base = node.expression;
        if (
          !optional &&
          ts.isPropertyAccessExpression(base) &&
          base.expression.kind === ts.SyntaxKind.ThisKeyword &&
          fields.has(base.name.text)
        ) {
          derefs.push({ field: base.name.text, pos: node.getStart(sourceFile), node });
        }
      }

      ts.forEachChild(node, (child) => inner(child, false));
    })(fn.body, true);

    if (awaits.length === 0 || derefs.length === 0) return;

    for (const d of derefs) {
      const priorAwaits = awaits.filter((a) => a < d.pos);
      if (priorAwaits.length === 0) continue; // nothing has yielded yet — the field is stable
      const lastAwait = Math.max(...priorAwaits);

      // Re-bound to a fresh value since that await? Then the deref sees the new value.
      if (rebinds.some((r) => r.field === d.field && r.pos > lastAwait && r.pos <= d.pos)) continue;
      // Re-checked since that await? Only sound because no await sits in the gap — and
      // if one does, that await becomes `lastAwait` and this check no longer applies.
      if (guards.some((g) => g.field === d.field && g.pos > lastAwait && g.pos < d.pos)) continue;

      if (isSuppressed(d.node, sourceFile)) continue;

      const { line } = sourceFile.getLineAndCharacterOfPosition(d.pos);
      const src = text.split('\n')[line].trim().replace(/\s+/g, ' ');
      findings.push({
        file: rel,
        line: line + 1,
        field: d.field,
        fn: fn.name && fn.name.getText ? fn.name.getText(sourceFile) : '<anonymous>',
        text: src.length > 100 ? src.slice(0, 97) + '...' : src
      });
    }
  }

  function isSuppressed(node, sourceFile) {
    // Look at the leading trivia of the whole statement, not the expression, so the
    // comment can sit on the line above as it does for the sibling gate.
    let stmt = node;
    while (stmt.parent && !ts.isStatement(stmt)) stmt = stmt.parent;
    const full = stmt.getFullText(sourceFile);
    const leading = full.slice(0, full.length - stmt.getText(sourceFile).length);
    return SUPPRESSION.test(leading);
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const gated = findings.filter((f) => gateAll || isGated(f.file));
  const advisory = findings.filter((f) => !gated.includes(f));

  function print(list) {
    for (const f of list) {
      console.log(`  ${f.file}:${f.line}  ${f.fn}()  this.${f.field}`);
      console.log(`      ${f.text}`);
    }
  }

  if (listOnly) {
    console.log(`Teardown-race derefs in src/: ${findings.length}\n`);
    print(findings);
    process.exit(0);
  }

  if (gated.length > 0) {
    console.log(`❌ check-teardown-derefs: ${gated.length} deref(s) of a released field after an await`);
    console.log('   (in the exit-status-critical set)\n');
    print(gated);
    console.log('');
    console.log('Something releases this field (sets it null/undefined) during teardown, and the');
    console.log('await above is a place where that can happen. Bind it BEFORE the await instead:');
    console.log('');
    console.log('    const port = this.serialPort;');
    console.log('    if (!port) return;');
    console.log('    await something();');
    console.log('    port.method();          // not this.serialPort.method()');
    console.log('');
    console.log('If the field genuinely cannot be released while we await, mark the site:');
    console.log('    // teardown-deref-ok: <why>');
    process.exit(1);
  }

  console.log('✅ check-teardown-derefs: exit-status-critical set is clean');
  if (advisory.length > 0) {
    console.log(`   (advisory: ${advisory.length} in the Electron main process — run with --list to see them)`);
  }
  process.exit(0);
}

main();
