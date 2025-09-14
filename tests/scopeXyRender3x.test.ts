import { DebugScopeXyWindow } from '../src/classes/debugScopeXyWin';
import { ScopeXyDisplaySpec } from '../src/classes/shared/displaySpecParser';
import { Context } from '../src/classes/shared/context';
import { BrowserWindow } from 'electron';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn().mockResolvedValue(true),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue('success'),
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn()
    },
    on: jest.fn(),
    once: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    setTitle: jest.fn(),
    setBounds: jest.fn(),
    show: jest.fn(),
    focus: jest.fn()
  })),
  ipcMain: {
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn()
  }
}));

// Mock context
const mockContext: Context = {
  windowRouter: {
    registerWindow: jest.fn(),
    unregisterWindow: jest.fn(),
    logMessage: jest.fn()
  },
  debuggerDataManager: {
    on: jest.fn(),
    removeListener: jest.fn()
  },
  mainWindow: {
    webContents: {
      send: jest.fn()
    }
  }
} as any;

describe('ScopeXY 3x Render Bug Investigation', () => {
  let scopeXyWin: DebugScopeXyWindow;
  let mockWindow: any;
  let renderCallCount: number;
  let handleDataLog: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    renderCallCount = 0;
    handleDataLog = [];

    // Create display spec for LINEAR_XY mode with 3 channels
    const displaySpec: ScopeXyDisplaySpec = {
      type: 'SCOPE_XY',
      x: 800,
      y: 600,
      radius: 128,
      dotSize: 1,
      samples: 0,  // Infinite persistence
      rate: 1,     // Render every sample
      mode: 'LINEAR_XY',
      scale: 1,
      range: 1,
      twopi: 0,
      theta: 0,
      sparse: 0,
      channelIndex: 3,  // RGB - 3 channels
      channelColor: 0,
      packedDataMode: 0,
      title: 'SCOPE_XY Test'
    };

    // Create instance
    scopeXyWin = new DebugScopeXyWindow(mockContext, displaySpec);

    // Get the mock window instance
    mockWindow = (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mock.instances[0];

    // Spy on render method to count calls
    const originalRender = scopeXyWin['render'];
    scopeXyWin['render'] = jest.fn((...args) => {
      renderCallCount++;
      console.log(`Render called #${renderCallCount}`);
      // Don't call original as it would try to execute JavaScript
      return Promise.resolve();
    });

    // Spy on logMessage to capture diagnostic output
    scopeXyWin['logMessage'] = jest.fn((msg: string) => {
      handleDataLog.push(msg);
      console.log(`LOG: ${msg}`);
    });
  });

  describe('Data accumulation and render frequency', () => {
    it('should render ONCE per complete RGB sample set (6 values)', () => {
      // Send exactly 6 values (one complete RGB sample: Rx,Ry,Gx,Gy,Bx,By)
      const testData = '100 150 200 250 50 75';

      console.log('Sending 6 values for one RGB sample...');
      scopeXyWin['handleData'](testData);

      expect(renderCallCount).toBe(1);
      console.log('✓ Rendered exactly once for 6 values');

      // Check logs for debugging
      const renderLogs = handleDataLog.filter(log => log.includes('Calling render'));
      expect(renderLogs.length).toBe(1);
      if (renderLogs.length > 0) {
        console.log('Render log:', renderLogs[0]);
      }
    });

    it('should render THREE times when receiving 18 values at once', () => {
      // Send 18 values (3 complete RGB samples)
      const testData = '100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95';

      console.log('Sending 18 values (3 RGB samples)...');
      scopeXyWin['handleData'](testData);

      expect(renderCallCount).toBe(3);
      console.log('✓ Rendered 3 times for 18 values - THIS IS THE BUG!');

      // Analyze the pattern
      const renderLogs = handleDataLog.filter(log => log.includes('Calling render'));
      renderLogs.forEach((log, i) => {
        console.log(`Render #${i+1}: ${log}`);
      });
    });

    it('should render ONCE when receiving 6 values multiple times with rate=3', () => {
      // Create display spec with rate=3
      const displaySpec: ScopeXyDisplaySpec = {
        type: 'SCOPE_XY',
        x: 800,
        y: 600,
        radius: 128,
        dotSize: 1,
        samples: 0,
        rate: 3,     // Render every 3rd sample
        mode: 'LINEAR_XY',
        scale: 1,
        range: 1,
        twopi: 0,
        theta: 0,
        sparse: 0,
        channelIndex: 3,
        channelColor: 0,
        packedDataMode: 0,
        title: 'SCOPE_XY Test'
      };

      scopeXyWin = new DebugScopeXyWindow(mockContext, displaySpec);

      // Re-setup spies
      renderCallCount = 0;
      scopeXyWin['render'] = jest.fn(() => {
        renderCallCount++;
        console.log(`Render called #${renderCallCount}`);
        return Promise.resolve();
      });

      // Send 3 sets of 6 values
      console.log('Sending 3 sets of 6 values with rate=3...');
      scopeXyWin['handleData']('100 150 200 250 50 75');
      expect(renderCallCount).toBe(0); // No render yet

      scopeXyWin['handleData']('110 160 210 260 60 85');
      expect(renderCallCount).toBe(0); // Still no render

      scopeXyWin['handleData']('120 170 220 270 70 95');
      expect(renderCallCount).toBe(1); // Now it should render
      console.log('✓ Rendered once after 3 samples with rate=3');
    });

    it('should track what data causes multiple renders', () => {
      // Override handleData to add more detailed logging
      const originalHandleData = scopeXyWin['handleData'];

      scopeXyWin['handleData'] = function(this: any, data: string) {
        const elements = data.trim().split(/\s+/);
        console.log(`\n=== handleData called with ${elements.length} elements ===`);
        console.log(`Data buffer before: [${this.dataBuffer.join(', ')}]`);
        console.log(`Rate counter before: ${this.rateCounter}`);

        // Call original
        originalHandleData.call(this, data);

        console.log(`Data buffer after: [${this.dataBuffer.join(', ')}]`);
        console.log(`Rate counter after: ${this.rateCounter}`);
      };

      // Send problematic data
      scopeXyWin['handleData']('100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95');

      console.log(`\n=== ANALYSIS ===`);
      console.log(`Total renders: ${renderCallCount}`);
      console.log(`Expected renders: 1 (we want all data rendered at once)`);
      console.log(`Bug confirmed: ${renderCallCount > 1 ? 'YES - Multiple renders per message!' : 'NO'}`);
    });
  });

  describe('Root cause analysis', () => {
    it('should show the while loop iterates 3 times for 18 values', () => {
      let whileIterations = 0;

      // Mock the while loop behavior
      const simulateHandleData = (data: string) => {
        const elements = data.trim().split(/\s+/);
        const dataBuffer: number[] = [];
        let rateCounter = 0;
        const channelIndex = 3;
        const rate = 1;

        // Add all values to buffer
        for (const element of elements) {
          const value = parseInt(element);
          if (!isNaN(value)) {
            dataBuffer.push(value);
          }
        }

        console.log(`\nInitial buffer: ${dataBuffer.length} values`);

        // This is the problematic while loop
        while (dataBuffer.length >= channelIndex * 2) {
          whileIterations++;
          const channelData = dataBuffer.splice(0, channelIndex * 2);
          console.log(`While iteration ${whileIterations}: extracted [${channelData.join(', ')}]`);
          console.log(`  Remaining buffer: ${dataBuffer.length} values`);

          rateCounter++;
          if (rateCounter >= rate) {
            console.log(`  -> RENDER triggered (rateCounter=${rateCounter} >= rate=${rate})`);
            rateCounter = 0;
          }
        }
      };

      simulateHandleData('100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95');

      expect(whileIterations).toBe(3);
      console.log(`\n✓ Confirmed: While loop iterates ${whileIterations} times for 18 values`);
      console.log('This is the root cause of the 3x render bug!');
    });
  });

  describe('Proposed fix', () => {
    it('should demonstrate batched rendering solution', () => {
      console.log('\n=== PROPOSED FIX: Batch samples per handleData call ===');

      // The fix: accumulate all samples from one handleData call
      // and render once at the end
      const fixedHandleData = (data: string, channelIndex: number, rate: number) => {
        const elements = data.trim().split(/\s+/);
        const dataBuffer: number[] = [];
        const collectedSamples: number[][] = [];

        // Add all values to buffer
        for (const element of elements) {
          const value = parseInt(element);
          if (!isNaN(value)) {
            dataBuffer.push(value);
          }
        }

        // Collect all complete samples
        while (dataBuffer.length >= channelIndex * 2) {
          const channelData = dataBuffer.splice(0, channelIndex * 2);
          collectedSamples.push(channelData);
        }

        console.log(`Collected ${collectedSamples.length} samples from message`);

        // Only render if we have enough samples based on rate
        if (collectedSamples.length >= rate) {
          console.log(`RENDER ONCE with ${collectedSamples.length} samples`);
          return 1; // One render
        }

        return 0; // No render
      };

      const renders = fixedHandleData('100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95', 3, 1);
      expect(renders).toBe(1);
      console.log('✓ Fixed version renders ONCE for entire message!');
    });
  });
});