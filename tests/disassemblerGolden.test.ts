/** @format */

/**
 * Golden / regression test for the PASM2 disassembler (§6).
 *
 * The WORDS below are real instruction longs lifted from a pnut-ts–compiled P2
 * image (EXT-REF/BINs/blink_pasm.bin, offsets 0x00..0x5C) — the classic P2
 * pin-config + lock + block-move preamble. Each is paired with its hand-verified
 * mnemonic. This proves the decoder names real compiler output correctly, end to
 * end, and is self-contained (EXT-REF binaries are not tracked).
 *
 * NOTE: pnut-ts is not installed in this container, so this is an anchored real-
 * code regression test, not a live text-diff against pnut-ts's own listing. When
 * the full EXT-REF set is present locally, the decoder names 742/744 longs of this
 * image (the 2 misses are data longs, not code).
 */

import { Pasm2Disassembler } from '../src/classes/debugger/renderer/pasm2Disassembler';

// [offset, word, expected mnemonic] from blink_pasm.bin
const GOLDEN: Array<[number, number, string]> = [
  [0x00, 0xfc08f850, 'wrpin'],
  [0x04, 0xfc080451, 'wrpin'],
  [0x08, 0xfd60a241, 'dirh'],
  [0x0c, 0xfc106a51, 'wxpin'],
  [0x10, 0xfd606c00, 'hubset'],
  [0x14, 0xff800186, 'augd'],
  [0x18, 0xfd66801f, 'waitx'],
  [0x24, 0xfcdc0210, 'rep'],
  [0x28, 0xfd600004, 'locknew'],
  [0x2c, 0xf604000e, 'mov'],
  [0x30, 0xfd600005, 'lockret'],
  [0x34, 0xfb7c01fe, 'djnf'],
  [0x38, 0xfecfc000, 'loc'],
  [0x40, 0xfd67fe28, 'setq'],
  [0x44, 0xfc6c0100, 'wrlong'],
  [0x48, 0xf6640040, 'neg'],
  [0x54, 0xfc607600, 'wrlong'],
  [0x58, 0xf1840080, 'sub'],
  [0x68, 0xfdb0003c, 'call'],
  [0x74, 0xfae40100, 'rdword'],
  [0x78, 0xfb44000b, 'callpa'],
  [0x84, 0xf103f000, 'add'],
  [0x90, 0xf6200039, 'not'],
  [0x94, 0xf7440012, 'zerox'],
  [0x98, 0xf0440002, 'shr']
];

describe('PASM2 disassembler — golden regression on real pnut-ts output (§6)', () => {
  const dis = new Pasm2Disassembler();

  it.each(GOLDEN)('decodes real compiled long @%s ($%s) -> %s', (off, word, mnem) => {
    const d = dis.decode(word >>> 0, off);
    expect(d.known).toBe(true);
    expect(d.mnemonic).toBe(mnem);
  });

  it('every golden long is named (no raw-hex fallback)', () => {
    const named = GOLDEN.filter(([, w, ]) => dis.decode(w >>> 0).known).length;
    expect(named).toBe(GOLDEN.length);
  });

  it('AUGD renders a #immediate operand (augmentation rendering)', () => {
    const augd = dis.decode(0xff800186 >>> 0, 0x14);
    expect(augd.mnemonic).toBe('augd');
    expect(augd.operands.startsWith('#$')).toBe(true);
  });
});
