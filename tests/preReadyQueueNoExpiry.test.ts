/** @format */

/**
 * Messages that arrive before a debug window's renderer is ready must all be drawn
 * (slow-host survey, 2026-09-29).
 *
 * The pre-ready queue was MessageQueue(1000, 5000): anything older than 5 s when the window
 * became ready was dropped by removeExpired(), with no message. On a slow host (a Raspberry
 * Pi's windows take >8 s to load) that silently lost the head of every stream — the samples and
 * configuration a program sends right after creating a display. The "messages were dropped"
 * warning could never fire either: its count was read BEFORE dequeueAll() did the dropping.
 *
 * Pinned: no age expiry before ready; a capacity drop is counted after the fact and reported
 * on the always-on channel.
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
import { MessageQueue } from '../src/classes/shared/messageQueue';
import { createMockContext } from './shared/mockHelpers';

class TestWindow extends DebugWindowBase {
  public processed: any[] = [];
  closeDebugWindow(): void {
    /* no-op for test */
  }
  get windowTitle(): string {
    return 'Test Window';
  }
  protected getCanvasId(): string {
    return 'canvas';
  }
  protected async processMessageImmediate(lineParts: any): Promise<void> {
    this.processed.push(lineParts);
  }
  public ready(): Promise<void> {
    return this.onWindowReady();
  }
}

describe('pre-ready queue keeps the head of the stream', () => {
  let ctx: any;

  beforeEach(() => {
    jest.useFakeTimers();
    ctx = createMockContext();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('THE DEFECT: messages queued 9 s before the renderer is ready are all processed', async () => {
    const win = new TestWindow(ctx, 'slow-load', 'test');
    for (let i = 0; i < 5; i++) void win.updateContent(['`test', `sample ${i}`]);

    jest.advanceTimersByTime(9000); // a slow Pi window load
    await win.ready();

    expect(win.processed.map((p) => p[1])).toEqual(['sample 0', 'sample 1', 'sample 2', 'sample 3', 'sample 4']);
    expect(ctx.logger.forceLogMessage).not.toHaveBeenCalledWith(expect.stringContaining('dropped'));
  });

  it('a capacity drop is reported loudly, with the count taken after the drop', async () => {
    const win = new TestWindow(ctx, 'overflow', 'test');
    (win as any).messageQueue = new MessageQueue<any>(2, 0); // tiny cap stands in for 100k
    for (let i = 0; i < 3; i++) void win.updateContent(['`test', `sample ${i}`]);

    await win.ready();

    expect(win.processed.map((p) => p[1])).toEqual(['sample 1', 'sample 2']);
    expect(ctx.logger.forceLogMessage).toHaveBeenCalledWith(
      expect.stringContaining('dropped 1 message(s) received before it was ready')
    );
  });
});
