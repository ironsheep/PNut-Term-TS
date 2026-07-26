/** @format */

// verifyStreamLog.test.ts
//
// Guards scripts/verify-stream-log.js against the failure mode it already committed once.
//
// On its first real capture the verifier reported "189,091 DUPLICATE lines" on a stream that was
// PERFECTLY INTACT. Cause: P2 DEBUG's decimal formatter inserts underscore digit separators once
// a value gets large ("1_000"), and the pattern `SEQ (\d+)` stopped at the underscore — so
// `SEQ 1_000` read as `SEQ 1`, every thousand-line block collapsed onto the same handful of
// values, and the tool manufactured a flood of duplicates that would also have HIDDEN real loss
// behind them.
//
// A verifier is only worth having if its verdict can be trusted, so its own format assumptions
// need tests. These use synthetic logs with known content: a clean run must PASS, and each
// damage class must be caught by name.

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const VERIFIER = path.join(__dirname, '..', 'scripts', 'verify-stream-log.js');

function writeLog(lines: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
  const p = path.join(dir, 'debug.log');
  fs.writeFileSync(p, lines.join('\n'));
  return p;
}

/** Run the verifier; return its stdout plus whether it exited 0 (PASS). */
function runVerifier(logPath: string): { out: string; passed: boolean } {
  try {
    const out = execFileSync('node', [VERIFIER, logPath], { encoding: 'utf8' });
    return { out, passed: true };
  } catch (e: any) {
    return { out: String(e.stdout ?? ''), passed: false };
  }
}

/** P2 DEBUG renders large decimals with underscore separators: 1000 -> "1_000". */
function p2Decimal(n: number): string {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const fromEnd = s.length - i;
    out += s[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += '_';
  }
  return out;
}

describe('verify-stream-log.js', () => {
  it('renders P2-style separated decimals in the fixture (guards the guard)', () => {
    expect(p2Decimal(999)).toBe('999');
    expect(p2Decimal(1000)).toBe('1_000');
    expect(p2Decimal(190280)).toBe('190_280');
  });

  describe('underscore-separated sequence numbers (the shipped bug)', () => {
    const clean = (count: number): string[] => {
      const lines = [];
      for (let i = 0; i < count; i++) lines.push(`[ts] Cog0  SEQ ${p2Decimal(i)}`);
      lines.push(`[ts] Cog0  STRESS COMPLETE ${p2Decimal(count)} lines`);
      return lines;
    };

    it('PASSES an intact run whose numbers carry separators', () => {
      const { out, passed } = runVerifier(writeLog(clean(5000)));
      expect(out).toContain('no gaps, no duplicates, strictly increasing');
      expect(out).toContain('VERDICT: PASS');
      expect(passed).toBe(true);
    });

    it('reads the full separated value, not the digits before the first underscore', () => {
      const { out } = runVerifier(writeLog(clean(5000)));
      // The bug's signature was a range collapsing to 0..N and a duplicate flood.
      expect(out).toContain('sequence range : 0 .. 4999');
      expect(out).not.toContain('DUPLICATE');
    });
  });

  describe('damage is still caught', () => {
    it('reports a gap with its location and size', () => {
      const lines = [];
      for (let i = 0; i < 3000; i++) {
        if (i >= 1500 && i < 1510) continue; // drop 10
        lines.push(`[ts] Cog0  SEQ ${p2Decimal(i)}`);
      }
      const { out, passed } = runVerifier(writeLog(lines));
      expect(out).toContain('MISSING 10 lines');
      expect(out).toContain('gap after SEQ 1499');
      expect(passed).toBe(false);
    });

    it('reports duplicate delivery', () => {
      const lines = [];
      for (let i = 0; i < 2000; i++) {
        lines.push(`[ts] Cog0  SEQ ${p2Decimal(i)}`);
        if (i === 1234) lines.push(`[ts] Cog0  SEQ ${p2Decimal(i)}`);
      }
      const { out, passed } = runVerifier(writeLog(lines));
      expect(out).toContain('DUPLICATE');
      expect(passed).toBe(false);
    });

    it('catches a truncated tail, which gap analysis alone cannot see', () => {
      const lines = [];
      for (let i = 0; i < 1200; i++) lines.push(`[ts] Cog0  SEQ ${p2Decimal(i)}`);
      lines.push(`[ts] Cog0  STRESS COMPLETE ${p2Decimal(20000)} lines`); // program sent far more
      const { out, passed } = runVerifier(writeLog(lines));
      expect(out).toContain('TRUNCATED TAIL');
      expect(passed).toBe(false);
    });
  });

  describe('absent evidence is reported as UNMEASURED, never as passed', () => {
    // A verifier that silently passes on missing data is worse than no verifier.
    it('marks gates 5 and 6 unmeasured when the run carried no keys and no cpu samples', () => {
      const lines = [];
      for (let i = 0; i < 500; i++) lines.push(`[ts] Cog0  SEQ ${p2Decimal(i)}`);
      lines.push(`[ts] Cog0  STRESS COMPLETE ${p2Decimal(500)} lines`);
      const { out } = runVerifier(writeLog(lines));
      expect(out).toContain('gate 5 UNMEASURED');
      expect(out).toContain('gate 6 UNMEASURED');
      expect(out).toContain('VERDICT: PASS'); // intact stream, but notes say what was not measured
      expect(out).toContain('unmeasured');
    });

    it('says so plainly when no stream is present at all', () => {
      const { out, passed } = runVerifier(writeLog(['[ts] nothing to see here']));
      expect(out).toContain('no SEQ lines found');
      expect(passed).toBe(false);
    });
  });
});
