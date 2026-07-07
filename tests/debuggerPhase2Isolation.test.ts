/** @format */

/**
 * Multi-cog §5 — the Phase-2 (host→P2 reply) path is per-window isolated and
 * multi-cog-safe. This LOCKS IN existing behavior with a regression test so a
 * future change can't silently make two debugger windows cross-wire their
 * replies. NO source change is expected — if this ever fails, it has caught a
 * real isolation defect.
 *
 * Production path being pinned:
 *   DebuggerController.sendPhase2 (renderer)
 *     → IPC 'debugger:r2m' {kind:'phase2'}
 *       → per-window ipcMain listener, filtered by event.sender.id === own
 *         webContents.id (debugDebuggerWin.installBundleIpc)
 *         → per-window tLongTransmitter.transmitBuffer
 *           → that window's serial-send callback → the one serial port.
 *
 * Every DebugDebuggerWindow shares the single ipcMain dispatcher, so the
 * sender-id self-filter is the sole guarantee that window A never consumes
 * window B's reply. The mock below models that shared dispatcher faithfully:
 * one ipcMain, a unique webContents.id per BrowserWindow.
 */

import { createMockContext } from './shared/mockHelpers';

// Shared state the electron mock factory populates. Jest permits `mock`-prefixed
// out-of-scope references inside a jest.mock factory.
const mockShared: {
  nextWcId: number;
  ipc: Array<{ channel: string; listener: (...args: unknown[]) => void }>;
} = { nextWcId: 500, ipc: [] };

jest.mock('electron', () => {
  const helpers = require('./shared/mockHelpers');
  return {
    // Each window gets a distinct webContents.id — exactly what the sender-id
    // self-filter keys on.
    BrowserWindow: jest.fn().mockImplementation(() => {
      const win = helpers.createMockBrowserWindow();
      win.webContents.id = ++mockShared.nextWcId;
      return win;
    }),
    // One functional ipcMain dispatcher shared by every window (as in Electron).
    ipcMain: {
      on: (channel: string, listener: (...args: unknown[]) => void) => {
        mockShared.ipc.push({ channel, listener });
      },
      removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
        const i = mockShared.ipc.findIndex((e) => e.channel === channel && e.listener === listener);
        if (i >= 0) mockShared.ipc.splice(i, 1);
      }
    },
    app: { getPath: jest.fn().mockReturnValue('/mock/path') },
    nativeImage: { createFromBuffer: jest.fn().mockReturnValue({ toPNG: jest.fn() }) }
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

import { DebugDebuggerWindow } from '../src/classes/debugDebuggerWin';
import { IPC_CHANNELS } from '../src/classes/debugger/shared/ipc';

/** Dispatch a renderer→main message to EVERY ipcMain listener (as Electron does),
 *  stamped with the sending window's webContents id. */
function dispatch(senderId: number, message: unknown): void {
  const event = { sender: { id: senderId } };
  for (const { channel, listener } of [...mockShared.ipc]) {
    if (channel === IPC_CHANNELS.rendererToMain) listener(event, message);
  }
}

const wcId = (w: DebugDebuggerWindow): number => (w as unknown as { debugWindow: { webContents: { id: number } } }).debugWindow.webContents.id;
const phase2 = (fill: number): Uint8Array => new Uint8Array(52).fill(fill);

describe('multi-cog §5 — Phase-2 host→P2 per-window isolation', () => {
  let w0: DebugDebuggerWindow;
  let w1: DebugDebuggerWindow;
  let sent0: Buffer[];
  let sent1: Buffer[];

  beforeEach(() => {
    mockShared.ipc = [];
    // Explicit x/y bypasses WindowPlacer; each ctor installs its ipcMain listener.
    w0 = new DebugDebuggerWindow(createMockContext() as never, 0, { x: 0, y: 0, width: 100, height: 100 });
    w1 = new DebugDebuggerWindow(createMockContext() as never, 1, { x: 0, y: 0, width: 100, height: 100 });
    sent0 = [];
    sent1 = [];
    w0.setSerialTransmissionCallback((d) => sent0.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    w1.setSerialTransmissionCallback((d) => sent1.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
  });

  it('routes each window’s Phase-2 to its OWN serial send — neither consumes the other’s', () => {
    const a = phase2(0xaa);
    dispatch(wcId(w0), { kind: 'phase2', bytes: a });
    expect(sent0).toHaveLength(1);
    expect(Array.from(sent0[0])).toEqual(Array.from(Buffer.from(a))); // exact bytes reached serial
    expect(sent1).toHaveLength(0); // cog-1 window did NOT consume cog-0's reply

    const b = phase2(0xbb);
    dispatch(wcId(w1), { kind: 'phase2', bytes: b });
    expect(sent1).toHaveLength(1);
    expect(Array.from(sent1[0])).toEqual(Array.from(Buffer.from(b)));
    expect(sent0).toHaveLength(1); // cog-0 window unaffected by cog-1's reply
  });

  it('keeps a single window’s back-to-back replies in order', () => {
    // Two replies queued ~1 ms apart (interleaved senders) must each land on the
    // correct window's serial send, in submission order.
    const a1 = phase2(0x11);
    const a2 = phase2(0x22);
    dispatch(wcId(w0), { kind: 'phase2', bytes: a1 });
    dispatch(wcId(w1), { kind: 'phase2', bytes: phase2(0x99) }); // interleaved other-cog reply
    dispatch(wcId(w0), { kind: 'phase2', bytes: a2 });
    expect(sent0).toHaveLength(2);
    expect(sent0[0][0]).toBe(0x11);
    expect(sent0[1][0]).toBe(0x22); // ordering preserved despite the interleave
    expect(sent1).toHaveLength(1);
    expect(sent1[0][0]).toBe(0x99);
  });

  it('a closed window’s listener neither receives nor throws on the other’s Phase-2', () => {
    // Simulate the window's 'closed' teardown (removeBundleIpc unregisters its
    // ipcMain listener). The exact private method the 'closed' handler calls.
    (w1 as unknown as { removeBundleIpc: () => void }).removeBundleIpc();

    // The surviving window still works…
    expect(() => dispatch(wcId(w0), { kind: 'phase2', bytes: phase2(0x44) })).not.toThrow();
    expect(sent0).toHaveLength(1);

    // …and a Phase-2 addressed to the closed window reaches nobody and never throws
    // (its listener is gone; w0's listener filters it out by sender id).
    const before = sent1.length;
    expect(() => dispatch(wcId(w1), { kind: 'phase2', bytes: phase2(0x55) })).not.toThrow();
    expect(sent1).toHaveLength(before); // closed window received nothing
  });
});
