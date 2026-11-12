/** @format */

// src/classes/shared/endSessionSentinel.ts
//
// DEBUG_END_SESSION sentinel detection.
//
// WHAT THE P2 SENDS. DEBUG_END_SESSION is the constant 27 (p2com.asm:21757). The
// compiler builds DEBUG(DEBUG_END_SESSION) like any other DEBUG statement: a "CogN"
// command, then a chr command carrying the value, then the end command
// (p2com.asm:12886, :12997). The debugger runs them in order (Spin2_debugger.spin2
// :567-600), so the wire carries:
//
//     "CogN  "  [ "$XXXX_XXXX_XXXX_XXXX  " when timestamps are on ]  0x1B  CR LF
//
// The ESC is the WHOLE body of the line and CR LF FOLLOWS it. PNut ends the session on
// any 27 byte at all (DebugUnit.pas:196).
//
// WHAT WE ACCEPT. A line whose body, after the "CogN" prefix and an optional timestamp,
// is exactly one ESC, followed by any run of CR / LF, or by nothing. That is as
// permissive as the wire allows without reopening the DOG-VOICE class (#32): a binary
// DEBUG payload carrying a 0x1B byte (sample $031B -> 1B 03) is never the entire body of
// a CogN line, so it can never match. We deliberately do NOT copy PNut's "any 27" rule
// for that reason.
//
// Every consumer (router, headless logger, Debug Logger, COG logger, and the extractor
// that releases an unterminated sentinel line) uses this one definition.

const ESC = 0x1b;
const CR = 0x0d;
const LF = 0x0a;
const SPACE = 0x20;

/** Hex digit or '_' — the characters of a debugger timestamp after its '$'. */
function isTimestampChar(b: number): boolean {
  return (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66) || b === 0x5f;
}

/**
 * Index of the ESC if `data` starts with "CogN" + spaces + optional "$timestamp" +
 * spaces + ESC; otherwise -1. Nothing after the ESC is examined, so a stream consumer
 * that has no line framing of its own (the headless logger) can detect the sentinel
 * even when the next line arrived glued to it.
 */
export function endSessionEscIndex(data: Uint8Array): number {
  return sentinelEscIndex(data);
}

function sentinelEscIndex(data: Uint8Array): number {
  // "Cog" + digit 0-7
  if (data.length < 6 || data[0] !== 0x43 || data[1] !== 0x6f || data[2] !== 0x67) return -1;
  if (data[3] < 0x30 || data[3] > 0x37) return -1;
  let i = 4;
  const spaces = (): number => {
    const start = i;
    while (i < data.length && data[i] === SPACE) i++;
    return i - start;
  };
  if (spaces() === 0) return -1;
  // Optional timestamp: '$' then hex digits / underscores, then at least one space.
  if (i < data.length && data[i] === 0x24) {
    i++;
    const start = i;
    while (i < data.length && isTimestampChar(data[i])) i++;
    if (i === start) return -1;
    if (spaces() === 0) return -1;
  }
  return i < data.length && data[i] === ESC ? i : -1;
}

/**
 * True when `data` ENDS on the ESC of a DEBUG_END_SESSION line: exactly "CogN  [ts  ]ESC".
 * The extractor calls this as each byte arrives, so it can release the line even when no
 * CR LF ever follows.
 */
export function isEndSessionLineHead(data: Uint8Array): boolean {
  const esc = sentinelEscIndex(data);
  return esc >= 0 && esc === data.length - 1;
}

/**
 * True only when `data` is one complete DEBUG_END_SESSION line: "CogN  [ts  ]ESC",
 * followed by any run of CR / LF or by nothing at all.
 */
export function isEndSessionSentinel(data: Uint8Array): boolean {
  const esc = sentinelEscIndex(data);
  if (esc < 0) return false;
  for (let i = esc + 1; i < data.length; i++) {
    if (data[i] !== CR && data[i] !== LF) return false;
  }
  return true;
}

/** The text a log shows for a sentinel line: the prefix as sent, the ESC as a visible tag. */
export const END_SESSION_TAG = '<END_SESSION>';

/**
 * Render a sentinel line for a log: everything before the ESC exactly as the P2 sent it,
 * the ESC as END_SESSION_TAG, and any trailing CR / LF dropped. Call only when
 * isEndSessionSentinel(data) is true.
 */
export function formatEndSessionLine(data: Uint8Array): string {
  const esc = sentinelEscIndex(data);
  let prefix = '';
  for (let i = 0; i < esc; i++) prefix += String.fromCharCode(data[i]);
  return prefix + END_SESSION_TAG;
}
