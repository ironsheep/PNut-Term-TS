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
  /** Expose the protected RENDER tracker so tests can inject an in-flight draw. */
  public trackDraw(p: Promise<unknown>): void {
    this.trackRender(p);
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

/**
 * Regression: the `--exit-on-end-session` paint gap (HW-reported 2026-07-18).
 *
 * Draws are tracked on `renderChain` (trackRender/scheduleRender), which is SEPARATE from the
 * `pendingOps` set that flushPending drains. Only SAVE awaited renderChain (via
 * flushBeforeCapture), so a headed batch run with no queued SAVE tore its windows down with the
 * final draw still in flight — the last output never painted. `flushRenders()` closes that gap and
 * the shutdown drain now calls it.
 */
describe('DebugWindowBase render drain (flushRenders) — --exit-on-end-session paint gap', () => {
  it('flushPending does NOT cover an in-flight DRAW (this is why the gap existed)', async () => {
    const win = makeWindow();
    const draw = deferred();
    win.trackDraw(draw.promise);

    // A draw is not a pendingOp — the old shutdown drain therefore saw "nothing in flight"
    // and closed the window while the paint was still outstanding.
    expect(win.hasPendingOps()).toBe(false);
    await expect(win.flushPending(50)).resolves.toBe(true);

    draw.resolve();
  });

  it('flushRenders WAITS for an in-flight draw to land, then resolves', async () => {
    const win = makeWindow();
    const draw = deferred();
    win.trackDraw(draw.promise);

    let resolved = false;
    const flushP = win.flushRenders().then(() => {
      resolved = true;
    });

    // Still waiting on the draw.
    await new Promise((r) => setTimeout(r, 20));
    expect(resolved).toBe(false);

    draw.resolve();
    await flushP;
    expect(resolved).toBe(true);
  });
});
