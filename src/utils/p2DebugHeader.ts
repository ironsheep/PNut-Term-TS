/** @format */

/**
 * Reads the P2 debug-ROM header out of a compiled binary.
 *
 * WHY THIS EXISTS
 * ---------------
 * There is NO baud handshake anywhere in the P2 debug system. When a program is
 * compiled with debug enabled, the compiler installs the debug baud INTO THE
 * DOWNLOADED IMAGE as `_baud_` (p2com.asm:7418-7419) — that value is what the P2
 * will actually transmit at. PNut gets to know it because its compiler and its
 * GUI share one memory struct (GlobalUnit.pas:149, `P2InitStruct`).
 *
 * We never compile, so nothing hands us that value. Historically we simply
 * guessed (a fixed default), which meant a user's `DEBUG_BAUD` CON — a documented
 * override — was silently ignored by this tool: the chip would talk at the rate
 * the source asked for while we listened at ours, producing garbage that reads
 * like a hardware fault.
 *
 * But we are holding the binary we are about to download. It already tells us the
 * truth. So we read it instead of guessing.
 *
 * This makes an in-source `DEBUG_BAUD` a REAL override for PNut-Term-TS, and it
 * is strictly better than PNut, which refuses to debug at all when the debug baud
 * differs from the download baud (SerialUnit.pas:132 — it silently closes the port).
 *
 * LAYOUT (v55; verified against every P2 binary in this repo)
 * ----------------------------------------------------------
 * The debug ROM is inserted at the HEAD of the image, so these offsets are
 * absolute file offsets. Field addresses are from p2com.asm:7442-7444.
 *
 *   0x000  16-byte signature — the debug ROM's entry instructions. Byte-identical
 *          across every debug-enabled binary; the bytes AFTER it differ per program.
 *   0x140  _txpin_   (byte)
 *   0x144  _rxpin_   (byte; bit 31 of the dword = the DEBUG_TIMESTAMP flag,
 *                     set by `or [_rxpin_+3],80h` at p2com.asm:7424)
 *   0x148  _baud_    (uint32 LE) ← the whole point
 *
 * A binary WITHOUT this signature has no debug ROM. That is not an error and not
 * a fallback-with-a-shrug: no debug ROM means the program emits no DEBUG output,
 * so there is nothing for a debug baud to be right about, and the caller should
 * keep using the user's configured baud for plain serial traffic. Absence is
 * meaningful, so this returns null rather than throwing.
 */

import * as fs from 'fs';

/** The debug ROM's entry instructions — present iff the image carries the debug ROM. */
const DEBUG_ROM_SIGNATURE: readonly number[] = [
  0x50, 0xf8, 0x08, 0xfc, 0x51, 0x04, 0x08, 0xfc, 0x41, 0xa2, 0x60, 0xfd, 0x51, 0x6a, 0x10, 0xfc
];

const OFFSET_TXPIN = 0x140;
const OFFSET_RXPIN = 0x144;
const OFFSET_BAUD = 0x148;
const MIN_IMAGE_SIZE = OFFSET_BAUD + 4;

/** Widest plausible P2 debug baud. Guards against reading a plausible-looking image that isn't one. */
const MAX_SANE_BAUD = 20_000_000;

export interface P2DebugHeader {
  /** The rate the P2 will actually TRANSMIT debug at (`_baud_`). */
  baud: number;
  /** Debug transmit pin (default 62). */
  txPin: number;
  /** Debug receive pin (default 63). */
  rxPin: number;
  /** True when the source declared DEBUG_TIMESTAMP. */
  timestamp: boolean;
}

/**
 * Parse the debug-ROM header from an in-memory image.
 * @returns the header, or null if this image carries no debug ROM.
 */
export function parseDebugHeader(image: Buffer): P2DebugHeader | null {
  if (image.length < MIN_IMAGE_SIZE) {
    return null;
  }
  for (let index = 0; index < DEBUG_ROM_SIGNATURE.length; index++) {
    if (image[index] !== DEBUG_ROM_SIGNATURE[index]) {
      return null; // no debug ROM — see the note above; this is a normal, meaningful outcome
    }
  }

  const baud: number = image.readUInt32LE(OFFSET_BAUD);
  // A signature match plus an insane baud means our offsets no longer describe
  // this image (a future PNut could move them). Refuse rather than tune the port
  // to garbage — the caller keeps the user's configured baud.
  if (baud <= 0 || baud > MAX_SANE_BAUD) {
    return null;
  }

  return {
    baud,
    txPin: image[OFFSET_TXPIN],
    rxPin: image[OFFSET_RXPIN],
    // `>>> 0` is load-bearing: JS bitwise operators are SIGNED 32-bit, so testing
    // bit 31 with a bare `&` yields a negative number rather than a clean flag.
    timestamp: ((image.readUInt32LE(OFFSET_RXPIN) & 0x8000_0000) >>> 0) !== 0
  };
}

/**
 * Parse the debug-ROM header from a binary on disk.
 * @returns the header, or null if the file carries no debug ROM or cannot be read.
 */
export function readDebugHeaderFromFile(filePath: string): P2DebugHeader | null {
  try {
    return parseDebugHeader(fs.readFileSync(filePath));
  } catch {
    // Unreadable/missing: the download itself will report that far better than we can.
    return null;
  }
}
