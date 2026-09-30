/**
 * PC_KEY / PC_MOUSE are answered wherever they sit in the message, in every display window.
 *
 * Pascal's <TYPE>_Update loops handle key_pc_key / key_pc_mouse as ordinary elements
 * (DebugDisplayUnit.pas LOGIC :1062, SCOPE :1262, SCOPE_XY :1463, FFT :1651, SPECTRO :1811,
 * PLOT :2149, TERM :2251, plus BITMAP and MIDI). The P2 emits the PC_* token LAST, after the
 * directives its backtick string carried, then blocks in rxlong with no timeout
 * (Spin2_debugger.spin2:603-613). Our windows recognised PC_* only as the FIRST token, so
 * `debug(`w clear pc_key(@k))` got no reply and the P2 hung forever.
 *
 * These tests assert the caller-visible OUTCOME: the exact bytes written to the serial port,
 * and their order relative to the directive that preceded them.
 *
 * Also covered: PC_KEY is polled, so keyboard capture is enabled ONCE, not per poll. Enabling
 * it per poll queued a renderer script per poll (and PLOT, unguarded, stacked a keydown
 * listener per poll), so on a slow host real input waited behind them.
 */
import { setupDebugWindowTest, cleanupDebugWindowTest } from './shared/mockHelpers';

let mockBrowserWindowInstances: any[] = [];

jest.mock('electron', () => {
  const createMockBrowserWindow = require('./shared/mockHelpers').createMockBrowserWindow;
  return {
    BrowserWindow: jest.fn().mockImplementation(() => {
      const mockWindow = createMockBrowserWindow();
      mockBrowserWindowInstances.push(mockWindow);
      return mockWindow;
    }),
    app: { getPath: jest.fn().mockReturnValue('/test/path'), on: jest.fn(), quit: jest.fn() },
    ipcMain: { on: jest.fn(), handle: jest.fn(), removeHandler: jest.fn() },
    screen: (() => {
      const display = {
        id: 1,
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        workAreaSize: { width: 1920, height: 1080 },
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        size: { width: 1920, height: 1080 },
        scaleFactor: 1
      };
      return {
        getPrimaryDisplay: jest.fn().mockReturnValue(display),
        getAllDisplays: jest.fn().mockReturnValue([display]),
        getDisplayMatching: jest.fn().mockReturnValue(display),
        getDisplayNearestPoint: jest.fn().mockReturnValue(display),
        getCursorScreenPoint: jest.fn().mockReturnValue({ x: 0, y: 0 })
      };
    })()
  };
});

import { DebugScopeWindow } from '../src/classes/debugScopeWin';
import { DebugScopeXyWindow } from '../src/classes/debugScopeXyWin';
import { DebugLogicWindow } from '../src/classes/debugLogicWin';
import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { DebugTermWindow } from '../src/classes/debugTermWin';
import { DebugBitmapWindow } from '../src/classes/debugBitmapWin';
import { DebugMidiWindow } from '../src/classes/debugMidiWin';
import { DebugSpectroWindow } from '../src/classes/debugSpectroWin';
import { DebugFFTWindow } from '../src/classes/debugFftWin';

const pinPos = (spec: any) => {
  spec.hasExplicitPosition = true;
  spec.position = { x: 0, y: 0 };
  return spec;
};
const WINDOWS: Array<{ name: string; make: (ctx: any) => any }> = [
  { name: 'SCOPE', make: (ctx) => new DebugScopeWindow(ctx, pinPos(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'W'])[1])) },
  { name: 'SCOPE_XY', make: (ctx) => new DebugScopeXyWindow(ctx, pinPos(DebugScopeXyWindow.parseScopeXyDeclaration(['`SCOPE_XY', 'W'])[1])) },
  { name: 'LOGIC', make: (ctx) => new DebugLogicWindow(ctx, pinPos(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'W'])[1])) },
  { name: 'PLOT', make: (ctx) => new DebugPlotWindow(ctx, pinPos(DebugPlotWindow.parsePlotDeclaration(['`PLOT', 'W'])[1])) },
  { name: 'TERM', make: (ctx) => new DebugTermWindow(ctx, pinPos(DebugTermWindow.parseTermDeclaration(['`TERM', 'W'])[1])) },
  { name: 'BITMAP', make: (ctx) => new DebugBitmapWindow(ctx, pinPos(DebugBitmapWindow.parseBitmapDeclaration(['`BITMAP', 'W'])[1])) },
  { name: 'MIDI', make: (ctx) => new DebugMidiWindow(ctx, pinPos(DebugMidiWindow.parseMidiDeclaration(['`MIDI', 'W'])[1])) },
  { name: 'SPECTRO', make: (ctx) => new DebugSpectroWindow(ctx, pinPos(DebugSpectroWindow.createDisplaySpec('W', ['SPECTRO', 'W']))) },
  { name: 'FFT', make: (ctx) => new DebugFFTWindow(ctx, pinPos(DebugFFTWindow.createDisplaySpec('W', ['FFT', 'W']))) }
];

// Pascal SendMousePos off-window reply (DebugDisplayUnit.pas:3549): v := $03FFFFFF; c := $FFFFFFFF.
const MOUSE_OFF_WINDOW = [0xff, 0xff, 0xff, 0x03, 0xff, 0xff, 0xff, 0xff];

describe('PC_KEY / PC_MOUSE reply at any position in the message', () => {
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserWindowInstances = [];
    mockContext = setupDebugWindowTest().mockContext;
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

  /**
   * Build a ready window whose serial writes and CLEAR effects land in one ordered event log,
   * so a test can assert both WHAT was sent and WHEN relative to the directive before it.
   */
  const build = (w: { make: (ctx: any) => any }) => {
    const win = w.make(mockContext);
    const events: string[] = [];
    const sent: number[][] = [];
    win.setSerialTransmissionCallback((data: string | Buffer) => {
      const bytes = Array.from(Buffer.isBuffer(data) ? data : Buffer.from(data, 'latin1'));
      sent.push(bytes);
      events.push(`tx:${bytes.length}`);
    });
    jest.spyOn(win as any, 'clearDisplayContent').mockImplementation(() => {
      events.push('clear');
    });
    // Capture enabling touches the renderer; not what these tests measure.
    jest.spyOn(win as any, 'enableKeyboardInput').mockImplementation(() => undefined);
    jest.spyOn(win as any, 'enableMouseInput').mockImplementation(() => undefined);
    (win as any).onWindowReady();
    return { win, events, sent };
  };

  for (const w of WINDOWS) {
    describe(w.name, () => {
      it('PC_KEY alone → one 4-byte little-endian reply of the stored key, then the key is cleared', async () => {
        const { win, sent } = build(w);
        (win as any).vKeyPress = 0x41;
        await win.updateContent(['PC_KEY']);
        await settle();
        expect(sent).toEqual([[0x41, 0x00, 0x00, 0x00]]);
        expect((win as any).vKeyPress).toBe(0);
      });

      it('CLEAR PC_KEY → CLEAR runs, THEN the key reply goes out (no reply = P2 hangs)', async () => {
        const { win, events, sent } = build(w);
        (win as any).vKeyPress = 0x0d;
        await win.updateContent(['CLEAR', 'PC_KEY']);
        await settle();
        expect(sent).toEqual([[0x0d, 0x00, 0x00, 0x00]]);
        expect(events).toEqual(['clear', 'tx:4']);
      });

      it('CLEAR PC_MOUSE → CLEAR runs, THEN the 8-byte mouse reply goes out', async () => {
        const { win, events, sent } = build(w);
        // Cursor never entered the canvas: the reply is Pascal's off-window value.
        await win.updateContent(['CLEAR', 'PC_MOUSE']);
        await settle();
        expect(sent).toEqual([MOUSE_OFF_WINDOW]);
        expect(events).toEqual(['clear', 'tx:8']);
      });

      it('PC_KEY CLEAR → the reply, THEN the directive after it still runs', async () => {
        const { win, events } = build(w);
        await win.updateContent(['PC_KEY', 'CLEAR']);
        await settle();
        expect(events).toEqual(['tx:4', 'clear']);
      });

      it('lower-case pc_mouse is recognised (Pascal keywords are case-insensitive)', async () => {
        const { win, sent } = build(w);
        await win.updateContent(['clear', 'pc_mouse']);
        await settle();
        expect(sent).toEqual([MOUSE_OFF_WINDOW]);
      });

      it('a message with no PC_* token sends nothing', async () => {
        const { win, sent } = build(w);
        await win.updateContent(['CLEAR']);
        await settle();
        expect(sent).toEqual([]);
      });

      it('a capture-setup failure never withholds the reply (the P2 would hang in rxlong)', async () => {
        const { win, sent } = build(w);
        (win as any).enableMouseInput.mockImplementation(() => {
          throw new Error('renderer not ready');
        });
        (win as any).enableKeyboardInput.mockImplementation(() => {
          throw new Error('renderer not ready');
        });
        await win.updateContent(['PC_MOUSE']);
        await win.updateContent(['PC_KEY']);
        await settle();
        expect(sent).toEqual([MOUSE_OFF_WINDOW, [0, 0, 0, 0]]);
      });

      it('CLEAR CLOSE PC_KEY → CLEAR, the reply, and only THEN the close (Pascal closes last)', async () => {
        const { win, events } = build(w);
        jest.spyOn(win as any, 'flushPending').mockImplementation(async () => {
          events.push('close');
        });
        await win.updateContent(['CLEAR', 'CLOSE', 'PC_KEY']);
        await settle();
        expect(events).toEqual(['clear', 'tx:4', 'close']);
      });

      it('PC_KEY polled 50 times enables keyboard capture exactly once', async () => {
        const { win, sent } = build(w);
        const enableSpy = (win as any).enableKeyboardInput as jest.Mock;
        for (let i = 0; i < 50; i++) {
          await win.updateContent(['PC_KEY']);
        }
        await settle();
        expect(sent).toHaveLength(50); // every poll still answered
        // SCOPE/FFT create their BrowserWindow on first data: with none yet there is nothing to
        // attach to, so capture is not marked done (it is retried on a later poll).
        expect(enableSpy).toHaveBeenCalledTimes((win as any).debugWindow ? 1 : 0);
      });
    });
  }

  it("TERM: a quoted 'PC_KEY' string is text, not a request — no reply", async () => {
    const { win, sent } = build(WINDOWS.find((w) => w.name === 'TERM')!);
    await win.updateContent(["'PC_KEY'"]);
    await settle();
    expect(sent).toEqual([]);
  });
});

describe('PC_MOUSE reports the wheel notch (Pascal FormMouseWheel + 100 ms MouseWheelTimer)', () => {
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserWindowInstances = [];
    mockContext = setupDebugWindowTest().mockContext;
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
  const le32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const w of WINDOWS) {
    it(`${w.name}: a wheel-down notch is sent once, then cleared by the reply`, async () => {
      const win = w.make(mockContext);
      const sent: number[][] = [];
      win.setSerialTransmissionCallback((data: Buffer) => sent.push(Array.from(data)));
      jest.spyOn(win as any, 'getPixelColorAt').mockResolvedValue(0x123456);
      (win as any).onWindowReady();

      // A PC_MOUSE before the BrowserWindow exists (SCOPE/FFT create it on first data) must
      // still be answered, and must leave capture to be enabled once the window appears.
      if (!(win as any).debugWindow) {
        await win.updateContent(['PC_MOUSE']);
        await settle();
        expect(sent).toEqual([MOUSE_OFF_WINDOW]);
        (win as any).debugWindow = require('./shared/mockHelpers').createMockBrowserWindow();
      }

      // This PC_MOUSE enables capture, registering the real renderer→main IPC receiver, and is
      // answered even though enabling touches the renderer (LOGIC's override used to throw here).
      sent.length = 0;
      await win.updateContent(['PC_MOUSE']);
      await settle();
      expect(sent).toEqual([MOUSE_OFF_WINDOW]);
      const onCalls = (win as any).debugWindow.webContents.on.mock.calls;
      const receiver = onCalls.find((c: any[]) => c[0] === 'ipc-message')[1];

      // Renderer reports a wheel-down notch at (2,2): wheelDelta -1, no buttons.
      receiver({}, 'mouse-event', 2, 2, { left: false, middle: false, right: false }, -1);
      sent.length = 0;
      await win.updateContent(['PC_MOUSE']);
      await win.updateContent(['PC_MOUSE']);
      await settle();

      const t = (win as any).transformMouseCoordinates(2, 2);
      const pos = (t.y & 0x1fff) << 13 | (t.x & 0x1fff);
      expect(sent).toEqual([
        [...le32(pos | (3 << 26)), ...le32(0x123456)], // wheel -1 → 2-bit field 3
        [...le32(pos), ...le32(0x123456)] // consumed: the next reply carries no wheel
      ]);

      // An unconsumed notch expires after 100 ms even with the cursor still (no further
      // mouse-event to refresh it). PLOT's old copy kept reporting it until the next reply.
      receiver({}, 'mouse-event', 2, 2, { left: false, middle: false, right: false }, 1);
      await settle(150);
      sent.length = 0;
      await win.updateContent(['PC_MOUSE']);
      await settle();
      expect(sent).toEqual([[...le32(pos), ...le32(0x123456)]]);
    });
  }

  it('an unconsumed notch expires after 100 ms (Pascal MouseWheelTimer)', async () => {
    const win = WINDOWS[0].make(mockContext);
    (win as any).noteMouseWheel(120);
    expect((win as any).vMouseWheel).toBe(1);
    await settle(150);
    expect((win as any).vMouseWheel).toBe(0);
  });
});

describe('non-display windows opt out of PC_* answering', () => {
  it('a window with answersPcInput=false passes the message through whole', async () => {
    const processMessageImmediate = jest.fn().mockResolvedValue(undefined);
    const ctx: any = { answersPcInput: false, processMessageImmediate };
    const { DebugWindowBase } = require('../src/classes/debugWindowBase');
    await DebugWindowBase.prototype['processMessageWithPcInput'].call(ctx, ['text', 'PC_KEY']);
    expect(processMessageImmediate.mock.calls).toEqual([[['text', 'PC_KEY']]]);
  });

  it('a display window splits the same message at the PC_KEY', async () => {
    const processMessageImmediate = jest.fn().mockResolvedValue(undefined);
    const ctx: any = { answersPcInput: true, processMessageImmediate };
    const { DebugWindowBase } = require('../src/classes/debugWindowBase');
    await DebugWindowBase.prototype['processMessageWithPcInput'].call(ctx, ['text', 'PC_KEY']);
    expect(processMessageImmediate.mock.calls).toEqual([[['text']], [['PC_KEY']]]);
  });
});

describe('PLOT keyboard capture injection', () => {
  it('guards against re-injection, so one keypress is reported once', () => {
    let injected = '';
    const ctx: any = {
      logMessage: () => {},
      inputForwarder: { startPolling: () => {} },
      debugWindow: {
        webContents: {
          executeJavaScript: (js: string) => {
            injected = js;
            return Promise.resolve();
          }
        }
      }
    };
    (DebugPlotWindow.prototype as any).enableKeyboardInput.call(ctx);
    expect(injected).toContain('if (window.__keyboardInputInitialized) return;');
    expect(injected).toContain("ipcRenderer.send('key-event'");
  });
});
