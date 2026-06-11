/** @format */

// [9win §10] SCOPE_XY create-time configuration parity vs Pascal SCOPE_XY_Configure
// (DebugDisplayUnit.pas:1386) and KeyTwoPi (:2736). Drives the window's parseConfiguration
// directly on a mocked instance (the scopeXy instance harness is green/in-runner). Covers:
//   - SIZE clamps the DIAMETER (val*2) to scope_xy_wmin..wmax (32..2048), so radius input is
//     16..1024 — SIZE 1025 -> 1024, SIZE 10 -> 16, SIZE 100 -> 100.
//   - POLAR -1 sets twopi to -0x100000000 (angle-wrap reversed), 0 -> +0x100000000, else literal.
//   - channels saturate at Channels(=8); a 9th+ label overwrites the last slot, never grows past 8.
//   - default grid color is DefaultGridColor = clGray = 0x404040.

import { DebugScopeXyWindow, ScopeXyDisplaySpec } from '../src/classes/debugScopeXyWin';
import { ScopeXyRenderer } from '../src/classes/shared/scopeXyRenderer';
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
    ipcMain: { on: jest.fn(), handle: jest.fn(), removeHandler: jest.fn() }
  };
});

describe('[9win §10] SCOPE_XY config parity (parseConfiguration)', () => {
  let mockContext: any;
  let window: DebugScopeXyWindow;

  const spec = (): ScopeXyDisplaySpec => ({
    displayName: 'test-scope',
    title: 'Test Scope XY',
    hasExplicitPosition: false
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserWindowInstances = [];
    mockContext = setupDebugWindowTest().mockContext;
    window = new DebugScopeXyWindow(mockContext, spec());
  });

  afterEach(() => {
    if (window) {
      try {
        window.closeDebugWindow();
      } catch {
        /* ignore */
      }
    }
    cleanupDebugWindowTest();
    jest.clearAllMocks();
  });

  // parseConfiguration consumes lineParts from index 2 (after command + display name).
  const parse = (...directives: string[]): void => {
    (window as any).channels = [];
    (window as any).channelIndex = 0;
    (window as any).parseConfiguration(['`SCOPE_XY', 'test', ...directives]);
  };

  describe('SIZE clamps the diameter (val*2) -> radius input 16..1024 (Pascal :1404)', () => {
    it('SIZE 1025 -> radius 1024 (diameter 2050 clamps to 2048)', () => {
      parse('SIZE', '1025');
      expect((window as any).radius).toBe(1024);
    });
    it('SIZE 10 -> radius 16 (diameter 20 clamps up to 32)', () => {
      parse('SIZE', '10');
      expect((window as any).radius).toBe(16);
    });
    it('SIZE 100 -> radius 100 (in range, unchanged)', () => {
      parse('SIZE', '100');
      expect((window as any).radius).toBe(100);
    });
  });

  describe('POLAR twopi (Pascal KeyTwoPi :2736)', () => {
    it('POLAR -1 -> twopi -0x100000000 (reversed wrap, not literal -1)', () => {
      parse('POLAR', '-1');
      expect((window as any).polar).toBe(true);
      expect((window as any).twopi).toBe(-0x100000000);
    });
    it('POLAR 0 -> twopi +0x100000000 (default wrap)', () => {
      parse('POLAR', '0');
      expect((window as any).twopi).toBe(0x100000000);
    });
    it('POLAR 5000 -> twopi 5000 (literal)', () => {
      parse('POLAR', '5000');
      expect((window as any).twopi).toBe(5000);
    });
    it('POLAR with no argument -> polar enabled', () => {
      parse('POLAR');
      expect((window as any).polar).toBe(true);
    });
  });

  describe('channel cap at Channels=8 (Pascal :1431)', () => {
    it('10 labels -> exactly 8 channels, last slot holds the most recent', () => {
      parse("'A'", "'B'", "'C'", "'D'", "'E'", "'F'", "'G'", "'H'", "'I'", "'J'");
      const channels = (window as any).channels;
      expect(channels).toHaveLength(8);
      // Pascal overwrites vLabel[7] with the final ('J') definition.
      expect(channels[7].name).toBe('J');
    });
    it('8 labels -> 8 channels (boundary, all preserved)', () => {
      parse("'A'", "'B'", "'C'", "'D'", "'E'", "'F'", "'G'", "'H'");
      expect((window as any).channels).toHaveLength(8);
      expect((window as any).channels[7].name).toBe('H');
    });
  });

  describe('defaults match Pascal SCOPE_XY_Configure', () => {
    it('renderer default grid color is 0x404040 (DefaultGridColor = clGray), overridable', () => {
      const r = new ScopeXyRenderer();
      expect(r.getGridColor()).toBe(0x404040);
      r.setGridColor(0x123456);
      expect(r.getGridColor()).toBe(0x123456);
    });
  });

  // [#36 §2.3] parsing-parity: directive colors via the shared parseKeyColor (named colors
  // were lost on the old colorTranslator numeric-only path) and numeric directives via
  // clampInt/Spin2NumericParser (so $hex/%bin/underscores parse, and out-of-range CLAMPS
  // rather than aborting the window). Pascal SCOPE_XY_Configure (DebugDisplayUnit.pas:1386).
  describe('[#36] directive-color + numeric parsing parity', () => {
    it('COLOR RED -> background 0xff0909 (named directive color, was broken)', () => {
      parse('COLOR', 'RED');
      expect((window as any).backgroundColor).toBe(0xff0909);
    });

    it('COLOR RED BLUE -> background 0xff0909, grid 0x0909ff (both KeyColor)', () => {
      parse('COLOR', 'RED', 'BLUE');
      expect((window as any).backgroundColor).toBe(0xff0909);
      expect((window as any).gridColor).toBe(0x0909ff);
    });

    it('COLOR $FF8000 -> background 0xff8000 ($hex numeric, parseInt dropped to black before)', () => {
      parse('COLOR', '$FF8000');
      expect((window as any).backgroundColor).toBe(0xff8000);
    });

    it('SIZE $80 -> radius 128 (diameter $80*2 = 256, in range)', () => {
      parse('SIZE', '$80');
      expect((window as any).radius).toBe(128);
    });

    it('RANGE $7FFFFFFF -> range 0x7fffffff (hex max)', () => {
      parse('RANGE', '$7FFFFFFF');
      expect((window as any).range).toBe(0x7fffffff);
    });

    it('RANGE 1_000 -> range 1000 (underscore-grouped literal)', () => {
      parse('RANGE', '1_000');
      expect((window as any).range).toBe(1000);
    });

    it('DOTSIZE 1 -> 2 (clamp UP to min, never abort)', () => {
      parse('DOTSIZE', '1');
      expect((window as any).dotSize).toBe(2);
    });

    it('RATE 9999 -> 2048 (clamp DOWN to XY_Sets, not 512)', () => {
      parse('RATE', '9999');
      expect((window as any).rate).toBe(2048);
    });

    it('TEXTSIZE 999 -> 200 (clamp to KeyTextSize max)', () => {
      parse('TEXTSIZE', '999');
      expect((window as any).textSize).toBe(200);
    });

    it("channel 'A' RED -> channel color 0xff0909 (named color per channel)", () => {
      parse("'A'", 'RED');
      const channels = (window as any).channels;
      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('A');
      expect(channels[0].color).toBe(0xff0909);
    });

    it('bad param keeps default and still configures (DOTSIZE foo -> default 6, window intact)', () => {
      expect(() => parse('DOTSIZE', 'foo', 'RANGE', '500')).not.toThrow();
      // Bad DOTSIZE token leaves the default; the later RANGE 500 still parses (never aborted).
      expect((window as any).dotSize).toBe(6);
      expect((window as any).range).toBe(500);
    });
  });
});
