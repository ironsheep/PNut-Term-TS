/** @format */

// tests/loggerAutoScrollTail.test.ts
//
// Regression cover for the end-of-run tail defect: when a run finished, the log
// window was left scrolled short of the bottom, so the last lines of the run were
// off-screen.
//
// ROOT CAUSE (two halves, both covered here):
//   1. `#output` carried `scroll-behavior: smooth`, which turns the autoscroll's
//      `scrollTop = scrollHeight` into an ANIMATED scroll. The animation emits
//      intermediate `scroll` events at positions short of the bottom.
//   2. The `scroll` listener reads position only — it cannot tell our own scroll
//      from the user's — so those intermediate events matched "user scrolled up",
//      cleared `autoScroll`, and dropped the window out of live mode. Nothing
//      re-arms it but the user, so the tail stopped following for the rest of the
//      run and the final lines were never scrolled into view.
//
// These tests execute the ACTUAL renderer script emitted by generateHTML() — not a
// reimplementation of its state machine — so they track the shipped code.
//
// COVERAGE NOTE, stated rather than implied: jsdom has no layout engine and no
// smooth-scroll animation, so half (1) cannot be exercised behaviorally. It is
// asserted at the source level instead. Half (2) — the latch, which is what makes
// the window robust against ANY spurious scroll event, including the ones DOM
// trimming produces — is covered behaviorally below, and is the assertion that
// fails against the pre-fix code.

import { LoggerWindow } from '../src/classes/loggerWin';
import { LoggerCOGWindow } from '../src/classes/loggerCOGWin';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  screen: {
    getAllDisplays: jest.fn(),
    getPrimaryDisplay: jest.fn(() => ({ workAreaSize: { width: 1920, height: 1080 } }))
  },
  ipcMain: { on: jest.fn(), removeListener: jest.fn() }
}));

const THEME = { backgroundColor: '#000000', foregroundColor: '#FFFFFF' };

/** Render the real HTML for each window without standing up the whole class. */
function loggerHtml(): string {
  return (LoggerWindow.prototype as any)['generateHTML'].call({ theme: THEME });
}
function cogHtml(): string {
  return (LoggerCOGWindow.prototype as any)['generateHTML'].call({
    theme: THEME,
    colorTheme: THEME,
    cogId: 0
  });
}

const LINE_PX = 20;
const VIEWPORT_PX = 300;
// The main log window trims to the user's scrollback preference, which starts at the
// documented default (context.ts: 1000). The per-COG windows have no such preference
// and keep their own fixed cap.
const LOGGER_SCROLLBACK_DEFAULT = 1000;
const COG_CAP = 1500;

interface Harness {
  /**
   * Deliver `count` lines and let them reach the DOM. On return the invariant is the
   * same for both windows: lines are painted, the autoscroll has run, and the
   * programmatic-scroll latch is still HELD (its release is queued for the next frame).
   */
  append(count: number): void;
  /** Dispatch a scroll event with the viewport parked at `top`. */
  userScrollTo(top: number): void;
  /** Deliver an arbitrary IPC message to the renderer (preferences, clear, …). */
  ipc(channel: string, payload: any): void;
  /**
   * Invoke the shutdown-path inline paint. Returns the line count it reports, or
   * null for a window that exposes no such hook (the per-COG windows paint on
   * receipt, so they have nothing to flush).
   */
  flushPaint(): number | null;
  /** Drain queued animation frames — the browser catching up once the stream idles. */
  settle(): void;
  scrollTop(): number;
  maxScrollTop(): number;
  atBottom(): boolean;
  /** The live/history indicator, or null for windows that have no such UI. */
  mode(): 'live' | 'history' | null;
  lineCount(): number;
}

/**
 * Load a window's real renderer script into jsdom and give #output the geometry jsdom
 * will not compute on its own (it has no layout engine: scrollHeight and clientHeight
 * are otherwise 0, which would make every position "at the bottom" and every assertion
 * below vacuous).
 *
 * `paintsOnFrame` distinguishes the two windows' delivery models: the main log window
 * buffers an IPC batch and paints it in a requestAnimationFrame callback, while the
 * per-COG window appends synchronously on receipt. Absorbing that difference here is
 * what lets one suite assert the same invariants against both.
 */
function mount(
  html: string,
  send: (dispatch: (channel: string, payload: any) => void, count: number) => void,
  paintsOnFrame: boolean
): Harness {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  if (!bodyMatch) throw new Error('generateHTML() produced no <body> — harness assumption broken');
  const scriptMatch = bodyMatch[1].match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('generateHTML() produced no <script> — harness assumption broken');

  document.body.innerHTML = bodyMatch[1].replace(/<script>[\s\S]*?<\/script>/, '');

  // jsdom hands every mount in this file the SAME window object, so a hook installed
  // by a previous mount would still be there — closed over that mount's dead #output —
  // and answer for this one. Clear it before loading the script.
  delete (globalThis as any).window.__flushPaint;

  const output = document.getElementById('output');
  if (!output) throw new Error('generateHTML() produced no #output — harness assumption broken');

  let stored = 0;
  const scrollHeight = () => Math.max(VIEWPORT_PX, output.children.length * LINE_PX);
  const maxScrollTop = () => Math.max(0, scrollHeight() - VIEWPORT_PX);

  Object.defineProperty(output, 'clientHeight', { get: () => VIEWPORT_PX, configurable: true });
  Object.defineProperty(output, 'scrollHeight', { get: scrollHeight, configurable: true });
  Object.defineProperty(output, 'scrollTop', {
    // A real scroller clamps on BOTH sides of the property, and both matter here:
    // writing `scrollHeight` must land at scrollHeight - clientHeight ("the bottom"),
    // and trimming lines off the top must pull a too-large stored value back down
    // rather than leaving the element reporting a position that no longer exists.
    get: () => Math.min(stored, maxScrollTop()),
    set: (v: number) => {
      stored = Math.max(0, Math.min(v, maxScrollTop()));
    },
    configurable: true
  });

  // Animation frames are driven manually so a test can observe the window mid-flight,
  // while the latch is still held.
  let frames: FrameRequestCallback[] = [];
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => frames.push(cb);
  (globalThis as any).cancelAnimationFrame = () => undefined;

  /** Run exactly one tick. Frames scheduled from within it belong to the next tick. */
  const tick = () => {
    const due = frames;
    frames = [];
    for (const cb of due) cb(0);
  };

  const handlers = new Map<string, (event: unknown, payload: any) => void>();
  const requireStub = (mod: string) => {
    if (mod !== 'electron') throw new Error(`unexpected require('${mod}') in renderer script`);
    return {
      ipcRenderer: {
        on: (channel: string, cb: (event: unknown, payload: any) => void) => handlers.set(channel, cb),
        send: () => undefined,
        invoke: async () => ({ success: false })
      }
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('require', scriptMatch[1])(requireStub);

  const dispatch = (channel: string, payload: any) => {
    const cb = handlers.get(channel);
    if (!cb) throw new Error(`renderer never registered '${channel}' — has: ${[...handlers.keys()].join(', ')}`);
    cb({}, payload);
  };

  return {
    append: (count: number) => {
      send(dispatch, count);
      if (paintsOnFrame) tick(); // run paintFrame; its latch-release lands on the next tick
    },
    userScrollTo: (top: number) => {
      stored = Math.max(0, Math.min(top, maxScrollTop()));
      output.dispatchEvent(new Event('scroll'));
    },
    ipc: (channel: string, payload: any) => dispatch(channel, payload),
    flushPaint: () => {
      const hook = (globalThis as any).window?.__flushPaint;
      return typeof hook === 'function' ? hook() : null;
    },
    settle: () => {
      // Bounded: a runaway self-rescheduling frame should fail the test, not hang it.
      for (let i = 0; i < 20 && frames.length > 0; i++) tick();
      if (frames.length > 0) throw new Error('animation frames never settled');
    },
    scrollTop: () => Math.min(stored, maxScrollTop()),
    maxScrollTop,
    atBottom: () => Math.min(stored, maxScrollTop()) === maxScrollTop(),
    mode: () => {
      const text = document.getElementById('mode-indicator')?.textContent;
      if (text === undefined || text === null || text === '') return null;
      return text.includes('History') ? 'history' : 'live';
    },
    lineCount: () => output.children.length
  };
}

function mountLogger(): Harness {
  return mount(
    loggerHtml(),
    (dispatch, count) =>
      dispatch(
        'append-messages-batch',
        Array.from({ length: count }, (_, i) => ({ message: `line ${i}`, type: 'cog-message', timestamp: '' }))
      ),
    true
  );
}

function mountCog(): Harness {
  return mount(
    cogHtml(),
    (dispatch, count) =>
      dispatch(
        'cog-0-messages-batch',
        Array.from({ length: count }, (_, i) => ({ message: `line ${i}`, className: 'cog-message', timestamp: '' }))
      ),
    false
  );
}

/** Assert follow state through the indicator when the window has one. */
function expectMode(h: Harness, expected: 'live' | 'history'): void {
  const actual = h.mode();
  if (actual !== null) expect(actual).toBe(expected);
}

describe('log window autoscroll — the end-of-run tail', () => {
  describe('source: the animated-scroll half of the cause', () => {
    // Not behavioral: jsdom runs no smooth-scroll animation, so the only honest
    // assertion is that the property is gone from the shipped stylesheet.
    it.each([
      ['main log window', loggerHtml],
      ['per-COG log window', cogHtml]
    ])('%s does not animate #output scrolling', (_name, html) => {
      const rule = html().match(/#output\s*\{[\s\S]*?\}/);
      expect(rule).not.toBeNull();
      // Strip CSS comments first: the rule carries a note explaining why the property
      // is absent, and matching raw text would read that explanation as the property.
      const declarations = rule![0].replace(/\/\*[\s\S]*?\*\//g, '');
      expect(declarations).not.toMatch(/scroll-behavior\s*:\s*smooth/);
    });
  });

  // The scrollback preference was INERT: the renderer stored it in
  // `maxScrollbackLines` and read it nowhere, while a hardcoded 1500 did the actual
  // trimming. These assert it now governs, which is the whole point of the setting.
  describe('scrollback preference governs how far back you can scroll', () => {
    let h: Harness;

    beforeEach(() => {
      h = mountLogger();
    });

    // NORMAL — a raised setting keeps more history than the old fixed cap allowed.
    it('keeps more lines when raised above the default', () => {
      h.ipc('set-scrollback-lines', 3000);
      h.append(2500);
      h.settle();

      expect(h.lineCount()).toBe(2500);
      expect(h.atBottom()).toBe(true);
    });

    // NORMAL — a lowered setting keeps fewer.
    it('keeps fewer lines when lowered', () => {
      h.ipc('set-scrollback-lines', 200);
      h.append(1000);
      h.settle();

      expect(h.lineCount()).toBe(200);
    });

    // ERROR — the pre-fix behavior: the setting is ignored and the fixed cap wins.
    it('is not overridden by a hardcoded cap', () => {
      h.ipc('set-scrollback-lines', 2000);
      h.append(1800);
      h.settle();

      expect(h.lineCount()).toBe(1800); // 1500 here would mean the old cap still rules
    });

    // NORMAL — lowering it takes effect on what is already displayed, rather than
    // waiting for new traffic to enforce it.
    it('trims what is already on screen when lowered', () => {
      h.append(900);
      h.settle();
      expect(h.lineCount()).toBe(900);

      h.ipc('set-scrollback-lines', 300);
      h.settle();

      expect(h.lineCount()).toBe(300);
      expect(h.atBottom()).toBe(true); // still following after the content shrank
    });

    // EDGE — the low end of the clamp, matching the dialog's 100..10000 range.
    // Only the low end is asserted here: the high end would need 10,200 lines
    // materialized in jsdom, which costs ~40s of suite time to prove a Math.min.
    // The upper clamp is covered where it is cheap and equally real — against the
    // main process in loggerShutdownFlush.test.ts ("clamps 999999 to 10000").
    it('clamps a too-small setting up to 100', () => {
      h.ipc('set-scrollback-lines', 10);
      h.append(300);
      h.settle();

      expect(h.lineCount()).toBe(100);
    });
  });

  describe.each([
    ['main log window', mountLogger, LOGGER_SCROLLBACK_DEFAULT],
    ['per-COG log window', mountCog, COG_CAP]
  ])('%s', (_name, mountWindow, cap) => {
    let h: Harness;

    beforeEach(() => {
      h = mountWindow();
    });

    // NORMAL — the reported symptom, end to end: run emits, run stops, tail visible.
    it('ends a run parked at the bottom, with the last line reachable', () => {
      h.append(200);
      h.settle();

      expect(h.lineCount()).toBe(200);
      expect(h.atBottom()).toBe(true);
      expect(h.scrollTop()).toBe(h.maxScrollTop());
      expectMode(h, 'live');
    });

    // ERROR — the exact regression. An intermediate scroll event, arriving short of
    // the bottom while our own scroll is still in flight, is precisely what the
    // smooth-scroll animation produced. It must not be read as user intent.
    // Against the pre-fix code this drops to history mode and never recovers.
    it('keeps following the tail when a scroll event lands short of the bottom mid-scroll', () => {
      h.append(100);
      expect(h.atBottom()).toBe(true); // the autoscroll has run; latch still held

      h.userScrollTo(0); // an animation frame of our own scroll, not the user
      expectMode(h, 'live');

      h.settle();
      h.append(100);
      h.settle();

      expect(h.atBottom()).toBe(true);
      expectMode(h, 'live');
    });

    // NORMAL — the feature the latch must not disable.
    it('still drops out of live mode when the user genuinely scrolls up', () => {
      h.append(100);
      h.settle(); // latch released — what follows is the user's own scroll

      h.userScrollTo(0);
      expectMode(h, 'history');

      const parked = h.scrollTop();
      h.append(100);
      h.settle();

      expect(h.scrollTop()).toBe(parked); // history mode does not yank the view back
      expect(h.atBottom()).toBe(false);
    });

    // NORMAL — and following resumes when the user returns to the bottom.
    it('resumes following when the user scrolls back to the bottom', () => {
      h.append(100);
      h.settle();
      h.userScrollTo(0);
      expectMode(h, 'history');

      h.userScrollTo(h.maxScrollTop());
      expectMode(h, 'live');

      h.append(50);
      h.settle();
      expect(h.atBottom()).toBe(true);
    });

    // EDGE — a burst past the DOM cap. Trimming from the top shrinks the scroll
    // extent, which is its own source of spurious scroll events; the tail must
    // still be pinned once the stream stops.
    it('stays pinned across a burst that trims the DOM cap', () => {
      h.append(cap);
      h.settle();
      h.append(600);
      h.settle();

      expect(h.lineCount()).toBe(cap); // trimmed back to the cap, not merely bounded
      expect(h.atBottom()).toBe(true);
      expectMode(h, 'live');
    });

    // EDGE — the tail must still be reachable after a shutdown-path inline paint,
    // which bypasses the animation frame entirely.
    it('paints and stays pinned when flushed inline at shutdown', () => {
      h.append(80);
      h.settle();
      const painted = h.flushPaint();

      if (painted !== null) {
        expect(painted).toBe(h.lineCount());
        expect(h.atBottom()).toBe(true);
      }
    });

    // EDGE — an idle stream must not disturb a user who scrolled back to read.
    it('leaves a parked user alone when no further lines arrive', () => {
      h.append(300);
      h.settle();
      h.userScrollTo(100);
      const parked = h.scrollTop();

      h.settle();
      h.settle();

      expect(h.scrollTop()).toBe(parked);
      expectMode(h, 'history');
    });
  });
});
