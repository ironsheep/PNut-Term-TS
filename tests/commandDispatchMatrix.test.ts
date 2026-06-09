/**
 * Command-dispatch matrix — every debug DISPLAY window must correctly handle the
 * common commands (SAVE, SAVE WINDOW, CLEAR, CLOSE) as the WindowRouter delivers
 * them: the window NAME is stripped by the router (windowRouter dataParts), so the
 * window receives the BARE command, e.g. ['save', "'f'"] / ['close'].
 *
 * This is the regression net for the class of bug where a window mis-handles that
 * router-stripped shape. SCOPE_XY had re-stripped the first token (elements.slice(1)),
 * so 'close' -> [] and 'save f' -> ['f'] and EVERY common command was silently
 * dropped — yet its own unit test passed because it fed a name-PREFIXED array,
 * baking in the same wrong assumption. These tests feed the real router shape
 * (no name prefix) and assert the command's EFFECT actually fires.
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

// Build each window with a VALID spec produced by its own declaration parser
// (the real path mainWindow uses), so construction matches production. Pin an
// explicit position so construction skips WindowPlacer (no screen-geometry mock
// needed) — irrelevant to command dispatch.
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

describe('Common command dispatch matrix (router-stripped shape)', () => {
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserWindowInstances = [];
    mockContext = setupDebugWindowTest().mockContext;
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  // Some windows fire their async pipeline without awaiting it (the command effect
  // lands a few microtasks after updateContent resolves), so settle on a real timer.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

  // Build + mark ready so updateContent() processes immediately instead of queuing.
  const build = (w: { make: (ctx: any) => any }) => {
    const win = w.make(mockContext);
    if (typeof (win as any).onWindowReady === 'function') (win as any).onWindowReady();
    return win;
  };

  for (const w of WINDOWS) {
    describe(w.name, () => {
      it('SAVE \'file\' → saveWindowToBMPFilename(file)', async () => {
        const win = build(w);
        const saveSpy = jest
          .spyOn(win as any, 'saveWindowToBMPFilename')
          .mockResolvedValue(undefined);
        await win.updateContent(['SAVE', "'DUMP'"]);
        await settle();
        expect(saveSpy).toHaveBeenCalledWith('DUMP');
      });

      it('SAVE WINDOW \'file\' → saveDesktopWindowToBMPFilename(file)', async () => {
        const win = build(w);
        const saveWinSpy = jest
          .spyOn(win as any, 'saveDesktopWindowToBMPFilename')
          .mockResolvedValue(undefined);
        await win.updateContent(['SAVE', 'WINDOW', "'DUMP'"]);
        await settle();
        expect(saveWinSpy).toHaveBeenCalledWith('DUMP');
      });

      it('CLEAR → clearDisplayContent()', async () => {
        const win = build(w);
        const clearSpy = jest.spyOn(win as any, 'clearDisplayContent').mockReturnValue(undefined);
        await win.updateContent(['CLEAR']);
        await settle();
        expect(clearSpy).toHaveBeenCalled();
      });

      it('CLOSE → reaches base teardown (flushPending)', async () => {
        const win = build(w);
        // Base CLOSE handler awaits flushPending() before destroying the window;
        // spying it proves the bare 'close' was dispatched (SCOPE_XY used to drop it).
        const flushSpy = jest.spyOn(win as any, 'flushPending');
        await win.updateContent(['CLOSE']);
        await settle();
        expect(flushSpy).toHaveBeenCalled();
      });
    });
  }
});
