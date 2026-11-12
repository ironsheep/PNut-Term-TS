/** @format */

'use strict';

// tests/endSessionSentinel.test.ts
//
// What DEBUG(DEBUG_END_SESSION) puts on the wire (p2com.asm:12886/:12997,
// Spin2_debugger.spin2:567-600): "CogN  " [ "$XXXX_XXXX_XXXX_XXXX  " ] ESC CR LF.
// The ESC is the whole body of the line, and the CR LF FOLLOWS it. The rule before
// v1.1.2 wanted CR LF BEFORE the ESC, which the compiler never produces, so the
// constant was never recognised.

import {
  isEndSessionSentinel,
  isEndSessionLineHead,
  endSessionEscIndex,
  formatEndSessionLine
} from '../src/classes/shared/endSessionSentinel';

const ESC = 0x1b;

const ascii = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'latin1'));
const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b);

describe('isEndSessionSentinel — the line DEBUG(DEBUG_END_SESSION) sends', () => {
  describe('accepts', () => {
    test('the exact wire form: CogN, two spaces, ESC, CR LF', () => {
      expect(isEndSessionSentinel(ascii('Cog0  \x1b\r\n'))).toBe(true);
      expect(isEndSessionSentinel(ascii('Cog7  \x1b\r\n'))).toBe(true);
    });

    test('with no CR LF after the ESC', () => {
      expect(isEndSessionSentinel(ascii('Cog0  \x1b'))).toBe(true);
    });

    test('with a lone CR, a lone LF, or LF CR after the ESC', () => {
      expect(isEndSessionSentinel(ascii('Cog3  \x1b\r'))).toBe(true);
      expect(isEndSessionSentinel(ascii('Cog3  \x1b\n'))).toBe(true);
      expect(isEndSessionSentinel(ascii('Cog3  \x1b\n\r'))).toBe(true);
    });

    test('with the debugger timestamp the P2 adds when timestamps are on', () => {
      expect(isEndSessionSentinel(ascii('Cog0  $0000_0000_1234_ABCD  \x1b\r\n'))).toBe(true);
      expect(isEndSessionSentinel(ascii('Cog0  $0000_0000_1234_ABCD  \x1b'))).toBe(true);
    });
  });

  describe('rejects', () => {
    test('the pre-v1.1.2 form CR LF ESC (the compiler never sends it)', () => {
      expect(isEndSessionSentinel(bytes(0x0d, 0x0a, ESC))).toBe(false);
    });

    test('a bare ESC with no CogN prefix', () => {
      expect(isEndSessionSentinel(bytes(ESC))).toBe(false);
      expect(isEndSessionSentinel(bytes(ESC, 0x0d, 0x0a))).toBe(false);
    });

    test('text before the ESC on the same line', () => {
      expect(isEndSessionSentinel(ascii('Cog0  done\x1b\r\n'))).toBe(false);
    });

    test('anything other than CR / LF after the ESC', () => {
      expect(isEndSessionSentinel(ascii('Cog0  \x1bX\r\n'))).toBe(false);
    });

    test('a cog number outside 0-7, or no space after it', () => {
      expect(isEndSessionSentinel(ascii('Cog8  \x1b\r\n'))).toBe(false);
      expect(isEndSessionSentinel(ascii('Cog0\x1b\r\n'))).toBe(false);
    });

    test('the DOG-VOICE "heard" message (text + ramp holding sample $031B -> 1B 03)', () => {
      const header = Buffer.from("Cog0  heard #1: CMDID 2  '", 'ascii');
      const ramp = bytes(
        0x5f, 0x02, 0x6f, 0x02, 0x82, 0x02, 0x90, 0x02, 0xa2, 0x02, 0xb2, 0x02, 0xc1, 0x02, 0xd5, 0x02,
        0xe6, 0x02, 0xf3, 0x02, 0xfe, 0x02, 0x05, 0x03, 0x10, 0x03, 0x1b, 0x03, 0x35, 0x03, 0x45, 0x03
      );
      const tail = Buffer.from("(none)'\r\n", 'ascii');
      const msg = bytes(...header, ...ramp, ...tail);
      expect(msg.includes(ESC)).toBe(true); // a "contains 0x1B" test matches it
      expect(isEndSessionSentinel(msg)).toBe(false);
      expect(endSessionEscIndex(msg)).toBe(-1);
    });

    test('plain text and empty input', () => {
      expect(isEndSessionSentinel(ascii('Cog0  hello\r\n'))).toBe(false);
      expect(isEndSessionSentinel(bytes())).toBe(false);
    });
  });
});

describe('isEndSessionLineHead — the extractor asks this as each byte arrives', () => {
  test('true exactly when the bytes so far END on the sentinel ESC', () => {
    expect(isEndSessionLineHead(ascii('Cog0  \x1b'))).toBe(true);
    expect(isEndSessionLineHead(ascii('Cog0  $0000_0000_1234_ABCD  \x1b'))).toBe(true);
    expect(isEndSessionLineHead(ascii('Cog0  \x1b\r'))).toBe(false);
    expect(isEndSessionLineHead(ascii('Cog0  x\x1b'))).toBe(false);
  });
});

describe('endSessionEscIndex — detection when the next line is glued on', () => {
  test('finds the ESC whatever follows it', () => {
    expect(endSessionEscIndex(ascii('Cog0  \x1bCog1  next\r\n'))).toBe(6);
  });
});

describe('formatEndSessionLine', () => {
  test('keeps the prefix as sent, shows the ESC as <END_SESSION>, drops the CR LF', () => {
    expect(formatEndSessionLine(ascii('Cog0  \x1b\r\n'))).toBe('Cog0  <END_SESSION>');
    expect(formatEndSessionLine(ascii('Cog2  $0000_0000_1234_ABCD  \x1b'))).toBe(
      'Cog2  $0000_0000_1234_ABCD  <END_SESSION>'
    );
  });
});
