/** @format */

/**
 * Exact disassembly text, per PNut v55's own disassembler (`_disassemble`,
 * p2com.asm:17946-18830), the routine `DebuggerUnit.pas:1513-1516` calls for
 * every disassembly row.
 *
 * Encodings are real: tests/fixtures/pnut_disasm_text.spin2 compiled by pnut-ts
 * (cog code at hub $000, the `orgh $400` block at $400). Each expectation is the
 * source line rendered by PNut's rules:
 *   condition 12 wide + ' ' · mnemonic 7 wide + ' ' · operands from col 21 ·
 *   effects at col 37 (flag_tab) · padded / cut to 41 characters.
 */

import { Pasm2Disassembler } from '../src/classes/debugger/renderer/pasm2Disassembler';
import { PNUT_DA_INS } from '../src/classes/debugger/renderer/pnutDisasmTable';

/** PNut's layout: what `_disassemble` writes for these fields. */
function pnut(cond: string, mnem: string, ops: string, flags = ''): string {
  let s = cond.padEnd(12) + ' ' + mnem.padEnd(7) + ' ' + ops;
  if (flags) s = s.padEnd(37) + flags.padEnd(4);
  return s.padEnd(41);
}

// [word, addr, expected, source line]
const CASES: Array<[number, number, string, string]> = [
  [0xF18FAA01, 0x000, pnut('', 'sub', '$1D5,#$001', 'wz'), 'sub $1D5,#1 wz'],
  [0x5D64002D, 0x001, pnut('if_nz', 'ret', ''), 'if_nz ret'],
  [0x0C7801F7, 0x002, pnut('_ret_', 'rdfast', '#$000,pb'), '_ret_ rdfast #0,pb  ($1F7 prints by name)'],
  [0xF61BEDF8, 0x003, pnut('', 'mov', 'pa,ptra', 'wcz'), 'mov pa,ptra wcz'],
  // da_s_branch: cog target (addr + 1 + off) in 3 digits, and NO '$'
  [0xFB6C21FB, 0x004, pnut('', 'djnz', '$010,#000'), 'djnz $10,#c0'],
  [0xFB97EDFE, 0x005, pnut('', 'tjz', 'pa,#004'), 'tjz pa,#c4'],
  // da_addr20: relative cog (addr + off/4 + 1), absolute '#\$'
  [0xFD9FFFE4, 0x006, pnut('', 'jmp', '#$000'), 'jmp #c0'],
  [0xFD800004, 0x007, pnut('', 'jmp', '#\\$004'), 'jmp #\\c4'],
  // PNut scales a cog-relative LOC offset as JMP's (/4) although LOC encodes
  // longs: the target is $000, PNut shows $006. Kept for parity.
  [0xFE9FFFF7, 0x008, pnut('', 'loc', 'pa,#$006'), 'loc pa,#c0'],
  [0xFEC00004, 0x009, pnut('', 'loc', 'ptra,#\\$004'), 'loc ptra,#\\c4'],
  [0xFB27EFF5, 0x00A, pnut('', 'calld', 'pb,#000'), 'calld pb,#c0'],
  // da_s_ptr
  [0xFB07ED61, 0x00B, pnut('', 'rdlong', 'pa,ptra++'), 'rdlong pa,ptra++'],
  [0xFB07EDDD, 0x00C, pnut('', 'rdlong', 'pa,--ptrb[3]'), 'rdlong pa,--ptrb[3]'],
  [0xFB07ED3E, 0x00D, pnut('', 'rdlong', 'pa,ptra[-2]'), 'rdlong pa,ptra[-2]'],
  [0xFB07EC20, 0x00E, pnut('', 'rdlong', 'pa,#$20'), 'rdlong pa,#$20  (8-bit address, 2 digits)'],
  [0xFC67ED85, 0x00F, pnut('', 'wrlong', 'pa,ptrb[5]'), 'wrlong pa,ptrb[5]'],
  // pin and bit ranges print #end..base in decimal
  [0xFD650659, 0x010, pnut('', 'drvh', '#5..3'), 'drvh #3 addpins 2'],
  [0xFD740A42, 0x011, pnut('', 'testp', '#5', 'andc'), 'testp #5 andc'],
  [0xF48FEC07, 0x012, pnut('', 'testb', 'pa,#7', 'orz'), 'testb pa,#7 orz'],
  [0xF407EC62, 0x013, pnut('', 'bitl', 'pa,#5..2'), 'bitl pa,#2 addbits 3'],
  // byte / nib / word selectors
  [0xF8F3EDF7, 0x014, pnut('', 'getbyte', 'pa,pb,#2'), 'getbyte pa,pb,#2'],
  [0xF82FEC0F, 0x015, pnut('', 'setnib', 'pa,#$00F,#5'), 'setnib pa,#$F,#5'],
  [0xF93BEDF7, 0x016, pnut('', 'getword', 'pa,pb,#1'), 'getword pa,pb,#1'],
  // single-operand forms (ds_alt #0, ds_alti #$164, ds_single D=S)
  [0xF98FEC00, 0x017, pnut('', 'altd', 'pa'), 'altd pa'],
  [0xF9A7ED64, 0x018, pnut('', 'alti', 'pa'), 'alti pa'],
  [0xF623EDF6, 0x019, pnut('', 'not', 'pa'), 'not pa'],
  // MODCZ operands
  [0xFD7D8A6F, 0x01A, pnut('', 'modcz', '_c,_nz', 'wcz'), 'modcz _c,_nz wcz'],
  [0xFD75E06F, 0x01B, pnut('', 'modc', '_set', 'wc'), 'modc _set wc'],
  // do_aug: six hex digits of (inst << 1), then 'xx'
  [0xFF000091, 0x01C, pnut('', 'augs', '#$000122xx'), 'augs #$12345'],
  [0xF607EDFF, 0x01D, pnut('', 'mov', 'pa,#$1FF'), 'mov pa,#$1FF'],
  [0xFD73EC01, 0x01E, pnut('', 'cogid', 'pa', 'wc'), 'cogid pa wc'],
  [0xFCDC0604, 0x01F, pnut('', 'rep', '#$003,#$004'), 'rep #3,#4'],
  // AKPIN has no da_ins row; it is WRPIN #1,S
  [0xFC0C0202, 0x020, pnut('', 'wrpin', '#$001,#2'), 'akpin #2'],
  [0xFD641E28, 0x021, pnut('', 'setq', '#$00F'), 'setq #$F'],
  [0xFD7C141F, 0x022, pnut('', 'waitx', '#$00A', 'wcz'), 'waitx #10 wcz'],
  [0xFD73EC1A, 0x023, pnut('', 'getct', 'pa', 'wc'), 'getct pa wc'],
  [0xFAABEDF7, 0x024, pnut('', 'rdlut', 'pa,pb', 'wz'), 'rdlut pa,pb wz'],
  [0x00000000, 0x025, pnut('', 'nop', ''), 'nop  (no _ret_ prefix)'],
  // hub: s_branch (addr + 4 + off*4) in 5 digits; addr20 relative (addr + off + 4)
  [0xFB6FEDFF, 0x400, pnut('', 'djnz', 'pa,#00400'), 'djnz pa,#h0'],
  [0xFD9FFFF8, 0x404, pnut('', 'jmp', '#$00400'), 'jmp #h0'],
  [0xFEBFFFF4, 0x408, pnut('', 'loc', 'pb,#$00400'), 'loc pb,#h0'],
  [0xFD800400, 0x40C, pnut('', 'jmp', '#\\$00400'), 'jmp #\\h0'],
];

describe('PNut disassembly text — exact strings (p2com.asm _disassemble)', () => {
  const dis = new Pasm2Disassembler();

  it.each(CASES)('0x%s at %s', (word, addr, expected) => {
    expect(dis.decode(word, addr).text).toBe(expected);
  });

  it('every result is exactly 41 characters (zero-terminated at flag_tab + 4)', () => {
    for (const [word, addr] of CASES) expect(dis.decode(word, addr).text).toHaveLength(41);
  });

  it('operands that reach flag_tab are cut back to column 36, then one space, then the effects', () => {
    // modcz _nc_and_nz,_nc_and_nz wcz  (pnut-ts: $FD7C226F)
    expect(dis.decode(0xFD7C226F, 0).text).toBe('             modcz   _nc_and_nz,_nc_ wcz ');
    // operands ending at column 36 are padded to 37, not cut
    // if_c_or_nz rdlong $1EF,--ptrb[16] wcz  (pnut-ts: $DB1FDFD0)
    expect(dis.decode(0xDB1FDFD0, 1).text).toBe('if_c_or_nz   rdlong  $1EF,--ptrb[16] wcz ');
  });

  it('registers $1F0..$1FF print by name, everything below as $xxx', () => {
    const names = ['ijmp3', 'iret3', 'ijmp2', 'iret2', 'ijmp1', 'iret1', 'pa', 'pb',
                   'ptra', 'ptrb', 'dira', 'dirb', 'outa', 'outb', 'ina', 'inb'];
    for (let r = 0; r < 16; r++) {
      const mov = (0xF6000000 | ((0x1F0 + r) << 9) | 0x1EF) >>> 0;   // mov $1Fx,$1EF
      expect(dis.decode(mov, 0).operands).toBe(`${names[r]},$1EF`);
    }
  });

  it('a long no row describes is <error>, and decode() reports it unknown', () => {
    const last = PNUT_DA_INS[PNUT_DA_INS.length - 1];
    expect(last[2]).toBe('<error>');
    // $FBCBFE00: the J-event group (1011110 01I) with D=$1FF, which names no event.
    const d = dis.decode(0xFBCBFE00, 0);
    expect(d.known).toBe(false);
    expect(d.text).toBe(pnut('', '<error>', ''));
    // and a named neighbour: D=$000 is JINT
    expect(dis.decode(0xFBC80000, 0).mnemonic).toBe('jint');
  });

  it('the generated table is PNut v55: 368 rows, ror first, <error> last', () => {
    expect(PNUT_DA_INS).toHaveLength(368);
    expect(PNUT_DA_INS[0][2]).toBe('ror    ');
  });
});
