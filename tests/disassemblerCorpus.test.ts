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
 * SCOPE: this verifies mnemonic naming across every encoding class. Exact text
 * (operands, columns, effects) is asserted by tests/pnutDisassemblerText.test.ts
 * against PNut's own disassembler rules (p2com.asm _disassemble).
 *
 * Where PNut's disassembler names an encoding differently from the source
 * alias that produced it, the expectation is PNut's name (DISPLAY_NAME below).
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

/**
 * Source aliases PNut's disassembler shows under another name. AKPIN has no
 * `da_ins` row: the assembler encodes it as WRPIN #1,S (p2com.asm:5723), so
 * PNut displays `wrpin`.
 */
const DISPLAY_NAME: { [sourceMnemonic: string]: string } = { akpin: 'wrpin' };
const shown = (mnem: string): string => DISPLAY_NAME[mnem] ?? mnem;

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
      expect(d.mnemonic).toBe(shown(mnem));
    }
  );

  it('names 100% of the corpus (no <error>, no mnemonic mismatch)', () => {
    const misses = corpus.filter((e) => {
      const d = dis.decode(parseInt(e.word, 16) >>> 0, e.addr);
      return !d.known || d.mnemonic !== shown(e.mnem);
    });
    // Surface every miss by name so a coverage regression is actionable.
    expect(misses.map((m) => `${m.word} expected '${shown(m.mnem)}'`)).toEqual([]);
  });
});
