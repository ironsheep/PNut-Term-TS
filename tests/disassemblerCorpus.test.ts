/** @format */

/**
 * PASM2 disassembler — round-trip regression corpus (§6).
 *
 * Unlike disassemblerGolden.test.ts (25 hand-lifted longs), this corpus is
 * SOURCE-DRIVEN and authoritative end-to-end:
 *
 *   tests/fixtures/pasm2_corpus.spin2   — the instruction list (source of truth
 *                                         for expected mnemonics)
 *        │  pnut-ts (real compiler)     — authoritative encoding
 *        ▼
 *   tests/fixtures/pasm2_corpus.json    — [{addr, word, mnem}] baked by
 *                                         scripts/claude/gen-disasm-corpus.mjs
 *
 * Neither the encoding (pnut-ts) nor the expected mnemonic (the .spin2 source)
 * is hand-transcribed. Regenerate with `node scripts/claude/gen-disasm-corpus.mjs`
 * on a machine with pnut-ts; the committed JSON keeps this test self-contained
 * (pnut-ts is NOT required at test time).
 *
 * SCOPE: this verifies mnemonic naming across every encoding class the decoder
 * supports. Byte-exact operand-TEXT/alignment parity is NOT asserted here —
 * pnut-ts emits no disassembly text, so the only authoritative operand-text
 * reference would be the original Pascal PNut disassembler (unavailable). See
 * TECHNICAL-DEBT.md §2.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pasm2Disassembler } from '../src/classes/debugger/renderer/pasm2Disassembler';

interface CorpusEntry {
  addr: number;
  word: string;
  mnem: string;
}
const corpusData = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'pasm2_corpus.json'), 'utf8')) as {
  corpus: CorpusEntry[];
};
const corpus: CorpusEntry[] = corpusData.corpus;

describe('PASM2 disassembler — source-driven corpus on real pnut-ts encodings (§6)', () => {
  const dis = new Pasm2Disassembler();

  it('the baked corpus is non-trivial and well-formed', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(150);
    for (const e of corpus) {
      expect(typeof e.word).toBe('string');
      expect(e.word).toMatch(/^0x[0-9a-f]{8}$/);
      expect(e.mnem.length).toBeGreaterThan(0);
    }
  });

  it.each(corpus.map((e) => [e.word, e.mnem, e.addr] as const))(
    'decodes authoritative encoding %s -> %s',
    (word, mnem, addr) => {
      const d = dis.decode(parseInt(word, 16) >>> 0, addr);
      expect(d.known).toBe(true);
      expect(d.mnemonic).toBe(mnem);
    }
  );

  it('names 100% of the corpus (no raw-hex fallback, no mnemonic mismatch)', () => {
    const misses = corpus.filter((e) => {
      const d = dis.decode(parseInt(e.word, 16) >>> 0, e.addr);
      return !d.known || d.mnemonic !== e.mnem;
    });
    // Surface every miss by name so a coverage regression is actionable.
    expect(misses.map((m) => `${m.word} expected '${m.mnem}'`)).toEqual([]);
  });
});
