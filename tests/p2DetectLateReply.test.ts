/** @format */

/**
 * P2 detection must not give up on a reply that is merely LATE (slow-host survey, 2026-09-29).
 *
 * deviceIsPropellerV2() reset the P2, sent Prop_Chk, then SLEPT a fixed 200 ms and looked once.
 * The reply usually takes ~90 ms, so on a slow host (a Raspberry Pi) a reply delivered at, say,
 * 300 ms was ignored: the attempt counted as failed and the next one RESET the P2 again. Three
 * late replies and the download reported "No Propeller v2 device found" for a P2 that answered.
 *
 * Now 200 ms is a MINIMUM (a fast host behaves exactly as before) and a late reply is accepted
 * up to 1000 ms. The P2 ROM loader keeps its serial window open for 60 s on the default boot
 * pattern, so waiting for an answer already in flight is safe.
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
    runEnvironment: { loggingEnabled: false, serialDiagnostics: false },
    logger: { forceLogMessage: jest.fn(), logMessage: jest.fn() }
  };
}

/**
 * A UsbSerial whose reset+Prop_Chk step is replaced by: "the P2 answers `delayMs` later",
 * delivered through the same checkForP2Response() the 'data' handler calls.
 * `delayMs` null = the P2 never answers.
 */
function makePort(delayMs: number | null): { port: any; resets: () => number } {
  const port: any = new UsbSerial(makeContext(), '/dev/null');
  let resets = 0;
  port['requestPropellerVersionForDownload'] = jest.fn(async () => {
    resets++;
    if (delayMs !== null) {
      setTimeout(() => port['checkForP2Response'](Buffer.from('Prop_Ver G\r\n', 'latin1')), delayMs);
    }
    return true;
  });
  return { port, resets: () => resets };
}

describe('deviceIsPropellerV2 — a late reply is a reply', () => {
  it('a reply at 90 ms (the usual case) is found on the first attempt', async () => {
    const { port, resets } = makePort(90);
    await expect(port.deviceIsPropellerV2()).resolves.toBe(true);
    expect(resets()).toBe(1);
  });

  it('THE DEFECT: a reply at 400 ms (slow host) is found on the FIRST attempt — no second reset', async () => {
    const { port, resets } = makePort(400);
    await expect(port.deviceIsPropellerV2()).resolves.toBe(true);
    expect(resets()).toBe(1);
  });

  it('an absent P2 still fails, after the bounded retries', async () => {
    const { port, resets } = makePort(null);
    await expect(port.deviceIsPropellerV2()).resolves.toBe(false);
    expect(resets()).toBe(3);
  }, 10000);
});
