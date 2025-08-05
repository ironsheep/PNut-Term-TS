import { DebugScopeXyWindow } from '../src/classes/debugScopeXyWin';

describe('DebugScopeXyWindow', () => {
  let mockMainWindow: any;
  let mockCanvas: any;
  let mockCtx: any;
  let window: DebugScopeXyWindow;

  beforeEach(() => {
    // Create mock canvas context
    mockCtx = {
      fillRect: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
      font: '',
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      globalAlpha: 1,
      imageSmoothingEnabled: true
    };

    // Create mock canvas
    mockCanvas = {
      width: 256,
      height: 256,
      getContext: jest.fn(() => mockCtx),
      style: {}
    };

    // Create mock main window
    mockMainWindow = {
      webContents: {
        send: jest.fn()
      }
    };

    // Mock DOM elements
    document.createElement = jest.fn((tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      return { style: {} } as any;
    });
    document.body.appendChild = jest.fn();
  });

  afterEach(() => {
    if (window) {
      window.close();
    }
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create window with default configuration', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', [], jest.fn());
      expect(window).toBeDefined();
      expect(mockCanvas.width).toBe(256); // Default radius 128 * 2
      expect(mockCanvas.height).toBe(256);
    });

    it('should parse SIZE parameter', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['SIZE', '100'], jest.fn());
      expect(mockCanvas.width).toBe(200);
      expect(mockCanvas.height).toBe(200);
    });

    it('should clamp SIZE to valid range', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['SIZE', '10'], jest.fn());
      expect(mockCanvas.width).toBe(64); // Min 32 * 2
      
      window.close();
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['SIZE', '5000'], jest.fn());
      expect(mockCanvas.width).toBe(4096); // Max 2048 * 2
    });

    it('should parse RANGE parameter', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['RANGE', '1000'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse SAMPLES parameter', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['SAMPLES', '64'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse DOTSIZE parameter', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['DOTSIZE', '10'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse POLAR mode', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['POLAR'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse POLAR with twopi and offset', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['POLAR', '360', '90'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse LOGSCALE mode', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['LOGSCALE'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse HIDEXY option', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['HIDEXY'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse channel definitions', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ["'X'", "'Y'"], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse channel with color', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ["'X'", 'RED'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse packed data modes', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['LONGS_2BIT'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse packed data with ALT modifier', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['LONGS_2BIT', 'ALT'], jest.fn());
      expect(window).toBeDefined();
    });

    it('should parse packed data with SIGNED modifier', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['LONGS_2BIT', 'SIGNED'], jest.fn());
      expect(window).toBeDefined();
    });
  });

  describe('Data Handling', () => {
    beforeEach(() => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', [], jest.fn());
    });

    it('should handle X,Y data pairs', () => {
      window.update('100 200');
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('should handle multiple channels', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ["'A'", "'B'"], jest.fn());
      window.update('10 20 30 40');
      expect(mockCtx.arc).toHaveBeenCalledTimes(2);
    });

    it('should handle CLEAR command', () => {
      window.update('100 200');
      window.update('CLEAR');
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should handle CLOSE command', () => {
      const onClose = jest.fn();
      window = new DebugScopeXyWindow(mockMainWindow, 'test', [], onClose);
      window.update('CLOSE');
      expect(onClose).toHaveBeenCalled();
    });

    it('should handle PC_KEY command', () => {
      window.update('PC_KEY 65');
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'serial-data',
        expect.any(Uint8Array)
      );
    });

    it('should handle PC_MOUSE command', () => {
      window.update('PC_MOUSE 100 200');
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'serial-data',
        expect.any(Uint8Array)
      );
    });
  });

  describe('Persistence Modes', () => {
    it('should handle infinite persistence (SAMPLES 0)', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['SAMPLES', '0'], jest.fn());
      window.update('100 200');
      window.update('150 250');
      // Both points should be visible
      expect(mockCtx.arc).toHaveBeenCalledTimes(2);
    });

    it('should handle fading persistence', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['SAMPLES', '10'], jest.fn());
      for (let i = 0; i < 12; i++) {
        window.update(`${i * 10} ${i * 10}`);
      }
      // Should have opacity gradient
      expect(mockCtx.globalAlpha).toBeLessThan(1);
    });
  });

  describe('Display Modes', () => {
    it('should handle cartesian mode (default)', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', [], jest.fn());
      window.update('100 100');
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('should handle polar mode', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['POLAR'], jest.fn());
      window.update('100 45'); // radius=100, angle=45
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('should handle log scale in cartesian', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['LOGSCALE'], jest.fn());
      window.update('100 100');
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('should handle log scale in polar', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['POLAR', 'LOGSCALE'], jest.fn());
      window.update('100 45');
      expect(mockCtx.arc).toHaveBeenCalled();
    });
  });

  describe('Rate Control', () => {
    it('should update display based on rate', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', ['RATE', '5'], jest.fn());
      
      // Send 4 samples - should not update yet
      for (let i = 0; i < 4; i++) {
        window.update(`${i} ${i}`);
      }
      const callCount = mockCtx.fillRect.mock.calls.length;
      
      // Send 5th sample - should trigger update
      window.update('5 5');
      expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  describe('Grid Rendering', () => {
    it('should draw circular grid', () => {
      window = new DebugScopeXyWindow(mockMainWindow, 'test', [], jest.fn());
      // Grid is drawn in constructor
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });
});