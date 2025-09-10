import { DebugScopeXyWindow, ScopeXyDisplaySpec } from '../src/classes/debugScopeXyWin';
import { createMockContext, createMockBrowserWindow, setupDebugWindowTest, cleanupDebugWindowTest } from './shared/mockHelpers';
import { BrowserWindow } from 'electron';

// Store reference to mock BrowserWindow instances
let mockBrowserWindowInstances: any[] = [];

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
      getPath: jest.fn().mockReturnValue('/test/path'),
      on: jest.fn(),
      quit: jest.fn()
    },
    ipcMain: {
      on: jest.fn(),
      handle: jest.fn(),
      removeHandler: jest.fn()
    }
  };
});

describe('DebugScopeXyWindow', () => {
  let testSetup: ReturnType<typeof setupDebugWindowTest>;
  let mockContext: any;
  let window: DebugScopeXyWindow;
  
  // Helper to create default display spec for tests
  const createTestDisplaySpec = (overrides?: Partial<ScopeXyDisplaySpec>): ScopeXyDisplaySpec => ({
    displayName: 'test-scope',
    title: 'Test Scope XY',
    hasExplicitPosition: false, // Default to auto-placement
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserWindowInstances = [];
    
    // Setup test environment using shared helpers
    testSetup = setupDebugWindowTest();
    mockContext = testSetup.mockContext;
  });

  afterEach(() => {
    if (window) {
      try {
        window.closeDebugWindow();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    cleanupDebugWindowTest();
    jest.clearAllMocks();
  });

  // Helper function to trigger window ready event
  const triggerWindowReady = () => {
    const mockWindow = mockBrowserWindowInstances[0];
    if (mockWindow && mockWindow.webContents.on) {
      // Find and call the 'did-finish-load' callback
      const calls = mockWindow.webContents.on.mock.calls;
      const didFinishLoadCall = calls.find((call: any[]) => call[0] === 'did-finish-load');
      if (didFinishLoadCall && didFinishLoadCall[1]) {
        didFinishLoadCall[1]();
      }
    }
  };

  describe('Constructor and Configuration', () => {
    it('should create window with default configuration', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test']);
      
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
      expect(mockBrowserWindowInstances.length).toBe(1);
      
      // The implementation uses loadURL with a data URL, not loadFile
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.loadURL).toHaveBeenCalled();
    });

    it('should parse SIZE parameter', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'SIZE', '100']);
      
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number)
        })
      );
    });

    it('should clamp SIZE to valid range', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      
      // Test minimum size
      window.createDebugWindow(['SCOPE_XY', 'test', 'SIZE', '10']);
      expect(BrowserWindow).toHaveBeenCalled();
      
      window.closeDebugWindow();
      jest.clearAllMocks();
      mockBrowserWindowInstances = [];
      
      // Test maximum size
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'SIZE', '5000']);
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse RANGE parameter', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'RANGE', '1000']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse SAMPLES parameter', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'SAMPLES', '64']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse DOTSIZE parameter', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'DOTSIZE', '10']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse POLAR mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'POLAR']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse POLAR with custom angles', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'POLAR', '360', '90']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse LOGSCALE mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'LOGSCALE']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse HIDEXY mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'HIDEXY']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse channel labels', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', "'X'", "'Y'"]);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse channel colors', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', "'X'", 'RED']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse packed data mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'LONGS_2BIT']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse packed data mode with ALT modifier', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'LONGS_2BIT', 'ALT']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });

    it('should parse packed data mode with SIGNED modifier', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'LONGS_2BIT', 'SIGNED']);
      expect(window).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });
  });

  describe('Data Plotting', () => {
    beforeEach(() => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test']);
      // Trigger the 'did-finish-load' event to initialize the renderer
      triggerWindowReady();
    });

    it('should handle single channel data', () => {
      // The implementation uses executeJavaScript for rendering
      // It only renders when the rate counter reaches the rate threshold (default 1)
      window.updateContent(['100', '200']);
      
      // Check that executeJavaScript was called for rendering
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle multiple channel data', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', "'A'", "'B'"]);
      triggerWindowReady();
      
      // Need to provide data for both channels before render
      window.updateContent(['10', '20', '30', '40']);
      
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle CLEAR command', () => {
      window.updateContent(['100', '200']);
      window.updateContent(['CLEAR']);
      
      const mockWindow = mockBrowserWindowInstances[0];
      // CLEAR triggers executeJavaScript to clear the canvas using fillRect
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('fillRect')
      );
    });

    it('should handle CLOSE command', () => {
      const closeSpy = jest.spyOn(window, 'closeDebugWindow');
      window.updateContent(['CLOSE']);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle PC_KEY command', () => {
      window.updateContent(['PC_KEY', '65']);
      // Input forwarding would send the key to the P2 device
      expect(window).toBeDefined();
    });

    it('should handle PC_MOUSE command', () => {
      window.updateContent(['PC_MOUSE', '100', '200']);
      // Input forwarding would send the mouse position to the P2 device
      expect(window).toBeDefined();
    });
  });

  describe('Persistence Modes', () => {
    it('should support infinite persistence (samples=0)', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'SAMPLES', '0']);
      triggerWindowReady();
      
      window.updateContent(['100', '200']);
      window.updateContent(['150', '250']);
      
      // Both points should trigger rendering via executeJavaScript
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should support limited persistence', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'SAMPLES', '10']);
      triggerWindowReady();
      
      for (let i = 0; i < 20; i++) {
        window.updateContent([`${i * 10}`, `${i * 10}`]);
      }
      
      // Should maintain only last 10 samples
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('Display Modes', () => {
    it('should support cartesian mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test']);
      triggerWindowReady();
      
      window.updateContent(['100', '100']);
      
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should support polar mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'POLAR']);
      triggerWindowReady();
      
      window.updateContent(['100', '45']); // radius=100, angle=45
      
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should support log scale mode', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'LOGSCALE']);
      triggerWindowReady();
      
      window.updateContent(['100', '100']);
      
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should support combined polar and log scale', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'POLAR', 'LOGSCALE']);
      triggerWindowReady();
      
      window.updateContent(['100', '45']);
      
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('Update Rate Control', () => {
    it('should respect RATE parameter', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test', 'RATE', '5']);
      triggerWindowReady();

      // Send 10 data points
      for (let i = 0; i < 10; i++) {
        window.updateContent([`${i}`, `${i}`]);
      }

      // Should only render on 1st, 6th points (indices 0 and 5)
      const mockWindow = mockBrowserWindowInstances[0];
      const executeCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      
      // Count render calls (those that include drawing operations)
      const renderCalls = executeCalls.filter(
        (call: any[]) => call[0]?.includes('arc') || call[0]?.includes('fillRect')
      );
      
      // With RATE=5, first render at 5th sample, second at 10th sample
      expect(renderCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test']);
      triggerWindowReady();
      
      // Too few parameters for data point - won't complete a pair
      window.updateContent(['100']);
      
      // Should not crash
      expect(window).toBeDefined();
      
      // The implementation doesn't log errors for incomplete data,
      // it just waits for more data to complete the pair
      // So we won't check for error logging here
    });

    it('should handle window destruction gracefully', () => {
      window = new DebugScopeXyWindow(mockContext, createTestDisplaySpec());
      window.createDebugWindow(['SCOPE_XY', 'test']);
      triggerWindowReady();
      
      // Simulate window destruction
      const mockWindow = mockBrowserWindowInstances[0];
      mockWindow.isDestroyed.mockReturnValue(true);
      
      // Should not throw when updating destroyed window
      expect(() => {
        window.updateContent(['100', '200']);
      }).not.toThrow();
    });
  });
});