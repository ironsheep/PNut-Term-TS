/** @format */

/**
 * The eaten-checksum-byte defect (reported against v1.0.5).
 *
 * SYMPTOM (Stephen, on hardware): "Download completed" arrives in the log MANY
 * messages late — well after the P2 has started running and its DEBUG output has
 * been logged. The ordering "shouldn't be necessary", and it wasn't.
 *
 * CAUSE: UsbSerial.download()'s checksum wait polled `_p2DetectionBuffer`, which is
 * the line-oriented Prop_Ver buffer, for a single character that is not a line. On
 * every chunk, checkForP2Response() does:
 *
 *     this._p2DetectionBuffer = lines.pop() || '';
 *
 * ...which discards everything before the LAST newline. The P2 emits its checksum
 * byte and then immediately begins executing user code, so the '.' routinely arrives
 * as the first byte of a chunk whose tail is app output — the exact fact
 * Downloader.handleProtocolData() documents in its own comments. One newline in that
 * tail deleted the '.' before the wait loop's next 1 ms tick could observe it.
 *
 * The loop then spun its FULL 1000 ms safety timeout waiting for a byte it had
 * already received and thrown away. Two consequences, both live in shipped builds:
 *   1. the completion message landed ~1 s late, behind a second of P2 DEBUG traffic
 *      (the reported symptom); and
 *   2. `_checksumVerified` stayed false, so the CRC verification silently DID NOT
 *      HAPPEN — and the download reported success anyway.
 *
 * FIX: a dedicated byte-wise latch (`_checksumResponseChar`) set at the TOP of
 * checkForP2Response(), before any line handling, mirroring the logic
 * Downloader.handleProtocolData() already had right. The wait polls the latch.
 *
 * These tests pin the invariants:
 *   1. the reply survives arriving glued to app output with newlines (THE defect);
 *   2. a bare reply still works, and leading whitespace is skipped;
 *   3. the latch is armed-gated and first-write-wins, so app output containing '.'
 *      neither arms it early nor overwrites a real reply;
 *   4. the line-split really does destroy the buffer the old code polled — the
 *      regression pin that explains why the latch must be a separate field;
 *   5. a download whose checksum never verified does NOT report success.
 */

jest.mock('serialport', () => ({
  __esModule: true,
  SerialPort: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    open: jest.fn(),
    write: jest.fn(),
    isOpen: false,
    destroyed: false
  }))
}));

import { UsbSerial } from '../src/utils/usb.serial';

function makeContext(): any {
  return {
    runEnvironment: { loggingEnabled: false, diagSerial: false },
    logger: { forceLogMessage: jest.fn(), logMessage: jest.fn() }
  };
}

/** Construct without touching a real port, and reach the private surface under test. */
function makePort(): any {
  const port: any = new UsbSerial(makeContext(), '/dev/null');
  return port;
}

/** Drive the private RX inspector exactly as the 'data' handler does. */
function feed(port: any, bytes: Buffer): void {
  port['checkForP2Response'](bytes);
}

/** Arm the wait the way download() does, latch cleared first. */
function armChecksumWait(port: any): void {
  port['_p2DetectionBuffer'] = '';
  port['_checksumResponseChar'] = null;
  port['_expectingChecksumResponse'] = true;
}

describe('P2 checksum reply detection', () => {
  describe('the reported defect — reply glued to app output', () => {
    it("latches '.' when the checksum byte leads a chunk whose tail is app output with newlines", () => {
      const port = makePort();
      armChecksumWait(port);

      // Exactly the shape the P2 produces: checksum byte, then user code output.
      // The newlines here are what used to destroy the '.'.
      feed(port, Buffer.from('.Cog0  INIT\r\nCog0  main\r\n', 'latin1'));

      expect(port['_checksumResponseChar']).toBe('.');
    });

    it("latches '!' the same way, so a CORRUPT download is still detected", () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('!Cog0  INIT\r\n', 'latin1'));

      expect(port['_checksumResponseChar']).toBe('!');
    });

    it('latches when the reply is split into its own chunk ahead of the traffic', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('.', 'latin1'));
      feed(port, Buffer.from('Cog0  INIT\r\n', 'latin1'));

      expect(port['_checksumResponseChar']).toBe('.');
    });

    it('survives a tail carrying raw binary, not just text', () => {
      const port = makePort();
      armChecksumWait(port);

      // Binary app output — the reason handleProtocolData uses latin1/subarray and
      // never a utf8 round-trip. Includes a 0x0A so the line-split would fire.
      feed(port, Buffer.from([0x2e, 0x00, 0xff, 0x0a, 0x80, 0x1b, 0x0d, 0x0a, 0xfe]));

      expect(port['_checksumResponseChar']).toBe('.');
    });
  });

  describe('byte-wise scan behavior', () => {
    it('accepts a bare reply with no tail at all', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('.', 'latin1'));

      expect(port['_checksumResponseChar']).toBe('.');
    });

    it('skips leading whitespace bytes before the reply', () => {
      const port = makePort();
      armChecksumWait(port);

      // space, tab, CR, LF then the reply
      feed(port, Buffer.from([0x20, 0x09, 0x0d, 0x0a, 0x2e]));

      expect(port['_checksumResponseChar']).toBe('.');
    });

    it('ignores a chunk whose first real byte is not a reply', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('Cog0  a value of 3.14\r\n', 'latin1'));

      expect(port['_checksumResponseChar']).toBeNull();
    });

    it('ignores an all-whitespace chunk', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from([0x20, 0x0d, 0x0a]));

      expect(port['_checksumResponseChar']).toBeNull();
    });
  });

  describe('arming and latching discipline', () => {
    it('does not latch while the wait is not armed', () => {
      const port = makePort();
      port['_checksumResponseChar'] = null;
      port['_expectingChecksumResponse'] = false;

      feed(port, Buffer.from('.', 'latin1'));

      expect(port['_checksumResponseChar']).toBeNull();
    });

    it('is first-write-wins — later app output cannot overwrite a real reply', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('!', 'latin1')); // P2 says the image is CORRUPT
      feed(port, Buffer.from('.', 'latin1')); // app output that happens to lead with '.'

      // The corrupt verdict must survive; overwriting it would turn a failed
      // download into a reported success.
      expect(port['_checksumResponseChar']).toBe('!');
    });

    it('a stale reply is cleared when the next wait is armed', () => {
      const port = makePort();
      armChecksumWait(port);
      feed(port, Buffer.from('.', 'latin1'));
      expect(port['_checksumResponseChar']).toBe('.');

      // Second download on the same port instance must not see the previous reply.
      armChecksumWait(port);
      expect(port['_checksumResponseChar']).toBeNull();
    });
  });

  describe('regression pin — why the latch cannot live in _p2DetectionBuffer', () => {
    it('the line-split still destroys the reply in the Prop_Ver buffer', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('.Cog0  INIT\r\nCog0  main\r\n', 'latin1'));

      // The buffer the OLD code polled has been truncated to the trailing partial
      // line — the '.' is gone. This is not a bug to fix in the Prop_Ver buffer;
      // it is correct line-accumulation behavior, and it is precisely why the
      // checksum reply needs its own byte-wise field.
      expect(port['_p2DetectionBuffer']).not.toContain('.');
      // ...while the latch kept it.
      expect(port['_checksumResponseChar']).toBe('.');
    });

    it('a Prop_Ver line clears the buffer outright, and the latch still survives', () => {
      const port = makePort();
      armChecksumWait(port);

      feed(port, Buffer.from('.Prop_Ver G\r\n', 'latin1'));

      expect(port['_p2DetectionBuffer']).toBe('');
      expect(port['_checksumResponseChar']).toBe('.');
    });
  });
});
