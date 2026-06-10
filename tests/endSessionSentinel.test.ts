/** @format */

'use strict';

// tests/endSessionSentinel.test.ts

import { isEndSessionSentinel } from '../src/classes/shared/endSessionSentinel';

const ESC = 0x1b;
const CR = 0x0d;
const LF = 0x0a;

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b);

describe('isEndSessionSentinel', () => {
  describe('accepts only a 0x1B immediately preceded by a CR LF pair', () => {
    test('CR LF ESC', () => {
      expect(isEndSessionSentinel(bytes(CR, LF, ESC))).toBe(true);
    });

    test('CR LF ESC with leading content (a message that ends with the sentinel)', () => {
      const msg = Uint8Array.from(Buffer.from('Cog0  done\r\n', 'ascii'));
      expect(isEndSessionSentinel(bytes(...msg, ESC))).toBe(true);
    });

    test('CR LF ESC with trailing bytes is still accepted (we do not inspect after ESC)', () => {
      expect(isEndSessionSentinel(bytes(CR, LF, ESC, CR, LF))).toBe(true);
      expect(isEndSessionSentinel(bytes(CR, LF, ESC, 0x00, 0x99))).toBe(true);
    });
  });

  describe('rejects 0x1B that does not follow a CR LF pair', () => {
    test('bare single 0x1B (no preceding CRLF) is NOT trusted', () => {
      expect(isEndSessionSentinel(bytes(ESC))).toBe(false);
    });

    test('0x1B preceded by a lone LF is NOT trusted (spoofable by sample $1B0A -> 0A 1B)', () => {
      expect(isEndSessionSentinel(bytes(LF, ESC))).toBe(false);
      // sample $1B0A serialized little-endian, embedded in a ramp
      expect(isEndSessionSentinel(bytes(0x35, 0x03, 0x0a, 0x1b, 0x45, 0x03))).toBe(false);
    });

    test('0x1B preceded by a lone CR is NOT trusted', () => {
      expect(isEndSessionSentinel(bytes(CR, ESC))).toBe(false);
    });

    test('0x1B preceded by binary is NOT trusted (the DOG-VOICE false positive)', () => {
      // sample value $031B serialized little-endian -> 1B 03, surrounded by ramp
      expect(isEndSessionSentinel(bytes(0x10, 0x03, 0x1b, 0x03, 0x35, 0x03))).toBe(false);
    });

    test('0x1B preceded by text is NOT trusted', () => {
      const before = Uint8Array.from(Buffer.from('abc', 'ascii'));
      const after = Uint8Array.from(Buffer.from('def', 'ascii'));
      expect(isEndSessionSentinel(bytes(...before, ESC, ...after))).toBe(false);
    });

    test('full DOG-VOICE "heard" message (text + ramp containing $031B) is rejected', () => {
      const header = Buffer.from("Cog0  heard #1: CMDID 2  '", 'ascii');
      // monotonic 16-bit LE ramp that includes sample $031B (low byte 0x1B);
      // the 0x1B is preceded by binary (0x03), never by a CR LF pair
      const ramp = bytes(
        0x5f, 0x02, 0x6f, 0x02, 0x82, 0x02, 0x90, 0x02, 0xa2, 0x02, 0xb2, 0x02, 0xc1, 0x02, 0xd5, 0x02,
        0xe6, 0x02, 0xf3, 0x02, 0xfe, 0x02, 0x05, 0x03, 0x10, 0x03, 0x1b, 0x03, 0x35, 0x03, 0x45, 0x03
      );
      const tail = Buffer.from("(none)'\r\n", 'ascii');
      const msg = bytes(...header, ...ramp, ...tail);
      expect(msg.includes(0x1b)).toBe(true); // the old "contains 0x1B" check matched
      expect(isEndSessionSentinel(msg)).toBe(false); // the trusted CR LF ESC check does not
    });
  });

  describe('rejects data with no sentinel', () => {
    test('plain CRLF-terminated text (no ESC)', () => {
      expect(isEndSessionSentinel(Uint8Array.from(Buffer.from('Cog0  hello\r\n', 'ascii')))).toBe(false);
    });

    test('empty', () => {
      expect(isEndSessionSentinel(bytes())).toBe(false);
    });
  });
});
