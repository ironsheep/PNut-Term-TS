const fs = require('fs');
const rows = require('./pasm2-encodings.json');
const seen = new Set(); const uniq = [];
for (const e of rows) { const k = e.bits + '|' + e.mnem; if (seen.has(k)) continue; seen.add(k); uniq.push(e); }
function parse(bits) {
  const s = bits.replace(/ /g, '');
  if (s.length !== 32) throw new Error('bad len ' + s.length + ': ' + bits);
  let mask = 0, match = 0;
  for (let i = 0; i < 32; i++) { const bit = 31 - i, c = s[i];
    if (c === '0' || c === '1') { mask |= (1 << bit); if (c === '1') match |= (1 << bit); } }
  return { mask: mask >>> 0, match: match >>> 0 };
}
const pop = n => { let c = 0; n >>>= 0; while (n) { c += n & 1; n >>>= 1; } return c; };
const parsed = uniq.map(r => { const p = parse(r.bits); return { ...r, mask: p.mask, match: p.match }; });
parsed.sort((a, b) => pop(b.mask) - pop(a.mask));
const tableLiteral = parsed.map(p =>
  `  [0x${p.mask.toString(16).toUpperCase().padStart(8,'0')}, 0x${p.match.toString(16).toUpperCase().padStart(8,'0')}, '${p.mnem.toLowerCase()}', '${p.fmt}'], // ${p.bits}`
).join('\n');

const mod = `/** @format */

/**
 * PASM2 disassembler for the single-step debugger disassembly panel (§4/§5).
 *
 * TABLE is generated from authoritative p2kb-mcp PASM2 encodings (collected
 * 2026-06-01, ${parsed.length} encoding forms / ${new Set(parsed.map(p=>p.mnem)).size} mnemonics — full instruction set).
 * Each row is [mask, match, mnemonic, operandFormat] derived from the bit
 * pattern: fixed 0/1 bits -> mask+match; EEEE/C/Z/I/L/D/S/A/N/W letters ->
 * don't-care. Rows are pre-sorted most-specific-first so sub-opcodes (the
 * 1101011 misc group, the J/POLL/WAIT event group) resolve before the
 * generic opcode groups.
 *
 * P2 instruction word: EEEE OOOOOOO CZI DDDDDDDDD SSSSSSSSS
 *   bits 31-28 condition, 27-21 opcode, 20 C, 19 Z, 18 I, 17-9 D, 8-0 S.
 */

const CONDITIONS: string[] = [
  '_ret_',
  'if_nc_and_nz', 'if_nc_and_z', 'if_nc',
  'if_c_and_nz',  'if_nz',       'if_c_ne_z', 'if_nc_or_nz',
  'if_c_and_z',   'if_c_eq_z',   'if_z',      'if_nc_or_z',
  'if_c',         'if_c_or_nz',  'if_c_or_z', ''
];

type Row = [number, number, string, string];
const TABLE: Row[] = [
${tableLiteral}
];

const SPECIAL_REG: { [k: number]: string } = {
  0x1F0:'ijmp3',0x1F1:'iret3',0x1F2:'ijmp2',0x1F3:'iret2',0x1F4:'ijmp1',0x1F5:'iret1',
  0x1F6:'pa',0x1F7:'pb',0x1F8:'ptra',0x1F9:'ptrb',0x1FA:'dira',0x1FB:'dirb',
  0x1FC:'outa',0x1FD:'outb',0x1FE:'ina',0x1FF:'inb'
};
function fmtReg(v: number): string {
  return SPECIAL_REG[v] ?? '$' + v.toString(16).toUpperCase().padStart(3, '0');
}
function imm(v: number): string { return '#$' + v.toString(16).toUpperCase(); }

export interface DecodedLine {
  mnemonic: string;
  operands: string;
  text: string;
  known: boolean;
}

export class Pasm2Disassembler {
  public decode(word: number, addr: number = 0): DecodedLine {
    word >>>= 0;
    const cond = CONDITIONS[(word >>> 28) & 0xF] ?? '';
    let row: Row | undefined;
    for (const r of TABLE) { if (((word & r[0]) >>> 0) === r[1]) { row = r; break; } }
    if (!row) {
      const raw = '$' + word.toString(16).toUpperCase().padStart(8, '0');
      return { mnemonic: '', operands: '', text: raw, known: false };
    }
    const mnem = row[2];
    const operands = this.operands(word, addr, row[3]);
    const condPrefix = (cond && mnem !== 'nop') ? cond + ' ' : '';
    const text = (condPrefix + mnem + (operands ? '  ' + operands : '')).trimEnd();
    return { mnemonic: condPrefix + mnem, operands, text, known: true };
  }

  private operands(word: number, addr: number, fmt: string): string {
    const D = (word >>> 9) & 0x1FF;
    const S = word & 0x1FF;
    const I = (word >>> 18) & 1;
    const sOrImm = I ? imm(S) : fmtReg(S);
    switch (fmt) {
      case 'operand_nop': case 'operand_pollwait': case 'operand_ret': return '';
      case 'operand_aug': return '#$' + (word & 0x7FFFFF).toString(16).toUpperCase();
      case 'operand_d': case 'operand_de': case 'operand_getbrk': case 'operand_cz':
        return fmtReg(D);
      case 'operand_l': case 'operand_pinop': case 'operand_testp': case 'operand_jmpd':
        return I ? imm(D) : fmtReg(D);
      case 'operand_jmp': case 'operand_call': case 'operand_calld': case 'operand_loc': {
        const R = (word >>> 20) & 1;
        const a = word & 0xFFFFF;
        if (R) { const off = (a << 12) >> 12; return '#$' + (((addr + off) >>> 0)).toString(16).toUpperCase(); }
        return '#$' + a.toString(16).toUpperCase();
      }
      // D, {#}S families (ds, du, dsp, ls, lsp, lsj, dsj, bitx, testb, *get/*set, akpin, rep, ...)
      default: return fmtReg(D) + ', ' + sOrImm;
    }
  }
}
`;
fs.writeFileSync(__dirname + '/../../src/classes/debugger/renderer/pasm2Disassembler.ts', mod);
console.log('wrote module:', parsed.length, 'rows,', new Set(parsed.map(p=>p.mnem)).size, 'mnemonics');
