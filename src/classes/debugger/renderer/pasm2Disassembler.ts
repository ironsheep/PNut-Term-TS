/** @format */

/**
 * PASM2 disassembler for the single-step debugger disassembly panel.
 *
 * A one-for-one port of PNut's own disassembler, `_disassemble` in p2com.asm
 * (PNut v55, lines 17946-18830), which `DebuggerUnit.pas:1513-1516` calls for
 * every disassembly row. The instruction table is generated from PNut's
 * `da_ins` by scripts/claude/gen-pnut-disasm-table.mjs (pnutDisasmTable.ts).
 *
 * Output layout, as PNut builds it:
 *   col 0   condition, 12 wide, then one space
 *   col 13  mnemonic, 7 wide, then one space
 *   col 21  operands
 *   col 37  effects (flag_tab); if the operands reach it, the text is cut
 *           back to 36 characters and one space is written
 *   the result is padded with spaces and cut to exactly 41 characters.
 *
 * Every handler below names the p2com.asm routine it ports. Behaviour that
 * looks odd (no '$' on DJNZ/TJZ-style branch targets, `#end..base` pin ranges)
 * is PNut's and is kept as written.
 */

import { PNUT_DA_INS, PNUT_DA_NOP, PnutDisasmRow } from './pnutDisasmTable';

/** flag_tab: column the effects field starts at. */
const FLAG_TAB = 37;
/** The string is zero-terminated at flag_tab + 4. */
const STRING_LEN = FLAG_TAB + 4;

/** da_cond — 12 characters each, indexed by the condition nibble. */
const DA_COND: readonly string[] = [
  '_ret_       ', 'if_nc_and_nz', 'if_nc_and_z ', 'if_nc       ',
  'if_c_and_nz ', 'if_nz       ', 'if_c_ne_z   ', 'if_nc_or_nz ',
  'if_c_and_z  ', 'if_c_eq_z   ', 'if_z        ', 'if_nc_or_z  ',
  'if_c        ', 'if_c_or_nz  ', 'if_c_or_z   ', '            '
];

/** da_regs — names for $1F0..$1FF. */
const DA_REGS: readonly string[] = [
  'ijmp3', 'iret3', 'ijmp2', 'iret2', 'ijmp1', 'iret1', 'pa', 'pb',
  'ptra', 'ptrb', 'dira', 'dirb', 'outa', 'outb', 'ina', 'inb'
];

/** da_mods — MODCZ operands. */
const DA_MODS: readonly string[] = [
  '_clr', '_nc_and_nz', '_nc_and_z', '_nc', '_c_and_nz', '_nz', '_c_ne_z', '_nc_or_nz',
  '_c_and_z', '_c_eq_z', '_z', '_nc_or_z', '_c', '_c_or_nz', '_c_or_z', '_set'
];

/** da_flag's table: indexed by C,Z (bits 20,19). */
const DA_FLAG: readonly string[] = ['    ', 'wz  ', 'wc  ', 'wcz '];
/** da_flag_logic's table. */
const DA_FLAG_LOGIC: readonly string[] = ['wz  ', 'wc  ', 'andz', 'andc', 'orz ', 'orc ', 'xorz', 'xorc'];

export interface DecodedLine {
  /** PNut's mnemonic, trimmed ('<error>' for a long no table row describes). */
  mnemonic: string;
  /** The text PNut writes after the mnemonic, trimmed. */
  operands: string;
  /** The full 41-character string PNut's P2Disassemble returns. */
  text: string;
  /** False only for the '<error>' row. */
  known: boolean;
}

/** One disassembly in progress: the output string and PNut's edx register. */
class Line {
  public s = '';
  constructor(public edx: number, public readonly addr: number) {}

  public put(t: string): void { this.s += t; }

  /** da_hex — `digits` uppercase hex digits of the low bits of v. */
  public hex(v: number, digits: number): void {
    const low = (v >>> 0) % (2 ** (digits * 4));
    this.s += low.toString(16).toUpperCase().padStart(digits, '0');
  }

  /** da_dec — tens digit only when non-zero, then the ones digit. */
  public dec(v: number): void {
    v &= 0xFF;
    const tens = Math.floor(v / 10);
    if (tens !== 0) this.s += String.fromCharCode(0x30 + tens);
    this.s += String.fromCharCode(0x30 + (v % 10));
  }

  /** da_flag_tab — tab to flag_tab, or cut back to flag_tab-1 and write one space. */
  public flagTab(): void {
    if (this.s.length < FLAG_TAB) this.s = this.s.padEnd(FLAG_TAB, ' ');
    else this.s = this.s.slice(0, FLAG_TAB - 1) + ' ';
  }
}

// ── register / immediate printers (da_d, da_l, da_s ...) ─────────────────────

function daReg(L: Line, index: number): void { L.put(DA_REGS[index & 0xF]); }
function daMod(L: Line, index: number): void { L.put(DA_MODS[index & 0xF]); }

/** da_lh — '$' + three hex digits of D. */
function daLh(L: Line): void { L.put('$'); L.hex((L.edx >>> 9) & 0x1FF, 3); }

/** da_d — D as a register: $xxx below $1F0, else its name. */
function daD(L: Line): void {
  const d = (L.edx >>> 9) & 0x1FF;
  if (d < 0x1F0) daLh(L); else daReg(L, d & 0xF);
}

/** da_lx — `#$xxx` when `immediate`, else da_d. */
function daLx(L: Line, immediate: boolean): void {
  if (!immediate) { daD(L); return; }
  L.put('#'); daLh(L);
}
/** da_l — {#}D keyed on I (bit 18). */
function daL(L: Line): void { daLx(L, (L.edx & (1 << 18)) !== 0); }
/** da_ls — {#}D keyed on L (bit 19). */
function daLs(L: Line): void { daLx(L, (L.edx & (1 << 19)) !== 0); }

/** da_l_pin2 — the 6-bit pin number in D, decimal. */
function daLPin2(L: Line): void { L.dec((L.edx >>> 9) & 0x3F); }

/** da_l_pin — {#}D pin, with an ADDPINS range printed as `#end..base`. */
function daLPin(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daD(L); return; }
  L.put('#');
  const n = (L.edx >>> 15) & 0x07;
  if (n !== 0) {
    const bl = (L.edx >>> 9) & 0xFF;
    L.dec(((n + bl) & 0x1F) | (bl & 0x20));
    L.put('..');
  }
  daLPin2(L);
}

/** da_l_pin_log — {#}D pin, no range. */
function daLPinLog(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daD(L); return; }
  L.put('#');
  daLPin2(L);
}

/** da_sh — '$' + three hex digits of S. */
function daSh(L: Line): void { L.put('$'); L.hex(L.edx & 0x1FF, 3); }

/** da_sr — S as a register: $xxx below $1F0, else its name. */
function daSr(L: Line): void {
  const s = L.edx & 0x1FF;
  if (s < 0x1F0) daSh(L); else daReg(L, s & 0xF);
}

/** da_s — {#}S. */
function daS(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daSr(L); return; }
  L.put('#'); daSh(L);
}

/** da_s_bit — {#}S bit number, with a bit range printed as `#end..base`. */
function daSBit(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daS(L); return; }
  L.put('#');
  const n = (L.edx >>> 5) & 0x0F;
  if (n !== 0) {
    L.dec((n + (L.edx & 0xFF)) & 0x1F);
    L.put('..');
  }
  L.dec(L.edx & 0x1F);
}

/** da_s_bit_log — {#}S bit number, no range. */
function daSBitLog(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daS(L); return; }
  L.put('#');
  L.dec(L.edx & 0x1F);
}

/** da_s_pin — {#}S pin, with an ADDPINS range printed as `#end..base`. */
function daSPin(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daS(L); return; }
  L.put('#');
  const n = (L.edx >>> 6) & 0x07;
  if (n !== 0) {
    const dl = L.edx & 0xFF;
    L.dec(((n + dl) & 0x1F) | (dl & 0x20));
    L.put('..');
  }
  L.dec(L.edx & 0x3F);
}

/**
 * da_s_branch — {#}S relative branch. PNut prints the target with no '$':
 * cog `(addr + 1 + off) & $3FF` in 3 digits, hub `(addr + 4 + off*4)` in 5.
 */
function daSBranch(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daSr(L); return; }
  L.put('#');
  const off = ((L.edx << 23) >> 23);          // sign-extend 9 bits
  const base = L.addr & 0xFFFFF;
  if (base < 0x400) L.hex((off + base + 1) & 0x3FF, 3);
  else L.hex(((off << 2) + base + 4) & 0xFFFFF, 5);
}

/** da_s_ptr — {#}S hub address: register, `#$xx`, or a PTRx expression. */
function daSPtr(L: Line): void {
  if ((L.edx & (1 << 18)) === 0) { daSr(L); return; }
  const dl = L.edx & 0xFF;
  if ((L.edx & 0x100) === 0) {              // 8-bit address
    L.put('#$'); L.hex(dl, 2);
    return;
  }
  const ptrx = () => L.put((dl & 0x80) ? 'ptrb' : 'ptra');
  const incdec = () => L.put((dl & 0x10) ? '--' : '++');
  if ((dl & 0x40) === 0) {                  // non-updating PTRx
    ptrx();
    if ((dl & 0x3F) === 0) return;
    L.put('[');
    if (dl & 0x20) L.put('-');
    let al = dl;
    if (al & 0x20) al = (-al) & 0xFF;
    L.dec(al & 0x3F);
    L.put(']');
    return;
  }
  if ((dl & 0x20) === 0) incdec();          // pre-update
  ptrx();
  if (dl & 0x20) incdec();                  // post-update
  const idx = dl & 0x1F;
  if (idx === 0x01 || idx === 0x1F) return;
  L.put('[');
  let ah = (-dl) & 0xFF;
  if ((dl & 0x10) === 0) {
    ah = dl;
    if ((dl & 0x0F) === 0) ah = 0x10;
  }
  L.dec(ah & 0x1F);
  L.put(']');
}

/** da_addr — '$' + 3 digits below $400, else 5. */
function daAddr(L: Line, v: number): void {
  L.put('$');
  v &= 0xFFFFF;
  L.hex(v, v < 0x400 ? 3 : 5);
}

/** da_addr20 — `#$addr` relative (cog or hub) or `#\$addr` absolute. */
function daAddr20(L: Line): void {
  L.put('#');
  const a = L.addr & 0xFFFFF;
  if ((L.edx & 0x100000) === 0) {           // absolute
    L.put('\\');
    daAddr(L, L.edx);
    return;
  }
  if (a < 0x400) daAddr(L, a + ((L.edx << 12) >> 14) + 1);   // relative cog
  else daAddr(L, a + L.edx + 4);                              // relative hub
}

/** da_flag — effects from C,Z (bits 20,19) of edx. */
function daFlag(L: Line): void {
  L.flagTab();
  L.put(DA_FLAG[(L.edx >>> 19) & 3]);
}

/** da_flag_logic — effects from a logic index. */
function daFlagLogic(L: Line, index: number): void {
  L.flagTab();
  L.put(DA_FLAG_LOGIC[index & 7]);
}

// ── operand handlers (do_*), keyed by the table's disop name ─────────────────

const comma = (L: Line) => L.put(',');

/** do_ds_single / do_dscz_single: D alone when S is the same register. */
function sameRegister(L: Line): boolean {
  return (L.edx & (1 << 18)) === 0 && (((L.edx >>> 9) ^ L.edx) & 0x1FF) === 0;
}

const HANDLERS: { [op: string]: (L: Line) => void } = {
  addr20: (L) => daAddr20(L),
  aug: (L) => { L.put('#$'); L.hex(L.edx << 1, 6); L.put('xx'); },
  cz: (L) => daFlag(L),
  d: (L) => daD(L),
  dc: (L) => { daD(L); L.edx &= 1 << 20; daFlag(L); },
  dc_modc: (L) => { daMod(L, (L.edx >>> 13) & 0xF); daFlag(L); },
  dcz: (L) => { daD(L); daFlag(L); },
  dcz_modcz: (L) => { daMod(L, (L.edx >>> 13) & 0xF); comma(L); daMod(L, (L.edx >>> 9) & 0xF); daFlag(L); },
  ds: (L) => { daD(L); comma(L); daS(L); },
  ds_alt: (L) => { daD(L); if ((L.edx & ((1 << 18) | 0x1FF)) !== (1 << 18)) { comma(L); daS(L); } },
  ds_alti: (L) => { daD(L); if ((L.edx & ((1 << 18) | 0x1FF)) !== ((1 << 18) + 0x164)) { comma(L); daS(L); } },
  ds_branch: (L) => { daD(L); comma(L); daSBranch(L); },
  ds_byte: (L) => { daD(L); comma(L); daS(L); L.put(',#'); L.dec((L.edx >>> 19) & 3); },
  ds_nib: (L) => { daD(L); comma(L); daS(L); L.put(',#'); L.dec((L.edx >>> 19) & 7); },
  ds_ptr: (L) => { daD(L); comma(L); daSPtr(L); },
  ds_single: (L) => { daD(L); if (!sameRegister(L)) { comma(L); daS(L); } },
  ds_word: (L) => { daD(L); comma(L); daS(L); L.put(',#'); L.dec((L.edx >>> 19) & 1); },
  dsc: (L) => { daD(L); comma(L); daS(L); L.edx &= 1 << 20; daFlag(L); },
  dscz: (L) => { daD(L); comma(L); daS(L); daFlag(L); },
  dscz_bit: (L) => { daD(L); comma(L); daSBit(L); daFlag(L); },
  dscz_bit_log: (L) => {
    daD(L); comma(L); daSBitLog(L);
    const ah = ((((L.edx >>> 20) & 0xD) + 1) & 0xFF) >>> 1;
    daFlagLogic(L, ah);
  },
  dscz_branch: (L) => { daD(L); comma(L); daSBranch(L); daFlag(L); },
  dscz_ptr: (L) => { daD(L); comma(L); daSPtr(L); daFlag(L); },
  dscz_single: (L) => { daD(L); if (!sameRegister(L)) { comma(L); daS(L); } daFlag(L); },
  dsz: (L) => { daD(L); comma(L); daS(L); L.edx &= 1 << 19; daFlag(L); },
  dz_modz: (L) => { daMod(L, (L.edx >>> 9) & 0xF); daFlag(L); },
  l: (L) => daL(L),
  lc: (L) => { daL(L); L.edx &= 1 << 20; daFlag(L); },
  lcz: (L) => { daL(L); daFlag(L); },
  lcz_pin: (L) => { daLPin(L); daFlag(L); },
  lcz_pin_log: (L) => {
    daLPinLog(L);
    let ah = L.edx & 0b110;
    if (L.edx & (1 << 20)) ah |= 0b001;
    daFlagLogic(L, ah);
  },
  ls: (L) => { daLs(L); comma(L); daS(L); },
  ls_branch: (L) => { daLs(L); comma(L); daSBranch(L); },
  ls_pin: (L) => { daLs(L); comma(L); daSPin(L); },
  ls_ptr: (L) => { daLs(L); comma(L); daSPtr(L); },
  lsc: (L) => { daLs(L); comma(L); daS(L); L.edx &= 1 << 20; daFlag(L); },
  lx: (L) => daLs(L),
  none: () => { /* do_none */ },
  p_addr20: (L) => { daReg(L, ((L.edx >>> 21) & 3) + 6); comma(L); daAddr20(L); },
  s: (L) => daS(L),
  s_branch: (L) => daSBranch(L),
  s_pin: (L) => daSPin(L)
};

/** The table row PNut's @@find loop stops at. */
function findRow(inst: number): PnutDisasmRow {
  if (inst === 0) return PNUT_DA_NOP;
  for (const row of PNUT_DA_INS) {
    if (((inst & row[0]) >>> 0) === row[1]) return row;
  }
  return PNUT_DA_INS[PNUT_DA_INS.length - 1]; // '<error>' matches anything; never reached
}

export class Pasm2Disassembler {
  /** PNut's P2Disassemble: `inst` at `addr` (trimmed to 20 bits) → 41-character text. */
  public decode(word: number, addr: number = 0): DecodedLine {
    const inst = word >>> 0;
    const L = new Line(inst, addr & 0xFFFFF);
    L.put(DA_COND[inst === 0 ? 0xF : inst >>> 28]);
    L.put(' ');
    const row = findRow(inst);
    L.put(row[2]);
    L.put(' ');
    const handler = HANDLERS[row[3]];
    if (!handler) throw new Error(`pasm2Disassembler: no handler for disop_${row[3]}`);
    handler(L);
    const text = L.s.length < STRING_LEN ? L.s.padEnd(STRING_LEN, ' ') : L.s.slice(0, STRING_LEN);
    return {
      mnemonic: row[2].trim(),
      operands: text.slice(21).trim(),
      text,
      known: row[2] !== '<error>'
    };
  }
}
