# PASM2 disassembler table generator

`pasm2-encodings.json` — authoritative P2 instruction encodings (bit pattern +
operand format) collected from **p2kb-mcp** (the P2 Knowledge Base) on 2026-06-01,
covering the full PASM2 instruction set (350 encoding forms / 347 mnemonics).

`gen-disassembler.js` — parses each `bits` string into a {mask, match} pair
(fixed 0/1 bits → mask+match; EEEE/C/Z/I/L/D/S/A/N/W letters → don't-care),
sorts most-specific-first, and emits
`src/classes/debugger/renderer/pasm2Disassembler.ts`.

Regenerate:  `node scripts/disasm-gen/gen-disassembler.js`
(reads /tmp/all_encodings.json — copy pasm2-encodings.json there first, or edit
the require path). Used by the single-step debugger disassembly panel (ssdbg §4/§5).
