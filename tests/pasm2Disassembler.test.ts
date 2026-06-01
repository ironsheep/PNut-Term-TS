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
});
