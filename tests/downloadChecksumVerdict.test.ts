/** @format */

// tests/downloadChecksumVerdict.test.ts
//
// A download whose CRC was never verified must not report success.
//
// Found alongside the eaten-checksum-byte defect (see downloadChecksumDetection.test.ts).
// When the '.' reply was destroyed, UsbSerial.download()'s wait timed out and left
// `_checksumVerified` false — and Downloader.download() then took this branch:
//
//     } else {
//       this.logMessage(`  -- Checksum verification: No response from P2`);
//     }                                  // <-- noDownloadError untouched, stays true
//
// ...so `{ success: true }` propagated and both callers printed "Download completed
// successfully" over an image whose CRC nobody had checked. Verification was ASKED
// FOR and did not happen, and the caller had no way to tell.
//
// The P2 always answers '?' with '.' or '!'. Silence means the protocol is out of
// sync, not that all is well.
//
// These tests pin the three-way verdict:
//   verified+valid   -> success
//   verified+invalid -> failure ('!' — image corrupt)
//   NOT verified     -> failure (unverified — the defect fixed here)
// ...and that the distinction survives into the error message, since "corrupt" and
// "never checked" send a user to different places.

const mockLoadFile = jest.fn();
const mockLoadFailed = jest.fn();

jest.mock('../src/utils/files', () => ({
  __esModule: true,
  loadFileAsUint8Array: (...args: any[]) => mockLoadFile(...args),
  loadUint8ArrayFailed: (...args: any[]) => mockLoadFailed(...args),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-08-29T12:00:00.000Z')
}));

import { Downloader } from '../src/classes/downloader';

/** A minimal valid-looking P2 image: the analyzer only reads shape, not content. */
function fakeImage(): Uint8Array {
  return new Uint8Array(64);
}

function makeContext(): any {
  return {
    runEnvironment: { loggingEnabled: false, debugBaudrate: 2_000_000 },
    logger: { forceLogMessage: jest.fn(), logMessage: jest.fn() }
  };
}

/** A UsbSerial stand-in whose checksum verdict the test controls. */
function makePort(checksum: { verified: boolean; valid: boolean; response: string }): any {
  return {
    deviceIsPropellerV2: jest.fn().mockResolvedValue(true),
    download: jest.fn().mockResolvedValue(undefined),
    getChecksumStatus: jest.fn().mockReturnValue(checksum),
    getCurrentBaudRate: jest.fn().mockReturnValue(2_000_000),
    changeBaudRate: jest.fn().mockResolvedValue(undefined)
  };
}

async function runDownload(checksum: {
  verified: boolean;
  valid: boolean;
  response: string;
}): Promise<{ success: boolean; errorMessage?: string }> {
  const port = makePort(checksum);
  const downloader = new Downloader(makeContext(), port);
  return downloader.download('/tmp/blinky.bin', false);
}

describe('Downloader — checksum verdict decides success', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadFile.mockReturnValue(fakeImage());
    mockLoadFailed.mockReturnValue(false);
  });

  it('reports SUCCESS when the CRC verified and passed', async () => {
    const result = await runDownload({ verified: true, valid: true, response: '.' });

    expect(result.success).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('reports FAILURE when the CRC verified and FAILED (P2 sent !)', async () => {
    const result = await runDownload({ verified: true, valid: false, response: '!' });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/FAILED/i);
    expect(result.errorMessage).toMatch(/corrupt/i);
  });

  it('reports FAILURE when the CRC was never verified — the defect fixed here', async () => {
    const result = await runDownload({ verified: false, valid: false, response: '' });

    // Before the fix this returned success:true and the app printed
    // "Download completed successfully" over an unverified image.
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  it('distinguishes "unverified" from "corrupt" in the error message', async () => {
    const unverified = await runDownload({ verified: false, valid: false, response: '' });
    const corrupt = await runDownload({ verified: true, valid: false, response: '!' });

    expect(unverified.errorMessage).not.toEqual(corrupt.errorMessage);
    // "we never got an answer" must not read as "the image is bad" — they send a
    // user to different places (protocol/cabling vs. rebuild the binary).
    expect(unverified.errorMessage).toMatch(/unverified|did not complete|no \. or !/i);
    expect(corrupt.errorMessage).toMatch(/corrupt/i);
  });
});
