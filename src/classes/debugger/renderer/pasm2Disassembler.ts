/** @format */

/**
 * PASM2 disassembler for the single-step debugger disassembly panel (§4/§5).
 *
 * TABLE is generated from authoritative p2kb-mcp PASM2 encodings (collected
 * 2026-06-01, 350 encoding forms / 347 mnemonics — full instruction set).
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
  [0xFFFFFFFF, 0x00000000, 'nop', 'operand_nop'], // 0000 0000000 000 000000000 000000000
  [0x0FFFFFFF, 0x0CAC0000, 'xstop', 'operand_nop'], // EEEE 1100101 011 000000000 000000000
  [0x0FFFFFFF, 0x0D604024, 'allowi', 'operand_pollwait'], // EEEE 1101011 000 000100000 000100100
  [0x0FFFFFFF, 0x0D604A24, 'nixint1', 'operand_pollwait'], // EEEE 1101011 000 000100101 000100100
  [0x0FFFFFFF, 0x0D604C24, 'nixint2', 'operand_pollwait'], // EEEE 1101011 000 000100110 000100100
  [0x0FFFFFFF, 0x0D604E24, 'nixint3', 'operand_pollwait'], // EEEE 1101011 000 000100111 000100100
  [0x0FFFFFFF, 0x0D604224, 'stalli', 'operand_pollwait'], // EEEE 1101011 000 000100001 000100100
  [0x0FFFFFFF, 0x0D604424, 'trgint1', 'operand_pollwait'], // EEEE 1101011 000 000100010 000100100
  [0x0FFFFFFF, 0x0D604624, 'trgint2', 'operand_pollwait'], // EEEE 1101011 000 000100011 000100100
  [0x0FFFFFFF, 0x0D604824, 'trgint3', 'operand_pollwait'], // EEEE 1101011 000 000100100 000100100
  [0x0FE7FFFF, 0x0D64002D, 'ret', 'operand_ret'], // EEEE 1101011 CZ1 000000000 000101101
  [0x0FE7FFFF, 0x0D64002E, 'reta', 'operand_ret'], // EEEE 1101011 CZ1 000000000 000101110
  [0x0FE7FFFF, 0x0D64002F, 'retb', 'operand_ret'], // EEEE 1101011 CZ1 000000000 000101111
  [0x0FE7FFFF, 0x0D601C24, 'pollatn', 'operand_pollwait'], // EEEE 1101011 CZ0 000001110 000100100
  [0x0FE7FFFF, 0x0D600224, 'pollct1', 'operand_pollwait'], // EEEE 1101011 CZ0 000000001 000100100
  [0x0FE7FFFF, 0x0D600424, 'pollct2', 'operand_pollwait'], // EEEE 1101011 CZ0 000000010 000100100
  [0x0FE7FFFF, 0x0D600624, 'pollct3', 'operand_pollwait'], // EEEE 1101011 CZ0 000000011 000100100
  [0x0FE7FFFF, 0x0D601224, 'pollfbw', 'operand_pollwait'], // EEEE 1101011 CZ0 000001001 000100100
  [0x0FE7FFFF, 0x0D600024, 'pollint', 'operand_pollwait'], // EEEE 1101011 CZ0 000000000 000100100
  [0x0FE7FFFF, 0x0D601024, 'pollpat', 'operand_pollwait'], // EEEE 1101011 CZ0 000001000 000100100
  [0x0FE7FFFF, 0x0D601E24, 'pollqmt', 'operand_pollwait'], // EEEE 1101011 CZ0 000001111 000100100
  [0x0FE7FFFF, 0x0D600824, 'pollse1', 'operand_pollwait'], // EEEE 1101011 CZ0 000000100 000100100
  [0x0FE7FFFF, 0x0D600A24, 'pollse2', 'operand_pollwait'], // EEEE 1101011 CZ0 000000101 000100100
  [0x0FE7FFFF, 0x0D600C24, 'pollse3', 'operand_pollwait'], // EEEE 1101011 CZ0 000000110 000100100
  [0x0FE7FFFF, 0x0D600E24, 'pollse4', 'operand_pollwait'], // EEEE 1101011 CZ0 000000111 000100100
  [0x0FE7FFFF, 0x0D601624, 'pollxfi', 'operand_pollwait'], // EEEE 1101011 CZ0 000001011 000100100
  [0x0FE7FFFF, 0x0D601424, 'pollxmt', 'operand_pollwait'], // EEEE 1101011 CZ0 000001010 000100100
  [0x0FE7FFFF, 0x0D601A24, 'pollxrl', 'operand_pollwait'], // EEEE 1101011 CZ0 000001101 000100100
  [0x0FE7FFFF, 0x0D601824, 'pollxro', 'operand_pollwait'], // EEEE 1101011 CZ0 000001100 000100100
  [0x0FE7FFFF, 0x0D603C24, 'waitatn', 'operand_pollwait'], // EEEE 1101011 CZ0 000011110 000100100
  [0x0FE7FFFF, 0x0D602224, 'waitct1', 'operand_pollwait'], // EEEE 1101011 CZ0 000010001 000100100
  [0x0FE7FFFF, 0x0D602424, 'waitct2', 'operand_pollwait'], // EEEE 1101011 CZ0 000010010 000100100
  [0x0FE7FFFF, 0x0D602624, 'waitct3', 'operand_pollwait'], // EEEE 1101011 CZ0 000010011 000100100
  [0x0FE7FFFF, 0x0D603224, 'waitfbw', 'operand_pollwait'], // EEEE 1101011 CZ0 000011001 000100100
  [0x0FE7FFFF, 0x0D602024, 'waitint', 'operand_pollwait'], // EEEE 1101011 CZ0 000010000 000100100
  [0x0FE7FFFF, 0x0D603024, 'waitpat', 'operand_pollwait'], // EEEE 1101011 CZ0 000011000 000100100
  [0x0FE7FFFF, 0x0D602824, 'waitse1', 'operand_pollwait'], // EEEE 1101011 CZ0 000010100 000100100
  [0x0FE7FFFF, 0x0D602A24, 'waitse2', 'operand_pollwait'], // EEEE 1101011 CZ0 000010101 000100100
  [0x0FE7FFFF, 0x0D602C24, 'waitse3', 'operand_pollwait'], // EEEE 1101011 CZ0 000010110 000100100
  [0x0FE7FFFF, 0x0D602E24, 'waitse4', 'operand_pollwait'], // EEEE 1101011 CZ0 000010111 000100100
  [0x0FE7FFFF, 0x0D603624, 'waitxfi', 'operand_pollwait'], // EEEE 1101011 CZ0 000011011 000100100
  [0x0FE7FFFF, 0x0D603424, 'waitxmt', 'operand_pollwait'], // EEEE 1101011 CZ0 000011010 000100100
  [0x0FE7FFFF, 0x0D603A24, 'waitxrl', 'operand_pollwait'], // EEEE 1101011 CZ0 000011101 000100100
  [0x0FE7FFFF, 0x0D603824, 'waitxro', 'operand_pollwait'], // EEEE 1101011 CZ0 000011100 000100100
  [0x0FFC01FF, 0x0D600061, 'mergeb', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100001
  [0x0FFC01FF, 0x0D600063, 'mergew', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100011
  [0x0FFC01FF, 0x0D600069, 'rev', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001101001
  [0x0FFC01FF, 0x0D600067, 'rgbexp', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100111
  [0x0FFC01FF, 0x0D600066, 'rgbsqz', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100110
  [0x0FFC01FF, 0x0D600064, 'seussf', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100100
  [0x0FFC01FF, 0x0D600065, 'seussr', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100101
  [0x0FFC01FF, 0x0D600060, 'splitb', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100000
  [0x0FFC01FF, 0x0D600062, 'splitw', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001100010
  [0x0FFC01FF, 0x0D60006C, 'wrc', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001101100
  [0x0FFC01FF, 0x0D60006D, 'wrnc', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001101101
  [0x0FFC01FF, 0x0D60006F, 'wrnz', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001101111
  [0x0FFC01FF, 0x0D60006E, 'wrz', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001101110
  [0x0FFC01FF, 0x0D600068, 'xoro32', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001101000
  [0x0FFC01FF, 0x0D600071, 'getscp', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 001110001
  [0x0FFC01FF, 0x0D60001E, 'getxacc', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 000011110
  [0x0FFC01FF, 0x0D600034, 'getptr', 'operand_d'], // EEEE 1101011 000 DDDDDDDDD 000110100
  [0x0FE601FF, 0x0D64006F, 'modcz', 'operand_cz'], // EEEE 1101011 CZ1 0cccczzzz 001101111
  [0x0FF801FF, 0x0D600033, 'execf', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110011
  [0x0FF801FF, 0x0D600030, 'jmprel', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110000
  [0x0FF801FF, 0x0D600031, 'skip', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110001
  [0x0FF801FF, 0x0D600032, 'skipf', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110010
  [0x0FF801FF, 0x0D600037, 'setluts', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110111
  [0x0FF801FF, 0x0D60003F, 'cogatn', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111111
  [0x0FFBFE00, 0x0BC81C00, 'jatn', 'operand_jpoll'], // EEEE 1011110 01I 000001110 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80200, 'jct1', 'operand_jpoll'], // EEEE 1011110 01I 000000001 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80400, 'jct2', 'operand_jpoll'], // EEEE 1011110 01I 000000010 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80600, 'jct3', 'operand_jpoll'], // EEEE 1011110 01I 000000011 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81200, 'jfbw', 'operand_jpoll'], // EEEE 1011110 01I 000001001 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80000, 'jint', 'operand_jpoll'], // EEEE 1011110 01I 000000000 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83C00, 'jnatn', 'operand_jpoll'], // EEEE 1011110 01I 000011110 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82200, 'jnct1', 'operand_jpoll'], // EEEE 1011110 01I 000010001 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82400, 'jnct2', 'operand_jpoll'], // EEEE 1011110 01I 000010010 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82600, 'jnct3', 'operand_jpoll'], // EEEE 1011110 01I 000010011 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83200, 'jnfbw', 'operand_jpoll'], // EEEE 1011110 01I 000011001 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82000, 'jnint', 'operand_jpoll'], // EEEE 1011110 01I 000010000 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83000, 'jnpat', 'operand_jpoll'], // EEEE 1011110 01I 000011000 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83E00, 'jnqmt', 'operand_jpoll'], // EEEE 1011110 01I 000011111 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82800, 'jnse1', 'operand_jpoll'], // EEEE 1011110 01I 000010100 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82A00, 'jnse2', 'operand_jpoll'], // EEEE 1011110 01I 000010101 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82C00, 'jnse3', 'operand_jpoll'], // EEEE 1011110 01I 000010110 SSSSSSSSS
  [0x0FFBFE00, 0x0BC82E00, 'jnse4', 'operand_jpoll'], // EEEE 1011110 01I 000010111 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83600, 'jnxfi', 'operand_jpoll'], // EEEE 1011110 01I 000011011 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83400, 'jnxmt', 'operand_jpoll'], // EEEE 1011110 01I 000011010 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83A00, 'jnxrl', 'operand_jpoll'], // EEEE 1011110 01I 000011101 SSSSSSSSS
  [0x0FFBFE00, 0x0BC83800, 'jnxro', 'operand_jpoll'], // EEEE 1011110 01I 000011100 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81000, 'jpat', 'operand_jpoll'], // EEEE 1011110 01I 000001000 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81E00, 'jqmt', 'operand_jpoll'], // EEEE 1011110 01I 000001111 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80800, 'jse1', 'operand_jpoll'], // EEEE 1011110 01I 000000100 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80A00, 'jse2', 'operand_jpoll'], // EEEE 1011110 01I 000000101 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80C00, 'jse3', 'operand_jpoll'], // EEEE 1011110 01I 000000110 SSSSSSSSS
  [0x0FFBFE00, 0x0BC80E00, 'jse4', 'operand_jpoll'], // EEEE 1011110 01I 000000111 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81600, 'jxfi', 'operand_jpoll'], // EEEE 1011110 01I 000001011 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81400, 'jxmt', 'operand_jpoll'], // EEEE 1011110 01I 000001010 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81A00, 'jxrl', 'operand_jpoll'], // EEEE 1011110 01I 000001101 SSSSSSSSS
  [0x0FFBFE00, 0x0BC81800, 'jxro', 'operand_jpoll'], // EEEE 1011110 01I 000001100 SSSSSSSSS
  [0x0FF801FF, 0x0D600020, 'setse1', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100000
  [0x0FF801FF, 0x0D600021, 'setse2', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100001
  [0x0FF801FF, 0x0D600022, 'setse3', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100010
  [0x0FF801FF, 0x0D600023, 'setse4', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100011
  [0x0FFBFE00, 0x0C080200, 'akpin', 'operand_akpin'], // EEEE 1100000 01I 000000001 SSSSSSSSS
  [0x0FF801FF, 0x0D60001C, 'setdacs', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000011100
  [0x0FF801FF, 0x0D600070, 'setscp', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 001110000
  [0x0FF801FF, 0x0D60000F, 'qexp', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000001111
  [0x0FF801FF, 0x0D60000E, 'qlog', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000001110
  [0x0FF801FF, 0x0D60001D, 'setxfrq', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000011101
  [0x0FF801FF, 0x0D600015, 'wfbyte', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000010101
  [0x0FF801FF, 0x0D600017, 'wflong', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000010111
  [0x0FF801FF, 0x0D600016, 'wfword', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000010110
  [0x0FF401FF, 0x0C640161, 'pusha', 'operand_l'], // EEEE 1100011 0L1 DDDDDDDDD 101100001
  [0x0FF401FF, 0x0C6401E1, 'pushb', 'operand_l'], // EEEE 1100011 0L1 DDDDDDDDD 111100001
  [0x0FF801FF, 0x0D600003, 'cogstop', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000000011
  [0x0FF801FF, 0x0D600000, 'hubset', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000000000
  [0x0FEC01FF, 0x0D600004, 'locknew', 'operand_d'], // EEEE 1101011 C00 DDDDDDDDD 000000100
  [0x0FF801FF, 0x0D600005, 'lockret', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000000101
  [0x0FF801FF, 0x0D600036, 'brk', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110110
  [0x0FF801FF, 0x0D600035, 'cogbrk', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000110101
  [0x0FF801FF, 0x0D600025, 'setint1', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100101
  [0x0FF801FF, 0x0D600026, 'setint2', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100110
  [0x0FF801FF, 0x0D600027, 'setint3', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000100111
  [0x0FEC01FF, 0x0D60001A, 'getct', 'operand_d'], // EEEE 1101011 C00 DDDDDDDDD 000011010
  [0x0FF801FF, 0x0D60002A, 'push', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000101010
  [0x0FF801FF, 0x0D600028, 'setq', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000101000
  [0x0FF801FF, 0x0D600029, 'setq2', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000101001
  [0x0FF801FF, 0x0D60003B, 'setcfrq', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111011
  [0x0FF801FF, 0x0D600039, 'setci', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111001
  [0x0FF801FF, 0x0D60003C, 'setcmod', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111100
  [0x0FF801FF, 0x0D60003A, 'setcq', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111010
  [0x0FF801FF, 0x0D600038, 'setcy', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111000
  [0x0FF801FF, 0x0D60003D, 'setpiv', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111101
  [0x0FF801FF, 0x0D60003E, 'setpix', 'operand_l'], // EEEE 1101011 00L DDDDDDDDD 000111110
  [0x0FE401FF, 0x0D60006B, 'rczl', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 001101011
  [0x0FE401FF, 0x0D60006A, 'rczr', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 001101010
  [0x0FE401FF, 0x0D60002D, 'call', 'operand_jmpd'], // EEEE 1101011 CZ0 DDDDDDDDD 000101101
  [0x0FE401FF, 0x0D60002C, 'jmp', 'operand_jmpd'], // EEEE 1101011 CZ0 DDDDDDDDD 000101100
  [0x0FE401FF, 0x0D600018, 'getqx', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000011000
  [0x0FE401FF, 0x0D600019, 'getqy', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000011001
  [0x0FE401FF, 0x0D600010, 'rfbyte', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000010000
  [0x0FE401FF, 0x0D600012, 'rflong', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000010010
  [0x0FE401FF, 0x0D600013, 'rfvar', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000010011
  [0x0FE401FF, 0x0D600014, 'rfvars', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000010100
  [0x0FE401FF, 0x0D600011, 'rfword', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000010001
  [0x0FE401FF, 0x0B04015F, 'popa', 'operand_d'], // EEEE 1011000 CZ1 DDDDDDDDD 101011111
  [0x0FE401FF, 0x0B0401DF, 'popb', 'operand_d'], // EEEE 1011000 CZ1 DDDDDDDDD 111011111
  [0x0FE801FF, 0x0D600001, 'cogid', 'operand_l'], // EEEE 1101011 C0L DDDDDDDDD 000000001
  [0x0FE801FF, 0x0D600007, 'lockrel', 'operand_l'], // EEEE 1101011 C0L DDDDDDDDD 000000111
  [0x0FE801FF, 0x0D600006, 'locktry', 'operand_l'], // EEEE 1101011 C0L DDDDDDDDD 000000110
  [0x0FE401FF, 0x0D600035, 'getbrk', 'operand_getbrk'], // EEEE 1101011 CZ0 DDDDDDDDD 000110101
  [0x0FE401FF, 0x0D60001B, 'getrnd', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000011011
  [0x0FE401FF, 0x0D60002B, 'pop', 'operand_d'], // EEEE 1101011 CZ0 DDDDDDDDD 000101011
  // TESTP/TESTPN share their base encoding with DIRL/DIRH (S=001000000/001000001).
  // Silicon disambiguates by effect: exactly one of WC/WZ (C XOR Z) -> TESTP/TESTPN,
  // while WCZ or no-effect (C == Z) -> DIRL/DIRH. These tighter masks (which pin C,Z)
  // MUST precede the looser DIRL/DIRH rows below. (p2kb: p2kbPasm2Testp/p2kbPasm2Dirl)
  [0x0FF801FF, 0x0D700040, 'testp', 'operand_testp'], // EEEE 1101011 C=1 Z=0 L DDDDDDDDD 001000000 (WC)
  [0x0FF801FF, 0x0D680040, 'testp', 'operand_testp'], // EEEE 1101011 C=0 Z=1 L DDDDDDDDD 001000000 (WZ)
  [0x0FF801FF, 0x0D700041, 'testpn', 'operand_testp'], // EEEE 1101011 C=1 Z=0 L DDDDDDDDD 001000001 (WC)
  [0x0FF801FF, 0x0D680041, 'testpn', 'operand_testp'], // EEEE 1101011 C=0 Z=1 L DDDDDDDDD 001000001 (WZ)
  [0x0FE001FF, 0x0D600042, 'dirc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000010
  [0x0FE001FF, 0x0D600041, 'dirh', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000001
  [0x0FE001FF, 0x0D600040, 'dirl', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000000
  [0x0FE001FF, 0x0D600043, 'dirnc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000011
  [0x0FE001FF, 0x0D600047, 'dirnot', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000111
  [0x0FE001FF, 0x0D600045, 'dirnz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000101
  [0x0FE001FF, 0x0D600046, 'dirrnd', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000110
  [0x0FE001FF, 0x0D600044, 'dirz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001000100
  [0x0FE001FF, 0x0D60005A, 'drvc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011010
  [0x0FE001FF, 0x0D600059, 'drvh', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011001
  [0x0FE001FF, 0x0D600058, 'drvl', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011000
  [0x0FE001FF, 0x0D60005B, 'drvnc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011011
  [0x0FE001FF, 0x0D60005F, 'drvnot', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011111
  [0x0FE001FF, 0x0D60005D, 'drvnz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011101
  [0x0FE001FF, 0x0D60005E, 'drvrnd', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011110
  [0x0FE001FF, 0x0D60005C, 'drvz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001011100
  [0x0FE001FF, 0x0D600052, 'fltc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010010
  [0x0FE001FF, 0x0D600051, 'flth', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010001
  [0x0FE001FF, 0x0D600050, 'fltl', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010000
  [0x0FE001FF, 0x0D600053, 'fltnc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010011
  [0x0FE001FF, 0x0D600057, 'fltnot', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010111
  [0x0FE001FF, 0x0D600055, 'fltnz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010101
  [0x0FE001FF, 0x0D600056, 'fltrnd', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010110
  [0x0FE001FF, 0x0D600054, 'fltz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001010100
  [0x0FE001FF, 0x0D60004A, 'outc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001010
  [0x0FE001FF, 0x0D600049, 'outh', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001001
  [0x0FE001FF, 0x0D600048, 'outl', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001000
  [0x0FE001FF, 0x0D60004B, 'outnc', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001011
  [0x0FE001FF, 0x0D60004F, 'outnot', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001111
  [0x0FE001FF, 0x0D60004D, 'outnz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001101
  [0x0FE001FF, 0x0D60004E, 'outrnd', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001110
  [0x0FE001FF, 0x0D60004C, 'outz', 'operand_pinop'], // EEEE 1101011 CZL DDDDDDDDD 001001100
  [0x0FE001FF, 0x0D60001F, 'waitx', 'operand_l'], // EEEE 1101011 CZL DDDDDDDDD 000011111
  [0x0FF80000, 0x09C80000, 'bmask', 'operand_du'], // EEEE 1001110 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09D00000, 'crcbit', 'operand_ds'], // EEEE 1001110 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09D80000, 'crcnib', 'operand_ds'], // EEEE 1001110 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09C00000, 'decod', 'operand_du'], // EEEE 1001110 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09F80000, 'movbyts', 'operand_ds'], // EEEE 1001111 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09E80000, 'muxnibs', 'operand_ds'], // EEEE 1001111 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09E00000, 'muxnits', 'operand_ds'], // EEEE 1001111 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09F00000, 'muxq', 'operand_ds'], // EEEE 1001111 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09B00000, 'setd', 'operand_ds'], // EEEE 1001101 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09A80000, 'setr', 'operand_ds'], // EEEE 1001101 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09B80000, 'sets', 'operand_ds'], // EEEE 1001101 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B700000, 'djf', 'operand_dsj'], // EEEE 1011011 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B780000, 'djnf', 'operand_dsj'], // EEEE 1011011 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B680000, 'djnz', 'operand_dsj'], // EEEE 1011011 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B600000, 'djz', 'operand_dsj'], // EEEE 1011011 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B880000, 'ijnz', 'operand_dsj'], // EEEE 1011100 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B800000, 'ijz', 'operand_dsj'], // EEEE 1011100 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0BA00000, 'tjf', 'operand_dsj'], // EEEE 1011101 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0BA80000, 'tjnf', 'operand_dsj'], // EEEE 1011101 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0BB80000, 'tjns', 'operand_dsj'], // EEEE 1011101 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B980000, 'tjnz', 'operand_dsj'], // EEEE 1011100 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0BB00000, 'tjs', 'operand_dsj'], // EEEE 1011101 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0BC00000, 'tjv', 'operand_dsj'], // EEEE 1011110 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0B900000, 'tjz', 'operand_dsj'], // EEEE 1011100 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A600000, 'addct1', 'operand_ds'], // EEEE 1010011 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A680000, 'addct2', 'operand_ds'], // EEEE 1010011 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A700000, 'addct3', 'operand_ds'], // EEEE 1010011 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A780000, 'wmlong', 'operand_dsp'], // EEEE 1010011 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09980000, 'altb', 'operand_ds'], // EEEE 1001100 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09880000, 'altd', 'operand_ds'], // EEEE 1001100 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09680000, 'altgb', 'operand_ds'], // EEEE 1001011 01I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09580000, 'altgn', 'operand_ds'], // EEEE 1001010 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09780000, 'altgw', 'operand_ds'], // EEEE 1001011 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09A00000, 'alti', 'operand_ds'], // EEEE 1001101 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09800000, 'altr', 'operand_ds'], // EEEE 1001100 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09900000, 'alts', 'operand_ds'], // EEEE 1001100 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09600000, 'altsb', 'operand_ds'], // EEEE 1001011 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09500000, 'altsn', 'operand_ds'], // EEEE 1001010 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x09700000, 'altsw', 'operand_ds'], // EEEE 1001011 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A400000, 'addpix', 'operand_ds'], // EEEE 1010010 00I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A500000, 'blnpix', 'operand_ds'], // EEEE 1010010 10I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A580000, 'mixpix', 'operand_ds'], // EEEE 1010010 11I DDDDDDDDD SSSSSSSSS
  [0x0FF80000, 0x0A480000, 'mulpix', 'operand_ds'], // EEEE 1010010 01I DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x09300000, 'getword', 'operand_ds1get'], // EEEE 1001001 1NI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0A000000, 'mul', 'operand_ds'], // EEEE 1010000 0ZI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0A100000, 'muls', 'operand_ds'], // EEEE 1010000 1ZI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x09400000, 'rolword', 'operand_ds1get'], // EEEE 1001010 0NI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0A200000, 'sca', 'operand_ds'], // EEEE 1010001 0ZI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0A300000, 'scas', 'operand_ds'], // EEEE 1010001 1ZI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x09200000, 'setword', 'operand_ds1set'], // EEEE 1001001 0NI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0B400000, 'callpa', 'operand_lsj'], // EEEE 1011010 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0B500000, 'callpb', 'operand_lsj'], // EEEE 1011010 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0CD00000, 'rep', 'operand_ls'], // EEEE 1100110 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C300000, 'wrlut', 'operand_lsp'], // EEEE 1100001 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0BF00000, 'setpat', 'operand_ls'], // EEEE 1011111 1LI DDDDDDDDD SSSSSSSSS
  [0x0FE80000, 0x0A880000, 'rdpin', 'operand_ds'], // EEEE 1010100 C1I DDDDDDDDD SSSSSSSSS
  [0x0FE80000, 0x0A800000, 'rqpin', 'operand_ds'], // EEEE 1010100 C0I DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C000000, 'wrpin', 'operand_ls'], // EEEE 1100000 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C100000, 'wxpin', 'operand_ls'], // EEEE 1100000 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C200000, 'wypin', 'operand_ls'], // EEEE 1100001 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0D100000, 'qdiv', 'operand_ls'], // EEEE 1101000 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0D200000, 'qfrac', 'operand_ls'], // EEEE 1101001 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0D000000, 'qmul', 'operand_ls'], // EEEE 1101000 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0D400000, 'qrotate', 'operand_ls'], // EEEE 1101010 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0D300000, 'qsqrt', 'operand_ls'], // EEEE 1101001 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0D500000, 'qvector', 'operand_ls'], // EEEE 1101010 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0CC00000, 'xcont', 'operand_ls'], // EEEE 1100110 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0CA00000, 'xinit', 'operand_ls'], // EEEE 1100101 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0CB00000, 'xzero', 'operand_ls'], // EEEE 1100101 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C900000, 'fblock', 'operand_ls'], // EEEE 1100100 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C700000, 'rdfast', 'operand_ls'], // EEEE 1100011 1LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C800000, 'wrfast', 'operand_ls'], // EEEE 1100100 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C400000, 'wrbyte', 'operand_lsp'], // EEEE 1100010 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C600000, 'wrlong', 'operand_lsp'], // EEEE 1100011 0LI DDDDDDDDD SSSSSSSSS
  [0x0FF00000, 0x0C500000, 'wrword', 'operand_lsp'], // EEEE 1100010 1LI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06400000, 'abs', 'operand_du'], // EEEE 0110010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01000000, 'add', 'operand_ds'], // EEEE 0001000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01400000, 'adds', 'operand_ds'], // EEEE 0001010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01600000, 'addsx', 'operand_ds'], // EEEE 0001011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01200000, 'addx', 'operand_ds'], // EEEE 0001001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05000000, 'and', 'operand_ds'], // EEEE 0101000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05200000, 'andn', 'operand_ds'], // EEEE 0101001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04400000, 'bitc', 'operand_bitx'], // EEEE 0100010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04200000, 'bith', 'operand_bitx'], // EEEE 0100001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04000000, 'bitl', 'operand_bitx'], // EEEE 0100000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04600000, 'bitnc', 'operand_bitx'], // EEEE 0100011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04E00000, 'bitnot', 'operand_bitx'], // EEEE 0100111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04A00000, 'bitnz', 'operand_bitx'], // EEEE 0100101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04C00000, 'bitrnd', 'operand_bitx'], // EEEE 0100110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04800000, 'bitz', 'operand_bitx'], // EEEE 0100100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02000000, 'cmp', 'operand_ds'], // EEEE 0010000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02A00000, 'cmpm', 'operand_ds'], // EEEE 0010101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02800000, 'cmpr', 'operand_ds'], // EEEE 0010100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02400000, 'cmps', 'operand_ds'], // EEEE 0010010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02E00000, 'cmpsub', 'operand_ds'], // EEEE 0010111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02600000, 'cmpsx', 'operand_ds'], // EEEE 0010011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02200000, 'cmpx', 'operand_ds'], // EEEE 0010001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07200000, 'decmod', 'operand_ds'], // EEEE 0111001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07800000, 'encod', 'operand_du'], // EEEE 0111100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03000000, 'fge', 'operand_ds'], // EEEE 0011000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03400000, 'fges', 'operand_ds'], // EEEE 0011010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03200000, 'fle', 'operand_ds'], // EEEE 0011001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03600000, 'fles', 'operand_ds'], // EEEE 0011011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x08E00000, 'getbyte', 'operand_ds2get'], // EEEE 1000111 NNI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07000000, 'incmod', 'operand_ds'], // EEEE 0111000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06000000, 'mov', 'operand_ds'], // EEEE 0110000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05800000, 'muxc', 'operand_ds'], // EEEE 0101100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05A00000, 'muxnc', 'operand_ds'], // EEEE 0101101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05E00000, 'muxnz', 'operand_ds'], // EEEE 0101111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05C00000, 'muxz', 'operand_ds'], // EEEE 0101110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06600000, 'neg', 'operand_du'], // EEEE 0110011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06800000, 'negc', 'operand_du'], // EEEE 0110100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06A00000, 'negnc', 'operand_du'], // EEEE 0110101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06E00000, 'negnz', 'operand_du'], // EEEE 0110111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06C00000, 'negz', 'operand_du'], // EEEE 0110110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x06200000, 'not', 'operand_du'], // EEEE 0110001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07A00000, 'ones', 'operand_du'], // EEEE 0111101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05400000, 'or', 'operand_ds'], // EEEE 0101010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00A00000, 'rcl', 'operand_ds'], // EEEE 0000101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00800000, 'rcr', 'operand_ds'], // EEEE 0000100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00200000, 'rol', 'operand_ds'], // EEEE 0000001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x09000000, 'rolbyte', 'operand_ds2get'], // EEEE 1001000 NNI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00000000, 'ror', 'operand_ds'], // EEEE 0000000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00E00000, 'sal', 'operand_ds'], // EEEE 0000111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00C00000, 'sar', 'operand_ds'], // EEEE 0000110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x08C00000, 'setbyte', 'operand_ds2set'], // EEEE 1000110 NNI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00600000, 'shl', 'operand_ds'], // EEEE 0000011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x00400000, 'shr', 'operand_ds'], // EEEE 0000010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07600000, 'signx', 'operand_ds'], // EEEE 0111011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01800000, 'sub', 'operand_ds'], // EEEE 0001100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x02C00000, 'subr', 'operand_ds'], // EEEE 0010110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01C00000, 'subs', 'operand_ds'], // EEEE 0001110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01E00000, 'subsx', 'operand_ds'], // EEEE 0001111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x01A00000, 'subx', 'operand_ds'], // EEEE 0001101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03800000, 'sumc', 'operand_ds'], // EEEE 0011100 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03A00000, 'sumnc', 'operand_ds'], // EEEE 0011101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03E00000, 'sumnz', 'operand_ds'], // EEEE 0011111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x03C00000, 'sumz', 'operand_ds'], // EEEE 0011110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07C00000, 'test', 'operand_du'], // EEEE 0111110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04000000, 'testb', 'operand_testb'], // EEEE 0100000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x04200000, 'testbn', 'operand_testb'], // EEEE 0100001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07E00000, 'testn', 'operand_ds'], // EEEE 0111111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x05600000, 'xor', 'operand_ds'], // EEEE 0101011 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x07400000, 'zerox', 'operand_ds'], // EEEE 0111010 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x0DA00000, 'call', 'operand_call'], // EEEE 1101101 RAA AAAAAAAAA AAAAAAAAA
  [0x0FE00000, 0x0DC00000, 'calla', 'operand_call'], // EEEE 1101110 RAA AAAAAAAAA AAAAAAAAA
  [0x0FE00000, 0x0DE00000, 'callb', 'operand_call'], // EEEE 1101111 RAA AAAAAAAAA AAAAAAAAA
  [0x0FE00000, 0x0B200000, 'calld', 'operand_ds'], // EEEE 1011001 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x0D800000, 'jmp', 'operand_jmp'], // EEEE 1101100 RAA AAAAAAAAA AAAAAAAAA
  [0x0FE00000, 0x0AA00000, 'rdlut', 'operand_dsp'], // EEEE 1010101 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x0AC00000, 'rdbyte', 'operand_dsp'], // EEEE 1010110 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x0B000000, 'rdlong', 'operand_dsp'], // EEEE 1011000 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x0AE00000, 'rdword', 'operand_dsp'], // EEEE 1010111 CZI DDDDDDDDD SSSSSSSSS
  [0x0FE00000, 0x0CE00000, 'coginit', 'operand_ls'], // EEEE 1100111 CLI DDDDDDDDD SSSSSSSSS
  [0x0FC00000, 0x08400000, 'getnib', 'operand_ds3get'], // EEEE 100001N NNI DDDDDDDDD SSSSSSSSS
  [0x0FC00000, 0x08800000, 'rolnib', 'operand_ds3get'], // EEEE 100010N NNI DDDDDDDDD SSSSSSSSS
  [0x0FC00000, 0x08000000, 'setnib', 'operand_ds3set'], // EEEE 100000N NNI DDDDDDDDD SSSSSSSSS
  [0x0F800000, 0x0E800000, 'loc', 'operand_loc'], // EEEE 11101WW RAA AAAAAAAAA AAAAAAAAA
  [0x0F800000, 0x0E000000, 'calld', 'operand_calld'], // EEEE 11100WW RAA AAAAAAAAA AAAAAAAAA
  [0x0F800000, 0x0F800000, 'augd', 'operand_aug'], // EEEE 11111DD DDD DDDDDDDDD DDDDDDDDD
  [0x0F800000, 0x0F000000, 'augs', 'operand_aug'], // EEEE 11110SS SSS SSSSSSSSS SSSSSSSSS
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
