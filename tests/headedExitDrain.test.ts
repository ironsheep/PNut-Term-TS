/** @format */

/**
 * Unit tests for the anti-truncation drain mechanism added to DebugWindowBase
 * (flushPending / trackPending). This is the core of the headed-mode
 * "complete the SAVE before we tear the window down / shut the app down" fix.
 *
 * We exercise the base-class machinery directly via a minimal concrete
 * subclass — no real Electron window needed.
 */

jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: () => false,
    webContents: { on: jest.fn(), send: jest.fn() }
  })),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('../src/utils/usb.serial', () => ({
  UsbSerial: jest.fn().mockImplementation(() => ({ write: jest.fn().mockResolvedValue(undefined) }))
}));

import { DebugWindowBase } from '../src/classes/debugWindowBase';
import { createMockContext } from './shared/mockHelpers';

class TestWindow extends DebugWindowBase {
  closeDebugWindow(): void {
    /* no-op for test */
  }
  get windowTitle(): string {
    return 'Test Window';
  }
  protected getCanvasId(): string {
    return 'canvas';
  }
  protected async processMessageImmediate(): Promise<void> {
    /* no-op for test */
  }
  /** Expose the protected tracker so tests can inject in-flight ops. */
  public track<T>(p: Promise<T>): Promise<T> {
    return this.trackPending(p);
  }
}

function makeWindow(): TestWindow {
  return new TestWindow(createMockContext() as any, 'test-drain', 'test');
}

/** A promise plus its resolver, so a test controls when an "op" completes. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('DebugWindowBase drain (flushPending / trackPending)', () => {
  it('flushPending returns immediately when nothing is in flight', async () => {
    const win = makeWindow();
    expect(win.hasPendingOps()).toBe(false);
    await expect(win.flushPending(50)).resolves.toBe(true);
  });

  it('reports an op as pending until it settles, then clears it', async () => {
    const win = makeWindow();
    const d = deferred();
    win.track(d.promise);
    expect(win.hasPendingOps()).toBe(true);
    d.resolve();
    // Allow the tracking cleanup microtask to run.
    await win.flushPending(1000);
    expect(win.hasPendingOps()).toBe(false);
  });

  it('flushPending WAITS for an in-flight op and then resolves true', async () => {
    const win = makeWindow();
    const d = deferred();
    win.track(d.promise);
    let flushed = false;
    const flushP = win.flushPending(1000).then((ok) => {
      flushed = ok;
      return ok;
    });
    // Not done yet — the op hasn't completed.
    expect(flushed).toBe(false);
    d.resolve();
    await expect(flushP).resolves.toBe(true);
  });

  it('flushPending returns false when an op overruns the timeout (truncation risk)', async () => {
    const win = makeWindow();
    const d = deferred(); // never resolved within the window
    win.track(d.promise);
    await expect(win.flushPending(60)).resolves.toBe(false);
    // Clean up the dangling promise so Jest does not warn.
    d.resolve();
  });
});
