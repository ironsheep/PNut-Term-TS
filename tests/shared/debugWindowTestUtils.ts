/**
 * Reusable test utilities for debug window testing
 * 
 * These utilities encapsulate common patterns discovered during the Terminal Window
 * test refactoring and can be applied to other debug windows.
 */

import { jest } from '@jest/globals';
import { createMockBrowserWindow, createMockContext, setupDebugWindowTest, cleanupDebugWindowTest } from './mockHelpers';

/**
 * Test setup configuration for debug windows
 */
export interface DebugWindowTestConfig {
  windowType: 'logic' | 'scope' | 'plot' | 'bitmap' | 'midi' | 'term' | 'fft';
  displayName: string;
  mockExternalDependencies?: boolean;
  setupCanvas?: boolean;
}

/**
 * Standard test setup for debug windows
 * 
 * Usage:
 * ```typescript
 * const { mockContext, displaySpec, cleanup } = setupDebugWindowTests({
 *   windowType: 'term',
 *   displayName: 'TestTerm'
 * });
 * ```
 */
export function setupDebugWindowTests(config: DebugWindowTestConfig) {
  const testSetup = setupDebugWindowTest();
  const mockContext = testSetup.mockContext;
  
  // Track resources for cleanup
  const cleanupFns: (() => void)[] = [];
  const mockBrowserWindowInstances: any[] = [];
  
  // Standard cleanup function
  const cleanup = () => {
    // Clear all timers
    jest.clearAllTimers();
    
    // Run custom cleanup functions
    cleanupFns.forEach(fn => {
      try {
        fn();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    
    // Standard cleanup
    cleanupDebugWindowTest();
  };
  
  return {
    mockContext,
    mockBrowserWindowInstances,
    addCleanup: (fn: () => void) => cleanupFns.push(fn),
    cleanup
  };
}

/**
 * Helper to trigger window creation for debug windows
 * 
 * Most debug windows create their BrowserWindow on first display data.
 * This helper standardizes that pattern.
 */
export function triggerWindowCreation(debugWindow: any, displayName: string) {
  // Send a printable character to trigger window creation
  debugWindow.updateContent([displayName, '32']);
}

/**
 * Helper to set up command processing tests
 * 
 * Usage:
 * ```typescript
 * testCommand(debugWindow, 'Test', '65', () => {
 *   expect(debugWindow['cursorPosition'].x).toBe(1);
 * });
 * ```
 */
export function testCommand(
  debugWindow: any,
  displayName: string,
  command: string | string[],
  assertion: () => void
) {
  const commands = Array.isArray(command) ? command : [command];
  debugWindow.updateContent([displayName, ...commands]);
  assertion();
}

/**
 * Helper to test numeric action commands
 */
export function testNumericAction(
  debugWindow: any,
  displayName: string,
  action: number,
  expectedState: any
) {
  debugWindow.updateContent([displayName, String(action)]);
  
  // Check expected state changes
  Object.entries(expectedState).forEach(([key, value]) => {
    expect(debugWindow[key]).toEqual(value);
  });
}

/**
 * Mock strategy notes for debug windows
 * 
 * This documents the lessons learned about what to mock vs what to let run.
 * 
 * Mock only external dependencies:
 * - Electron (BrowserWindow, app, nativeImage)
 * - File system (fs)
 * - USB serial communication
 * 
 * DO NOT mock internal modules - let them run!
 * - canvasRenderer
 * - displaySpecParser
 * - colorTranslator
 * - inputForwarder (except USB)
 * - debugColor
 * - packedDataProcessor
 * - triggerProcessor
 * 
 * Each test file should set up its own mocks at the top level,
 * not inside functions, to avoid hoisting issues.
 */

/**
 * Standard test patterns for debug windows
 */
export const DebugWindowTestPatterns = {
  /**
   * Test window creation on first display data
   */
  windowCreation: (windowClass: any, displaySpec: any) => {
    it('should create debug window on first display data', () => {
      const { mockContext, mockBrowserWindowInstances, cleanup } = setupDebugWindowTests({
        windowType: displaySpec.type,
        displayName: displaySpec.displayName
      });
      
      const window = new windowClass(mockContext, displaySpec);
      triggerWindowCreation(window, displaySpec.displayName);
      
      expect(mockBrowserWindowInstances.length).toBe(1);
      
      cleanup();
    });
  },
  
  /**
   * Test command processing
   */
  commandProcessing: (windowClass: any, displaySpec: any, commands: Array<{cmd: string, test: () => void}>) => {
    describe('Command processing', () => {
      let window: any;
      let setup: any;
      
      beforeEach(() => {
        setup = setupDebugWindowTests({
          windowType: displaySpec.type,
          displayName: displaySpec.displayName
        });
        window = new windowClass(setup.mockContext, displaySpec);
        triggerWindowCreation(window, displaySpec.displayName);
      });
      
      afterEach(() => {
        setup.cleanup();
      });
      
      commands.forEach(({ cmd, test }) => {
        it(`should process ${cmd} command`, () => {
          testCommand(window, displaySpec.displayName, cmd, test);
        });
      });
    });
  }
};

/**
 * Example usage for other debug windows:
 * 
 * ```typescript
 * // In debugLogicWin.test.ts
 * import { setupDebugWindowTests, triggerWindowCreation, testCommand } from './shared/debugWindowTestUtils';
 * 
 * describe('DebugLogicWindow', () => {
 *   const { mockContext, cleanup } = setupDebugWindowTests({
 *     windowType: 'logic',
 *     displayName: 'TestLogic'
 *   });
 *   
 *   const logicWindow = new DebugLogicWindow(mockContext, displaySpec);
 *   
 *   afterEach(cleanup);
 *   
 *   it('should handle channel data', () => {
 *     triggerWindowCreation(logicWindow, 'TestLogic');
 *     testCommand(logicWindow, 'TestLogic', ['CHANNEL', '0', '1'], () => {
 *       expect(logicWindow.channels[0].value).toBe(1);
 *     });
 *   });
 * });
 * ```
 */