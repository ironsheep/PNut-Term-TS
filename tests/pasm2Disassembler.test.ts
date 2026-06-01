/** @format */

/**
 * Tests for the PASM2 disassembler (§4/§5). Encodes known instructions from
 * their authoritative bit layouts and checks the decoder names them correctly —
 * the silicon-exact replacement for the old fabricated table.
 */

import { Pasm2Disassembler } from '../src/classes/debugger/renderer/pasm2Disassembler';

const dis = new Pasm2Disassembler();

/** Build an instruction word from fields. */
function enc(cond: number, op7: number, czi: number, d: number, s: number): number {
  return (((cond & 0xf) << 28) | ((op7 & 0x7f) << 21) | ((czi & 0x7) << 18) | ((d & 0x1ff) << 9) | (s & 0x1ff)) >>> 0;
}
const ALWAYS = 0xf;

describe('Pasm2Disassembler (§4/§5)', () => {
  it('decodes core ALU/move opcodes by silicon-exact opcode field (bits 27:21)', () => {
    expect(dis.decode(enc(ALWAYS, 0x08, 0, 0x101, 0x102)).mnemonic).toBe('add');     // ADD = 0001000
    expect(dis.decode(enc(ALWAYS, 0x0c, 0, 1, 2)).mnemonic).toBe('sub');             // SUB = 0001100
    expect(dis.decode(enc(ALWAYS, 0x30, 0, 1, 2)).mnemonic).toBe('mov');             // MOV = 0110000
    expect(dis.decode(enc(ALWAYS, 0x28, 0, 1, 2)).mnemonic).toBe('and');             // AND = 0101000
    expect(dis.decode(enc(ALWAYS, 0x2a, 0, 1, 2)).mnemonic).toBe('or');              // OR  = 0101010
  });

  it('renders D,S operands with the immediate (#) flag from bit 18', () => {
    const reg = dis.decode(enc(ALWAYS, 0x08, 0b000, 0x101, 0x102)); // I=0
    expect(reg.operands).toBe('$101, $102');
    const imm = dis.decode(enc(ALWAYS, 0x08, 0b001, 0x101, 0x05));  // I=1 → #S
    expect(imm.operands).toBe('$101, #$5');
  });

  it('decodes the condition field (bits 31:28)', () => {
    expect(dis.decode(enc(0xa, 0x08, 0, 1, 2)).mnemonic).toBe('if_z add');   // 1010 = if_z
    expect(dis.decode(enc(0xc, 0x08, 0, 1, 2)).mnemonic).toBe('if_c add');   // 1100 = if_c
    expect(dis.decode(enc(ALWAYS, 0x08, 0, 1, 2)).mnemonic).toBe('add');     // 1111 = always (no prefix)
  });

  it('resolves 1101011 sub-opcodes (specific S-field) before the generic group', () => {
    // RET = EEEE 1101011 CZ1 000000000 000101101
    const ret = (((ALWAYS << 28) | (0x6b << 21) | (0b001 << 18) | (0 << 9) | 0b000101101) >>> 0);
    expect(dis.decode(ret).mnemonic).toBe('ret');
    // GETCT D = EEEE 1101011 C00 DDDDDDDDD 000011010
    const getct = (((ALWAYS << 28) | (0x6b << 21) | (0b000 << 18) | (0x40 << 9) | 0b000011010) >>> 0);
    expect(dis.decode(getct).mnemonic).toBe('getct');
    expect(dis.decode(getct).operands).toBe('$040');
  });

  it('decodes NOP (all zeros) with no spurious _ret_ condition prefix', () => {
    const nop = dis.decode(0x00000000);
    expect(nop.mnemonic).toBe('nop');   // not "_ret_ nop"
    expect(nop.known).toBe(true);
    expect(nop.text).toContain('nop');
  });

  it('decodes a CORDIC and a pin instruction (full-coverage spot check)', () => {
    // QMUL = EEEE 1101000 0LI DDDDDDDDD SSSSSSSSS  (op7=0x68)
    expect(dis.decode(enc(ALWAYS, 0x68, 0, 1, 2)).mnemonic).toBe('qmul');
    // DRVH = EEEE 1101011 CZL DDDDDDDDD 001011001
    const drvh = (((ALWAYS << 28) | (0x6b << 21) | (0 << 18) | (0x10 << 9) | 0b001011001) >>> 0);
    expect(dis.decode(drvh).mnemonic).toBe('drvh');
  });

  // Full-coverage cross-class check: a representative encoding from each major
  // class must decode to a named instruction (not the raw-hex fallback). Builds
  // each word from its authoritative bit pattern.
  it('decodes a representative instruction from every class (no class absent)', () => {
    const M = 0x6b; // 1101011 misc group opcode
    // event J* (op7=0x5E '1011110', czi=01x, S-subfield in D)
    const jint = (((ALWAYS << 28) | (0x5e << 21) | (0b010 << 18) | (0b000000000 << 9) | 0x10) >>> 0);
    expect(dis.decode(jint).mnemonic).toBe('jint');
    // POLL/WAIT event (misc group, D-subfield = event id, S=000100100)
    const waitint = (((ALWAYS << 28) | (M << 21) | (0b000 << 18) | (0b000010000 << 9) | 0b000100100) >>> 0);
    expect(dis.decode(waitint).mnemonic).toBe('waitint');
    // AUGS = EEEE 11110SS ...  (op[27:23]=11110)
    const augs = (((ALWAYS << 28) | (0b11110 << 23) | 0x123) >>> 0);
    expect(dis.decode(augs).mnemonic).toBe('augs');
    expect(dis.decode(augs).operands.startsWith('#$')).toBe(true);
    // SETQ = misc D-op 000101000
    const setq = (((ALWAYS << 28) | (M << 21) | (0 << 18) | (1 << 9) | 0b000101000) >>> 0);
    expect(dis.decode(setq).mnemonic).toBe('setq');
    // COGINIT = EEEE 1100111 CLI ...  (op7=0x67)
    expect(dis.decode(enc(ALWAYS, 0x67, 0, 1, 2)).mnemonic).toBe('coginit');
    // ALTI = EEEE 1001101 00I ...  (op7=0x4D, czi top2=00)
    expect(dis.decode(enc(ALWAYS, 0x4d, 0b000, 1, 2)).mnemonic).toBe('alti');
    // hub-RAM RDLONG = EEEE 1011000 CZI ... (op7=0x58)
    expect(dis.decode(enc(ALWAYS, 0x58, 0, 1, 2)).mnemonic).toBe('rdlong');
    // pin variant DRVNOT = misc 001011111
    const drvnot = (((ALWAYS << 28) | (M << 21) | 0 | (0x10 << 9) | 0b001011111) >>> 0);
    expect(dis.decode(drvnot).mnemonic).toBe('drvnot');
  });
});
