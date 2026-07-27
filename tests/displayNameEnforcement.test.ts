/** @format */

// tests/displayNameEnforcement.test.ts
//
// The rule itself is pinned in displayNameRules.test.ts; this pins the WIRING — that a
// creation command carrying an illegal display name is refused at MainWindow's single
// creation choke point, loudly, before any window object exists.
//
// Why loudly: PNut's own failure mode is silence (parse_debug_string aborts, sets
// debug_display_type[0] = 0, and DebugUnit.pas matches it against neither create nor
// update). Stephen hit exactly that on hardware — a display named `trace` produced no
// window and no message, while `spin2` worked. We deviate deliberately, the same way we
// already do for a duplicate display name: say what is wrong and stop the run.

import { jest } from '@jest/globals';
import { MainWindow } from '../src/classes/mainWindow';
import { LoggerWindow } from '../src/classes/loggerWin';
import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { createMockBrowserWindow } from './shared/mockHelpers';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';

jest.mock('electron', () => ({
  app: {
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    getPath: jest.fn().mockReturnValue('/tmp')
  },
  BrowserWindow: jest.fn(() => createMockBrowserWindow()),
  Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
  MenuItem: jest.fn(),
  dialog: { showSaveDialog: jest.fn(), showMessageBox: jest.fn() },
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({ workAreaSize: { width: 1920, height: 1080 } })
  },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() }
}));

jest.mock('fs');
jest.mock('../src/utils/usb.serial');
jest.mock('../src/classes/debugScopeWin');
jest.mock('../src/classes/debugTermWin');
jest.mock('../src/classes/debugPlotWin');
jest.mock('../src/classes/debugLogicWin');
jest.mock('../src/classes/debugBitmapWin');
jest.mock('../src/classes/debugMidiWin');
jest.mock('../src/classes/loggerWin', () => ({
  LoggerWindow: { getInstance: jest.fn() }
}));

describe('Illegal DEBUG display names are refused at creation', () => {
  let mainWindow: MainWindow;
  let mockContext: any;
  let cleanup: () => void;
  let fatal: jest.Mock;

  /** Feed a creation command through the same entry point the router uses. */
  function sendCreation(command: string): void {
    (mainWindow as any).handleWindowCommand({
      data: new TextEncoder().encode(command)
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    const testSetup = setupDebugWindowTests({ windowType: 'term', displayName: 'TestLogger' });
    mockContext = testSetup.mockContext;
    cleanup = testSetup.cleanup;
    mockContext.runEnvironment = { selectedPropPlug: '/dev/ttyUSB0', ideMode: false, loggingEnabled: false };
    mockContext.currentFolder = '/test/workspace';

    (LoggerWindow.getInstance as jest.Mock).mockReturnValue({
      updateContent: jest.fn(),
      on: jest.fn(),
      handleDTRReset: jest.fn(),
      logSystemMessage: jest.fn()
    });

    // The window classes are auto-mocked, so their static parsers return undefined by
    // default; give PLOT a valid parse so the ACCEPT cases reach creation instead of
    // failing on the mock. (The rejection cases never get this far — that is the point.)
    (DebugPlotWindow.parsePlotDeclaration as jest.Mock).mockReturnValue([
      true,
      { displayName: 'accepted', windowTitle: 'accepted' }
    ]);

    mainWindow = new MainWindow(mockContext);

    fatal = jest.fn();
    (mainWindow as any).windowRouter.on('fatalDisplayError', fatal);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('refuses a reserved word — the `trace` case from hardware', () => {
    sendCreation('`PLOT trace SIZE 400 400');

    expect(fatal).toHaveBeenCalledTimes(1);
    const { windowId, message } = (fatal.mock.calls[0] as any[])[0];
    expect(windowId).toBe('trace');
    expect(message).toContain('reserved');
    // No window may exist under that name.
    expect((mainWindow as any).displays['trace']).toBeUndefined();
  });

  it('refuses it whatever the casing, since matching is case-insensitive', () => {
    sendCreation('`PLOT TRACE SIZE 400 400');
    expect(fatal).toHaveBeenCalledTimes(1);
  });

  it('refuses a name starting with a digit', () => {
    sendCreation('`TERM 2fast SIZE 40 20');

    expect(fatal).toHaveBeenCalledTimes(1);
    expect((fatal.mock.calls[0] as any[])[0].message).toContain('starts with a digit');
  });

  it('refuses a name with an illegal character', () => {
    sendCreation('`TERM my-term SIZE 40 20');
    expect(fatal).toHaveBeenCalledTimes(1);
  });

  it('ACCEPTS `spin2` — the debug-display table is not the Spin2 keyword list', () => {
    sendCreation('`PLOT spin2 SIZE 400 400');

    // The point of the test: no fatal. (Window construction itself is mocked out.)
    expect(fatal).not.toHaveBeenCalled();
  });

  it('accepts ordinary names, including ones that merely CONTAIN a reserved word', () => {
    for (const name of ['MyPlot', 'my_trace', 'traces', '_hidden']) {
      fatal.mockClear();
      sendCreation(`\`PLOT ${name} SIZE 400 400`);
      expect(fatal).not.toHaveBeenCalled();
    }
  });

  it('does not touch UPDATE commands — only creation carries a new name', () => {
    // `trace ...` as an update is a routing question (the window either exists or it does
    // not); it must not be re-validated as if it were a new display name.
    sendCreation('`someWindow CLEAR');
    expect(fatal).not.toHaveBeenCalled();
  });
});
