/** @format */

// src/classes/shared/endSessionSentinel.ts
//
// DEBUG_END_SESSION sentinel detection.
//
// The P2 compiler's DEBUG(DEBUG_END_SESSION) signals end-of-session with a 0x1B
// (ESC) byte. The ONLY occurrence we trust is a 0x1B that immediately follows a
// CRLF line terminator — i.e. the 3-byte sequence CR LF ESC (0x0D 0x0A 0x1B).
//
// We deliberately:
//   - do NOT inspect any bytes AFTER the 0x1B. We have no proof of what PNut-ts
//     emits following the sentinel, so any trailing-byte rule would be a guess.
//   - do NOT trust a bare 0x1B, nor a 0x1B preceded only by a lone LF. Binary
//     DEBUG payloads carry 0x1B bytes mid-stream (e.g. sample value $031B ->
//     bytes 1B 03), and a sample like $1B0A serializes to 0A 1B (LF then ESC),
//     so anything short of the full CR LF pair is spoofable by binary data.
//
// A loose "contains 0x1B" scan previously false-triggered a serial disconnect
// and dropped the carrying message. See DOG-VOICE audit (#32).

const ESC = 0x1b;
const CR = 0x0d;
const LF = 0x0a;

/**
 * Returns true only when `data` contains the trusted DEBUG_END_SESSION sequence
 * CR LF ESC (0x0D 0x0A 0x1B): a 0x1B standing on a CRLF message boundary. A
 * 0x1B that is not immediately preceded by a CR LF pair returns false.
 */
export function isEndSessionSentinel(data: Uint8Array): boolean {
  for (let i = 2; i < data.length; i++) {
    if (data[i] === ESC && data[i - 1] === LF && data[i - 2] === CR) {
      return true;
    }
  }
  return false;
}
