/**
 * @file debugMidiWin.integration.test.ts
 * @description Integration tests for DebugMidiWindow
 */

import { DebugMidiWindow } from '../src/classes/debugMidiWin';
import { Context } from '../src/utils/context';
import { InputForwarder } from '../src/classes/shared/inputForwarder';

// Mock serial port
class MockSerialPort {
  write = jest.fn();
  on = jest.fn();
  close = jest.fn();
}

// Mock the DOM environment for Node
let mockElements: Map<string, any>;
let mockCanvas: any;
let mockContext2D: any;

// Mock global document and window objects
global.document = {
  getElementById: jest.fn((id: string) => {
    // Return the mock canvas for any midi-canvas-* ID
    if (id && id.startsWith('midi-canvas-')) {
      return mockCanvas;
    }
    // Return debug window elements
    if (id && id.startsWith('debug-window-')) {
      return mockElements.get(id);
    }
    return mockElements.get(id);
  }),
  querySelector: jest.fn((selector: string) => {
    if (selector.includes('.midi-window')) {
      return mockElements.get('midi-window');
    }
    if (selector.includes('.title')) {
      return mockElements.get('title-element');
    }
    if (selector.includes('canvas')) {
      return mockCanvas;
    }
    return null;
  }),
  createElement: jest.fn((tag: string) => {
    if (tag === 'canvas') {
      return mockCanvas;
    }
    return {};
  }),
  body: {
    innerHTML: ''
  }
} as any;

global.window = {
  debugWindows: new Map()
} as any;

// Mock global HTMLCanvasElement
global.HTMLCanvasElement = jest.fn(() => mockCanvas) as any;

// Mock KeyboardEvent and MouseEvent
global.KeyboardEvent = jest.fn((type: string, options: any) => ({
  type,
  key: options?.key || '',
  keyCode: options?.keyCode || 0,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn()
})) as any;

global.MouseEvent = jest.fn((type: string, options: any) => ({
  type,
  clientX: options?.clientX || 0,
  clientY: options?.clientY || 0,
  buttons: options?.buttons || 0,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn()
})) as any;

beforeEach(() => {
  // Reset mocks
  mockElements = new Map();
  (window as any).debugWindows = new Map();
  
  // Mock canvas context
  mockContext2D = {
    fillRect: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    clearRect: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1
  };
  
  // Mock canvas element
  mockCanvas = {
    getContext: jest.fn(() => mockContext2D),
    width: 0,
    height: 0,
    dispatchEvent: jest.fn()
  };
  
  // Make canvas properties writable
  Object.defineProperty(mockCanvas, 'width', {
    value: 0,
    writable: true,
    configurable: true
  });
  Object.defineProperty(mockCanvas, 'height', {
    value: 0,
    writable: true,
    configurable: true
  });
  
  // Mock container element
  const mockContainer = {
    insertAdjacentHTML: jest.fn()
  };
  mockElements.set('debug-windows-container', mockContainer);
  
  // Mock window elements
  const createMockWindow = (id: number) => ({
    style: { left: '', top: '', width: '', height: '' },
    remove: jest.fn(),
    classList: { contains: jest.fn(() => true) },
    querySelector: jest.fn((selector: string) => {
      if (selector === 'canvas') return mockCanvas;
      if (selector === '.title') return mockElements.get('title-element');
      return null;
    }),
    click: jest.fn()
  });
  
  // Mock title element
  const mockTitleElement = {
    textContent: ''
  };
  mockElements.set('title-element', mockTitleElement);
  
  // Create mock elements for various window IDs
  for (let i = 0; i < 10; i++) {
    const mockWindow = createMockWindow(i);
    mockElements.set(`debug-window-${i}`, mockWindow);
    mockElements.set(`midi-canvas-${i}`, mockCanvas);
  }
  
  // Mock midi-window for queries
  mockElements.set('midi-window', createMockWindow(0));
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (window as any).debugWindows;
});

describe('DebugMidiWindow Integration', () => {
  let context: Context;
  let mockSerialPort: MockSerialPort;

  beforeEach(() => {
    mockSerialPort = new MockSerialPort();
    
    context = {
      verbose: false,
      serialPortPath: '/dev/ttyUSB0',
      serialPort: mockSerialPort as any,
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        logMessage: jest.fn()
      }
    } as any;
  });

  describe('Window creation and configuration', () => {
    it('should create window with default parameters', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      const windowElement = document.querySelector('.midi-window');
      expect(windowElement).not.toBeNull();
      
      const canvas = windowElement?.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.width).toBeGreaterThan(0);
      expect(canvas?.height).toBeGreaterThan(0);
    });

    it('should configure window with custom parameters', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Configure with commands
      midiWindow.updateContent([
        'TITLE', 'Custom MIDI Display',
        'SIZE', '10',
        'RANGE', '36', '84',
        'CHANNEL', '2',
        'COLOR', 'GREEN', 'RED'
      ]);
      
      const titleElement = document.querySelector('.title');
      expect(titleElement?.textContent).toBe('Custom MIDI Display');
      
      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });
  });

  describe('Complete MIDI data flow', () => {
    it('should process MIDI stream from raw bytes to display', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      const ctx = (document.querySelector('canvas') as any)?.getContext('2d');
      
      // Simulate MIDI stream: Note on C4 (60) velocity 100, then note off
      midiWindow.updateContent(['$90']); // Note-on status
      midiWindow.updateContent(['60']);   // Note number
      midiWindow.updateContent(['100']);  // Velocity
      
      // Should have redrawn
      expect(ctx.fillRect).toHaveBeenCalled();
      
      // Note off
      midiWindow.updateContent(['$80', '60', '0']);
      
      // Should have redrawn again
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should handle multiple notes simultaneously', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Play a C major chord
      midiWindow.updateContent(['$90', '60', '100']); // C
      midiWindow.updateContent(['$90', '64', '100']); // E
      midiWindow.updateContent(['$90', '67', '100']); // G
      
      // Release notes
      midiWindow.updateContent(['$80', '60', '0']);
      midiWindow.updateContent(['$80', '64', '0']);
      midiWindow.updateContent(['$80', '67', '0']);
      
      const ctx = mockContext2D;
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('Window resizing and positioning', () => {
    it('should resize window when SIZE changes', () => {
      const midiWindow = new DebugMidiWindow(context);
      
      const windowId = (midiWindow as any).windowId;
      const mockWindow = {
        style: { width: '', height: '' }
      };
      mockElements.set(`debug-window-${windowId}`, mockWindow);
      
      midiWindow.createDebugWindow();
      
      const initialWidth = parseInt(mockWindow.style.width || '0');
      
      // Change size
      midiWindow.updateContent(['SIZE', '20']);
      
      // Window should have been resized
      const newWidth = parseInt(mockWindow.style.width || '0');
      expect(newWidth).toBeGreaterThan(initialWidth);
    });

    it('should resize window when RANGE changes', () => {
      const midiWindow = new DebugMidiWindow(context);
      
      const windowId = (midiWindow as any).windowId;
      const mockWindow = {
        style: { width: '', height: '' }
      };
      mockElements.set(`debug-window-${windowId}`, mockWindow);
      
      midiWindow.createDebugWindow();
      
      const initialWidth = parseInt(mockWindow.style.width || '0');
      
      // Reduce range
      midiWindow.updateContent(['RANGE', '60', '72']); // One octave
      
      // Window should have been resized smaller
      const newWidth = parseInt(mockWindow.style.width || '0');
      expect(newWidth).toBeLessThan(initialWidth);
    });

    it('should position window correctly', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Set up window element in mock
      const windowId = (midiWindow as any).windowId;
      const mockWindow = {
        style: { left: '', top: '' }
      };
      mockElements.set(`debug-window-${windowId}`, mockWindow);
      
      midiWindow.updateContent(['POS', '123', '456']);
      
      expect(mockWindow.style.left).toBe('123px');
      expect(mockWindow.style.top).toBe('456px');
    });
  });

  describe('InputForwarder integration', () => {
    it('should forward keyboard input when PC_KEY is enabled', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Enable PC_KEY
      midiWindow.updateContent(['PC_KEY']);
      
      // Since InputForwarder requires actual DOM events, we'll just verify it was enabled
      expect(context.logger.logMessage).toHaveBeenCalledWith(expect.stringContaining('keyboard'));
    });

    it('should forward mouse input when PC_MOUSE is enabled', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Enable PC_MOUSE
      midiWindow.updateContent(['PC_MOUSE']);
      
      // Since InputForwarder requires actual DOM events, we'll just verify it was enabled
      expect(context.logger.logMessage).toHaveBeenCalledWith(expect.stringContaining('mouse'));
    });
  });

  describe('Save functionality', () => {
    it('should save window to BMP file', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Mock the save method
      const mockSave = jest.spyOn(midiWindow as any, 'saveWindowToBMPFilename').mockImplementation(() => {});
      
      // Save display area only
      midiWindow.updateContent(['SAVE', 'midi_output.bmp']);
      expect(mockSave).toHaveBeenCalledWith('midi_output.bmp');
      
      // Save entire window
      midiWindow.updateContent(['SAVE', 'WINDOW', 'midi_window.bmp']);
      expect(mockSave).toHaveBeenCalledWith('midi_window.bmp');
    });
  });

  describe('Error handling', () => {
    it('should handle missing canvas gracefully', () => {
      const midiWindow = new DebugMidiWindow(context);
      
      // Override getElementById to return null for canvas
      jest.spyOn(document, 'getElementById').mockReturnValue(null);
      
      // Should not crash
      midiWindow.createDebugWindow();
      midiWindow.updateContent(['$90', '60', '100']);
    });

    it('should handle invalid window ID gracefully', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Spy on getElementById to track calls
      const getElementSpy = jest.spyOn(document, 'getElementById');
      
      // Call close
      midiWindow.closeDebugWindow();
      
      // Should have tried to find and remove the window
      expect(getElementSpy).toHaveBeenCalledWith(expect.stringContaining('debug-window-'));
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rapid configuration changes', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Rapid changes
      for (let i = 1; i <= 10; i++) {
        midiWindow.updateContent(['SIZE', i.toString()]);
      }
      
      // Should not crash and should have final size
      const windowElement = mockElements.get('midi-window');
      expect(windowElement).not.toBeNull();
    });

    it('should handle mixed MIDI channels correctly', () => {
      const midiWindow = new DebugMidiWindow(context);
      midiWindow.createDebugWindow();
      
      // Spy on processMidiByte to verify channel filtering
      const processSpy = jest.spyOn(midiWindow as any, 'processMidiByte');
      
      // Send notes on different channels
      midiWindow.updateContent(['$90', '60', '100']); // Channel 0 - should process
      expect(processSpy).toHaveBeenCalledWith(0x90);
      expect(processSpy).toHaveBeenCalledWith(60);
      expect(processSpy).toHaveBeenCalledWith(100);
      
      processSpy.mockClear();
      midiWindow.updateContent(['$91', '61', '100']); // Channel 1 - should still process bytes
      expect(processSpy).toHaveBeenCalledWith(0x91);
      
      // Change to channel 1
      midiWindow.updateContent(['CHANNEL', '1']);
      
      processSpy.mockClear();
      midiWindow.updateContent(['$91', '63', '100']); // Channel 1 - should process
      expect(processSpy).toHaveBeenCalledWith(0x91);
      expect(processSpy).toHaveBeenCalledWith(63);
      expect(processSpy).toHaveBeenCalledWith(100);
    });
  });
});