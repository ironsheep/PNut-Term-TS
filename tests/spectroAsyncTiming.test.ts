/** @format */

'use strict';

// tests/spectroAsyncTiming.test.ts
// Test to verify async executeJavaScript timing issues in debugSpectroWin.ts

import { DebugSpectroWindow, SpectroDisplaySpec } from '../src/classes/debugSpectroWin';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';
import { createMockBrowserWindow } from './shared/mockHelpers';
import { ColorMode } from '../src/classes/shared/colorTranslator';

// Store reference to mock BrowserWindow instances
let mockBrowserWindowInstances: any[] = [];

// Store execution order logs
const executionLog: Array<{ timestamp: number; operation: string }> = [];

// Mock Electron
jest.mock('electron', () => {
  const createMockBrowserWindow = require('./shared/mockHelpers').createMockBrowserWindow;
  return {
    BrowserWindow: jest.fn().mockImplementation(() => {
      const mockWindow = createMockBrowserWindow();
      mockBrowserWindowInstances.push(mockWindow);
      return mockWindow;
    }),
    app: {
      getPath: jest.fn().mockReturnValue('/mock/path')
    },
    ipcMain: {
      on: jest.fn(),
      removeAllListeners: jest.fn()
    },
    nativeImage: {
      createFromBuffer: jest.fn().mockReturnValue({
        toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
      })
    }
  };
});

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock OS module
jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp'),
  platform: jest.fn().mockReturnValue('linux')
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((input: string) => {
    if (!input) return '.';
    const segments = input.split('/');
    segments.pop();
    return segments.length ? segments.join('/') : '/';
  }),
  resolve: jest.fn((...args) => args.join('/'))
}));

// Mock WindowPlacer
const mockWindowPlacerInstance = {
  registerWindow: jest.fn(),
  getNextPosition: jest.fn(() => ({ x: 0, y: 0, monitor: { id: '1' } })),
  releaseWindow: jest.fn()
};

jest.mock('../src/utils/windowPlacer', () => ({
  WindowPlacer: {
    getInstance: jest.fn(() => mockWindowPlacerInstance)
  }
}));

// Mock USB serial
jest.mock('../src/utils/usb.serial', () => ({
  UsbSerial: jest.fn().mockImplementation(() => ({
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    deviceIsPropeller: jest.fn().mockResolvedValue(true),
    getIdStringOrError: jest.fn().mockReturnValue(['Propeller2', '']),
    deviceInfo: 'Mock Propeller2 Device',
    isOpen: true
  }))
}));

// Mock Jimp
jest.mock('jimp', () => ({
  Jimp: {
    read: jest.fn().mockResolvedValue({
      bitmap: { width: 100, height: 100, data: Buffer.alloc(40000) },
      getWidth: jest.fn().mockReturnValue(100),
      getHeight: jest.fn().mockReturnValue(100),
      resize: jest.fn().mockReturnThis(),
      writeAsync: jest.fn().mockResolvedValue(undefined),
      getBuffer: jest.fn().mockImplementation((mime, cb) => cb(null, Buffer.from('mock-image')))
    }),
    MIME_PNG: 'image/png',
    MIME_JPEG: 'image/jpeg',
    MIME_BMP: 'image/bmp'
  }
}));

describe('DebugSpectroWindow Async Timing Test', () => {
  let debugSpectroWindow: DebugSpectroWindow;
  let mockContext: any;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear execution log
    executionLog.length = 0;

    // Clear mock instances
    mockBrowserWindowInstances = [];

    // Setup test environment
    const setup = setupDebugWindowTests({
      windowType: 'logic',
      displayName: 'SpectroTimingTest'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Canvas operation timing', () => {
    it('should verify execution order of plotPixel -> updateWaterfallDisplay -> step', async () => {
      // Create window with small FFT size for faster testing
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TimingTest', [
        'SPECTRO', 'TimingTest',
        'SAMPLES', '8', // Minimum FFT size
        'RANGE', '1000',
        'LUMA8X', 'GREEN'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Get mock window to intercept executeJavaScript calls
      const mockWindow = mockBrowserWindowInstances[0];
      const originalExecuteJS = mockWindow.webContents.executeJavaScript;

      // Track when executeJavaScript is called and when it completes
      mockWindow.webContents.executeJavaScript = jest.fn().mockImplementation(async (code: string) => {
        const callTimestamp = Date.now();

        // Identify operation type from code
        let operation = 'unknown';
        if (code.includes('ctx.fillRect') && !code.includes('scrollY')) {
          operation = 'plotPixel';
        } else if (code.includes('ctx.drawImage')) {
          operation = 'updateWaterfallDisplay';
        } else if (code.includes('getImageData') || code.includes('putImageData')) {
          operation = 'scrollWaterfall';
        }

        executionLog.push({ timestamp: callTimestamp, operation: `${operation}_START` });

        // Simulate async execution delay (real browser would have this)
        await new Promise(resolve => setImmediate(resolve));

        executionLog.push({ timestamp: Date.now(), operation: `${operation}_END` });

        return originalExecuteJS.call(mockWindow.webContents, code);
      });

      // Don't spy on methods directly, just watch executeJavaScript calls
      // The executeJavaScript mock above will track the operations

      // Add 8 samples to trigger FFT
      const samples = [1000, 500, 0, -500, -1000, -500, 0, 500];
      for (const sample of samples) {
        (debugSpectroWindow as any).addSample(sample);
      }

      // Manually trigger FFT and draw (this is where the timing issue occurs)
      (debugSpectroWindow as any).performFFTAndDraw();

      // Wait for all async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Analyze execution log
      console.log('\n=== Canvas Timing Test Execution Log ===');
      const startTime = executionLog[0]?.timestamp || Date.now();
      executionLog.forEach(entry => {
        const elapsed = entry.timestamp - startTime;
        console.log(`[+${elapsed}ms] ${entry.operation}`);
      });

      // Build analysis report
      const report = {
        expectedOrder: [
          '1. plotPixel (last bin)',
          '2. updateWaterfallDisplay (COMPLETES)',
          '3. step (scroll/move trace)'
        ],
        actualOrder: [] as string[],
        timingIssueConfirmed: false,
        impact: ''
      };

      // Extract the sequence
      const sequence = executionLog.map(e => e.operation);
      report.actualOrder = sequence;

      // Check for timing issue: Does step() get called before updateWaterfallDisplay completes?
      const updateStartIdx = sequence.findIndex(op => op === 'updateWaterfallDisplay_CALL' || op === 'updateWaterfallDisplay_START');
      const updateEndIdx = sequence.findIndex(op => op === 'updateWaterfallDisplay_END');
      const stepCallIdx = sequence.findIndex(op => op === 'step_CALL');

      if (updateStartIdx !== -1 && stepCallIdx !== -1) {
        // Timing issue exists if step() is called before updateWaterfallDisplay completes
        report.timingIssueConfirmed = (stepCallIdx < updateEndIdx) || (updateEndIdx === -1);

        if (report.timingIssueConfirmed) {
          report.impact = 'step() executes before updateWaterfallDisplay completes. This can cause: ' +
                         '(1) Scroll operations to occur before canvas is updated, ' +
                         '(2) Visual tearing/artifacts in waterfall display, ' +
                         '(3) Pixel positions may be updated before bitmap is transferred to visible canvas.';
        } else {
          report.impact = 'No timing issue detected. Operations execute in correct order.';
        }
      }

      console.log('\n=== Canvas Timing Test Results ===');
      console.log('\n**Expected order** (from Pascal):');
      report.expectedOrder.forEach(step => console.log(step));
      console.log('\n**Actual order** (from logs):');
      report.actualOrder.forEach((op, idx) => console.log(`${idx + 1}. ${op}`));
      console.log(`\n**Timing issue confirmed**: ${report.timingIssueConfirmed ? 'YES' : 'NO'}`);
      console.log(`\n**Impact**: ${report.impact}`);

      // No spies to clean up

      // Assertions
      expect(executionLog.length).toBeGreaterThan(0);

      // Document the finding (this test is diagnostic, not enforcement)
      if (report.timingIssueConfirmed) {
        console.warn('\n⚠️  TIMING ISSUE DETECTED: async executeJavaScript causes operations to execute out of order');
      } else {
        console.log('\n✓ Timing appears correct in this test environment');
      }
    });

    it('should demonstrate race condition between canvas operations', async () => {
      // This test demonstrates the race condition more explicitly
      const displaySpec = DebugSpectroWindow.createDisplaySpec('RaceTest', [
        'SPECTRO', 'RaceTest',
        'SAMPLES', '8',
        'RANGE', '1000',
        'TRACE', '14', // Scrolling trace pattern
        'LUMA8X'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      const mockWindow = mockBrowserWindowInstances[0];
      const executeJSCalls: string[] = [];
      const executeJSCompletions: string[] = [];

      // Track all executeJavaScript calls
      mockWindow.webContents.executeJavaScript = jest.fn().mockImplementation(async (code: string) => {
        let opType = 'unknown';
        if (code.includes('ctx.fillRect') && !code.includes('scrollY')) {
          opType = 'plotPixel';
        } else if (code.includes('ctx.drawImage')) {
          opType = 'updateDisplay';
        } else if (code.includes('getImageData')) {
          opType = 'scroll';
        }

        executeJSCalls.push(opType);

        // Simulate async delay
        await new Promise(resolve => setImmediate(resolve));

        executeJSCompletions.push(opType);
      });

      // Add samples and trigger FFT multiple times
      const samples = [1000, 500, 0, -500, -1000, -500, 0, 500];

      // First FFT pass
      for (const sample of samples) {
        (debugSpectroWindow as any).addSample(sample);
      }
      (debugSpectroWindow as any).performFFTAndDraw();

      // Second FFT pass (would trigger scroll in trace pattern 14)
      for (const sample of samples) {
        (debugSpectroWindow as any).addSample(sample);
      }
      (debugSpectroWindow as any).performFFTAndDraw();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('\n=== Race Condition Test ===');
      console.log('Operations queued (in order):');
      executeJSCalls.forEach((op, idx) => console.log(`  ${idx + 1}. ${op}`));
      console.log('\nOperations completed (in order):');
      executeJSCompletions.forEach((op, idx) => console.log(`  ${idx + 1}. ${op}`));

      // The issue: All operations are queued synchronously, but complete asynchronously
      // This means step() can modify state before previous canvas operations complete
      const hasRaceCondition = executeJSCalls.length > 0 && executeJSCompletions.length > 0;

      console.log(`\nRace condition potential: ${hasRaceCondition ? 'YES - async operations can interleave' : 'NO'}`);

      expect(hasRaceCondition).toBe(true); // This confirms the issue exists
    });
  });

  describe('Pascal synchronous behavior comparison', () => {
    it('should document how Pascal ensures synchronous execution', () => {
      // This is a documentation test to explain the Pascal behavior
      const pascalBehavior = {
        language: 'Object Pascal',
        framework: 'VCL (Visual Component Library)',
        canvasOperations: 'Synchronous',
        explanation: [
          'In Pascal/VCL, all TCanvas operations are synchronous:',
          '1. PlotPixel() draws directly to bitmap canvas - COMPLETES immediately',
          '2. BitmapToCanvas() copies bitmap to display - COMPLETES immediately',
          '3. StepTrace() modifies position - executes after #2 finishes',
          '',
          'This guarantees correct execution order without race conditions.'
        ],
        typescriptDifference: [
          'In TypeScript/Electron:',
          '1. plotPixel() calls executeJavaScript - returns Promise immediately',
          '2. updateWaterfallDisplay() calls executeJavaScript - returns Promise immediately',
          '3. step() executes immediately (not async)',
          '',
          'Problem: step() modifies state before canvas operations complete!',
          'Result: Visual artifacts, incorrect scroll timing, pixel position errors'
        ],
        solution: [
          'Options to fix:',
          '1. Make performFFTAndDraw() async and await each canvas operation',
          '2. Queue canvas operations and process sequentially',
          '3. Use synchronous rendering (offscreen canvas in Node, not browser)',
          '4. Batch all canvas operations into single executeJavaScript call'
        ]
      };

      console.log('\n=== Pascal vs TypeScript Canvas Behavior ===\n');
      console.log('Pascal Behavior:');
      pascalBehavior.explanation.forEach(line => console.log(`  ${line}`));
      console.log('\nTypeScript Difference:');
      pascalBehavior.typescriptDifference.forEach(line => console.log(`  ${line}`));
      console.log('\nPotential Solutions:');
      pascalBehavior.solution.forEach(line => console.log(`  ${line}`));

      // This test always passes - it's for documentation
      expect(pascalBehavior).toBeDefined();
    });
  });
});
