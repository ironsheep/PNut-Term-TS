/** @format */

// tests/loggerCOGWinEndSession.test.ts
//
// The per-cog logger window used a bare "contains 0x1B" test. That is the DOG-VOICE class
// (#32): a binary DEBUG sample $031B (bytes 1B 03) replaced the WHOLE message with
// "[DEBUG_END_SESSION]". The Debug Logger was fixed in June; this window was missed. It now
// shares the one sentinel definition and shows the line as sent, ESC as <END_SESSION>.

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  ipcMain: { on: jest.fn(), removeListener: jest.fn() },
  dialog: {}
}));
jest.mock('fs');

import { LoggerCOGWindow } from '../src/classes/loggerCOGWin';

/** Drive processMessage without a window or a log file. */
function makeCogLogger(): any {
  const w: any = Object.create(LoggerCOGWindow.prototype);
  w.cogId = 0;
  // Viewer gone: no render work. Defined directly, because the base-class setter treats
  // an assignment of null as a window close and starts tearing down.
  Object.defineProperty(w, 'debugWindow', { value: null, writable: true });
  w.logFile = null;
  w.historyBuffer = [];
  w.maxLines = 1000;
  w.hasReceivedTraffic = true;
  w.messageCount = 0;
  return w;
}

const latin1 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'latin1'));

describe('COG logger window — DEBUG_END_SESSION', () => {
  test.each([
    ['with CR LF', 'Cog0  \x1b\r\n', 'Cog0  <END_SESSION>'],
    ['without CR LF', 'Cog0  \x1b', 'Cog0  <END_SESSION>']
  ])('%s: the line as sent, ESC shown as <END_SESSION>', (_n, wire, shown) => {
    const w = makeCogLogger();
    w.processMessage(latin1(wire));
    expect(w.historyBuffer).toEqual([shown]);
  });

  test('NEGATIVE: binary sample $031B inside a message is NOT turned into an end-session line', () => {
    const w = makeCogLogger();
    w.processMessage(latin1("Cog0  heard '\x10\x03\x1b\x03\x35\x03(none)'\r\n"));
    expect(w.historyBuffer.length).toBe(1);
    expect(w.historyBuffer[0]).not.toContain('END_SESSION');
  });
});
