/** @format */

/**
 * Bytes discarded after a post-download baud switch must be SHOWN (decision 2026-09-29).
 *
 * When the program's DEBUG baud differs from the download baud, term-ts switches the port and
 * then discards EVERYTHING received for 25 ms, to clear bytes scrambled by the switch. That
 * window cannot tell switch garbage from the program's first real output, and on a slow host
 * (Raspberry Pi) the timer overruns and the window grows. It used to drop silently.
 * (PNut has no counterpart: it only runs DEBUG when the two rates are equal — SerialUnit.pas:132.)
 *
 * Pinned: the drop is logged on the always-live channel with its count, the window's REAL
 * length, and the bytes themselves as hex and as text — so a reader can tell which it was.
 */

import { EventEmitter } from 'events';

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

function alwaysLive(ctx: any): string[] {
  return ctx.logger.forceLogMessage.mock.calls.map((c: any[]) => String(c[0]));
}

/** A UsbSerial over an EventEmitter port, so the test can deliver 'data' inside the window. */
function makePort(): { port: any; ctx: any; wire: EventEmitter; appHandler: jest.Mock } {
  const ctx = makeContext();
  const port: any = new UsbSerial(ctx, '/dev/null');
  const wire: any = new EventEmitter();
  wire.isOpen = true;
  const appHandler = jest.fn();
  wire.on('data', appHandler);
  port['_serialPort'] = wire;
  return { port, ctx, wire, appHandler };
}

describe('post-baud-switch discard is visible', () => {
  it('shows the discarded bytes as hex and text, with the count', async () => {
    const { port, ctx, wire, appHandler } = makePort();

    const clearing = port.clearGarbageBytes(25);
    wire.emit('data', Buffer.from([0xff, 0x00, 0x7f]));
    wire.emit('data', Buffer.from('Cog0  INIT', 'latin1'));
    const count = await clearing;

    expect(count).toBe(13);
    expect(appHandler).not.toHaveBeenCalled(); // still discarded — the decision keeps the drop
    const lines = alwaysLive(ctx).filter((l) => l.startsWith('[BAUD SWITCH]'));
    expect(lines[0]).toMatch(/Discarded 13 byte\(s\) received in the \d+ms after the baud switch/);
    expect(lines[1]).toContain('FF 00 7F 43 6F 67 30 20 20 49 4E 49 54');
    expect(lines[1]).toContain('|...Cog0  INIT|');
  });

  it('says nothing when nothing was discarded', async () => {
    const { port, ctx } = makePort();
    await port.clearGarbageBytes(5);
    expect(alwaysLive(ctx).some((l) => l.startsWith('[BAUD SWITCH]'))).toBe(false);
  });

  it('the original data handler is restored afterwards', async () => {
    const { port, wire, appHandler } = makePort();
    await port.clearGarbageBytes(5);
    wire.emit('data', Buffer.from('after', 'latin1'));
    expect(appHandler).toHaveBeenCalledTimes(1);
  });

  it('a large drop shows its first 256 bytes and says so', () => {
    const lines = UsbSerial.describeDiscardedBytes(Buffer.alloc(256, 0x41), 5000, 31);
    expect(lines[0]).toContain('Discarded 5000 byte(s) received in the 31ms');
    expect(lines[0]).toContain('(first 256 shown)');
    expect(lines).toHaveLength(1 + 256 / 32);
  });
});
