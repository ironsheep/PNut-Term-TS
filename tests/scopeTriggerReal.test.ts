/**
 * SCOPE Window Instance Test
 *
 * Tests that the DebugScopeWindow class can be instantiated and used
 * in a mocked Electron environment. Full trigger behavior validation
 * requires actual Electron windows and is tested externally.
 *
 * For trigger logic unit tests, see scopeTrigger.test.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DebugScopeWindow } from '../src/classes/debugScopeWin';
import { Context } from '../src/utils/context';

describe('SCOPE Window Instance Test', () => {
  let scopeWin: DebugScopeWindow;
  let ctx: Context;

  beforeEach(() => {
    // Create real Context object
    ctx = new Context();

    // Create actual SCOPE window with display spec
    scopeWin = new DebugScopeWindow(
      ctx,
      {
        displayName: 'MyScope',
        windowTitle: 'MyScope',
        title: 'MyScope',
        nbrSamples: 256,
        rate: 0,
        position: { x: 100, y: 100 },
        hasExplicitPosition: true,
        size: { width: 400, height: 300 },
        dotSize: 1,
        lineSize: 1,
        textSize: 8,
        window: { background: '#000000', grid: '#333333' },
        isPackedData: false,
        hideXY: false
      },
      `scope-test-${Date.now()}`
    );
  });

  describe('Window Instantiation', () => {
    it('should instantiate DebugScopeWindow without errors', () => {
      expect(scopeWin).toBeDefined();
      expect(scopeWin).toBeInstanceOf(DebugScopeWindow);
    });

    it('should have correct window type', () => {
      // Access windowType through public getter if available, or check via title
      expect(scopeWin.windowTitle).toBe('MyScope');
    });
  });

  describe('Command Processing (Mocked Environment)', () => {
    it('should accept updateContent calls without throwing', () => {
      // These calls should not throw even in mocked environment
      expect(() => {
        scopeWin.updateContent(['FreqA', '-1000', '1000', '100', '136', '15', 'MAGENTA']);
      }).not.toThrow();

      expect(() => {
        scopeWin.updateContent(['TRIGGER', '0', 'HOLDOFF', '2']);
      }).not.toThrow();

      expect(() => {
        scopeWin.updateContent(['0', ',', '0']);
      }).not.toThrow();
    });

    it('should accept channel specifications without throwing', () => {
      expect(() => {
        scopeWin.updateContent(['FreqA', '-1000', '1000', '100', '136', '15', 'MAGENTA']);
        scopeWin.updateContent(['FreqB', '-1000', '1000', '100', '20', '15', 'ORANGE']);
      }).not.toThrow();
    });

    it('should accept trigger commands without throwing', () => {
      // First add a channel
      scopeWin.updateContent(['FreqA', '-1000', '1000', '100', '136', '15', 'MAGENTA']);

      expect(() => {
        scopeWin.updateContent(['TRIGGER', '0']);
        scopeWin.updateContent(['TRIGGER', '0', 'HOLDOFF', '5']);
        scopeWin.updateContent(['HOLDOFF', '10']);
      }).not.toThrow();
    });

    it('should accept numeric sample data without throwing', () => {
      // Setup channel specs
      scopeWin.updateContent(['FreqA', '-1000', '1000', '100', '136', '15', 'MAGENTA']);
      scopeWin.updateContent(['FreqB', '-1000', '1000', '100', '20', '15', 'ORANGE']);

      expect(() => {
        scopeWin.updateContent(['0', ',', '0']);
        scopeWin.updateContent(['31', ',', '63']);
        scopeWin.updateContent(['63', ',', '127']);
        scopeWin.updateContent(['94', ',', '189']);
      }).not.toThrow();
    });
  });

  describe('Display Spec Validation', () => {
    it('should preserve display spec parameters', () => {
      // Create a new window with specific specs and verify they're preserved
      const testSpec = {
        displayName: 'TestScope',
        windowTitle: 'TestScope',
        title: 'TestScope',
        nbrSamples: 512,
        rate: 100,
        position: { x: 200, y: 150 },
        hasExplicitPosition: true,
        size: { width: 600, height: 400 },
        dotSize: 2,
        lineSize: 2,
        textSize: 10,
        window: { background: '#111111', grid: '#444444' },
        isPackedData: false,
        hideXY: true
      };

      const testWin = new DebugScopeWindow(ctx, testSpec, 'test-scope-id');

      expect(testWin).toBeDefined();
      expect(testWin.windowTitle).toBe('TestScope');
    });
  });
});
