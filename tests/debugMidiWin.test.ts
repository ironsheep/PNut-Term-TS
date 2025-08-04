/**
 * @file debugMidiWin.test.ts
 * @description Unit tests for DebugMidiWindow class
 */

import { DebugMidiWindow } from '../src/classes/debugMidiWin';
import { Context } from '../src/utils/context';

// Mock the DOM environment for Node
let mockCanvas: any;
let mockContext2D: any;
let mockElements: Map<string, any>;

// Mock global document and window objects
global.document = {
  getElementById: jest.fn((id: string) => {
    // Return the mock canvas for any midi-canvas-* ID
    if (id && id.startsWith('midi-canvas-')) {
      return mockCanvas;
    }
    return mockElements.get(id);
  }),
  querySelector: jest.fn((selector: string) => {
    // Simple selector mock
    if (selector.includes('.title')) {
      return mockElements.get('title-element');
    }
    if (selector.includes('.close-btn')) {
      return mockElements.get('close-btn');
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

beforeEach(() => {
  // Reset mocks
  mockElements = new Map();
  
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
    height: 0
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
  
  // Mock window element
  const mockWindowElement = {
    style: { left: '', top: '', width: '', height: '' },
    remove: jest.fn(),
    classList: { contains: jest.fn(() => true) },
    querySelector: jest.fn((selector: string) => {
      if (selector === 'canvas') return mockCanvas;
      if (selector === '.title') return mockElements.get('title-element');
      return null;
    })
  };
  
  // Mock title element
  const mockTitleElement = {
    textContent: ''
  };
  mockElements.set('title-element', mockTitleElement);
  
  // Set up mock elements with various IDs
  for (let i = 0; i < 10; i++) {
    mockElements.set(`debug-window-${i}`, mockWindowElement);
    mockElements.set(`midi-canvas-${i}`, mockCanvas);
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DebugMidiWindow', () => {
  let context: Context;
  let midiWindow: DebugMidiWindow;

  beforeEach(() => {
    context = {
      verbose: false,
      serialPortPath: '',
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        logMessage: jest.fn()
      }
    } as any;
    
    midiWindow = new DebugMidiWindow(context);
  });

  describe('MIDI message parsing', () => {
    it('should parse note-on messages correctly', () => {
      midiWindow.createDebugWindow();
      
      // Send note-on for middle C (60) with velocity 64 on channel 0
      midiWindow.updateContent(['$90', '60', '64']);
      
      // Canvas should have been redrawn
      expect(mockContext2D.fillRect).toHaveBeenCalled();
    });

    it('should parse note-off messages correctly', () => {
      midiWindow.createDebugWindow();
      
      // First send note-on
      midiWindow.updateContent(['0x90', '60', '64']);
      
      // Then send note-off
      midiWindow.updateContent(['$80', '60', '0']);
      
      // Canvas should have been redrawn twice
      expect(mockContext2D.fillRect).toHaveBeenCalledTimes(2);
    });

    it('should filter messages by channel', () => {
      midiWindow.createDebugWindow();
      
      // Set to channel 1
      midiWindow.updateContent(['CHANNEL', '1']);
      
      // Send note-on on channel 0 (should be ignored)
      const callsBefore = mockContext2D.fillRect.mock.calls.length;
      midiWindow.updateContent(['$90', '60', '64']);
      expect(mockContext2D.fillRect).toHaveBeenCalledTimes(callsBefore);
      
      // Send note-on on channel 1 (should be processed)
      midiWindow.updateContent(['$91', '60', '64']);
      expect(mockContext2D.fillRect).toHaveBeenCalledTimes(callsBefore + 1);
    });

    it('should handle running status correctly', () => {
      midiWindow.createDebugWindow();
      
      // Reset mock to ignore initial draw
      mockContext2D.fillRect.mockClear();
      
      // Send note-on with status byte
      midiWindow.updateContent(['$90', '60', '64']);
      
      // Send another note-on without status byte (running status)
      midiWindow.updateContent(['62', '64']);
      
      // Both notes should be processed
      expect(mockContext2D.fillRect).toHaveBeenCalledTimes(2);
    });

    it('should reset state when receiving new status byte', () => {
      midiWindow.createDebugWindow();
      
      // Reset mock to ignore initial draw
      mockContext2D.fillRect.mockClear();
      
      // Start note-on but don't complete it
      midiWindow.updateContent(['$90', '60']);
      
      // Send new status byte (should reset state)
      midiWindow.updateContent(['$80', '60', '0']);
      
      // Only the complete note-off should be processed
      expect(mockContext2D.fillRect).toHaveBeenCalledTimes(1);
    });

    it('should handle velocity correctly', () => {
      midiWindow.createDebugWindow();
      
      // Reset mock to ignore initial draw
      mockContext2D.fillRect.mockClear();
      
      // Test different velocities
      midiWindow.updateContent(['$90', '60', '127']); // Max velocity
      midiWindow.updateContent(['$90', '61', '64']);  // Mid velocity
      midiWindow.updateContent(['$90', '62', '1']);   // Min velocity
      
      expect(mockContext2D.fillRect).toHaveBeenCalledTimes(3);
    });
  });

  describe('Command parsing', () => {
    it('should handle SIZE command', () => {
      midiWindow.createDebugWindow();
      
      // Set different sizes
      midiWindow.updateContent(['SIZE', '1']);  // Minimum
      expect(mockCanvas.width).toBeGreaterThan(0);
      
      midiWindow.updateContent(['SIZE', '50']); // Maximum
      expect(mockCanvas.width).toBeGreaterThan(0);
      
      // Invalid sizes should be ignored
      midiWindow.updateContent(['SIZE', '0']);   // Too small
      midiWindow.updateContent(['SIZE', '51']);  // Too large
    });

    it('should handle RANGE command', () => {
      midiWindow.createDebugWindow();
      
      // Valid range
      midiWindow.updateContent(['RANGE', '21', '108']);
      
      // Invalid ranges should be ignored
      midiWindow.updateContent(['RANGE', '-1', '108']);  // Negative start
      midiWindow.updateContent(['RANGE', '0', '128']);   // Out of bounds
      midiWindow.updateContent(['RANGE', '60', '50']);   // End before start
    });

    it('should handle CHANNEL command', () => {
      midiWindow.createDebugWindow();
      
      // Valid channels
      midiWindow.updateContent(['CHANNEL', '0']);
      midiWindow.updateContent(['CHANNEL', '15']);
      
      // Invalid channels should be ignored
      midiWindow.updateContent(['CHANNEL', '-1']);
      midiWindow.updateContent(['CHANNEL', '16']);
    });

    it('should handle COLOR command', () => {
      midiWindow.createDebugWindow();
      
      // Set colors
      midiWindow.updateContent(['COLOR', 'RED', 'BLUE']);
      midiWindow.updateContent(['COLOR', 'GREEN', '8', 'MAGENTA']);
      
      // Should accept RGB values
      midiWindow.updateContent(['COLOR', '$FF0000', '$0000FF']);
    });

    it('should handle CLEAR command', () => {
      midiWindow.createDebugWindow();
      
      // Send some notes
      midiWindow.updateContent(['0x90', '60', '64']);
      midiWindow.updateContent(['0x90', '61', '64']);
      
      // Clear should reset all velocities
      midiWindow.updateContent(['CLEAR']);
      
      // Canvas should be redrawn
      expect(mockContext2D.fillRect).toHaveBeenCalled();
    });

    it('should handle TITLE command', () => {
      midiWindow.createDebugWindow();
      
      midiWindow.updateContent(['TITLE', 'My MIDI Keyboard']);
      
      const titleElement = mockElements.get('title-element');
      expect(titleElement?.textContent).toBe('My MIDI Keyboard');
    });

    it('should handle POS command', () => {
      midiWindow.createDebugWindow();
      
      // Set up window element in mock
      const windowId = (midiWindow as any).windowId;
      const mockWindow = {
        style: { left: '', top: '' }
      };
      mockElements.set(`debug-window-${windowId}`, mockWindow);
      
      midiWindow.updateContent(['POS', '100', '200']);
      
      expect(mockWindow.style.left).toBe('100px');
      expect(mockWindow.style.top).toBe('200px');
    });

    it('should handle SAVE command', () => {
      const mockSave = jest.spyOn(midiWindow as any, 'saveWindowToBMPFilename').mockImplementation(() => {});
      midiWindow.createDebugWindow();
      
      // Save display only
      midiWindow.updateContent(['SAVE', 'test.bmp']);
      expect(mockSave).toHaveBeenCalledWith('test.bmp');
      
      // Save entire window
      midiWindow.updateContent(['SAVE', 'WINDOW', 'test2.bmp']);
      expect(mockSave).toHaveBeenCalledWith('test2.bmp');
    });

    it('should handle PC_KEY and PC_MOUSE commands', () => {
      const mockEnableKeyboard = jest.spyOn(midiWindow as any, 'enableKeyboardInput');
      const mockEnableMouse = jest.spyOn(midiWindow as any, 'enableMouseInput');
      
      midiWindow.createDebugWindow();
      
      midiWindow.updateContent(['PC_KEY']);
      expect(mockEnableKeyboard).toHaveBeenCalled();
      
      midiWindow.updateContent(['PC_MOUSE']);
      expect(mockEnableMouse).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle mixed commands and data', () => {
      midiWindow.createDebugWindow();
      
      // Mix of commands and MIDI data
      midiWindow.updateContent([
        'TITLE', 'Test',
        '$90', '60', '64',
        'SIZE', '10',
        '$80', '60', '0',
        'CLEAR'
      ]);
      
      // Should process all correctly
      expect(mockElements.get('title-element')?.textContent).toBe('Test');
      expect(mockContext2D.fillRect).toHaveBeenCalled();
    });

    it('should handle invalid MIDI data gracefully', () => {
      midiWindow.createDebugWindow();
      
      // Invalid values should be ignored
      midiWindow.updateContent(['invalid', 'data', '999', '-50']);
      
      // Should not crash
      expect(mockContext2D.fillRect).toHaveBeenCalled(); // Initial draw
    });

    it('should handle partial commands at end of input', () => {
      midiWindow.createDebugWindow();
      
      // Incomplete commands should be ignored
      midiWindow.updateContent(['SIZE']); // Missing parameter
      midiWindow.updateContent(['RANGE', '21']); // Missing second parameter
      midiWindow.updateContent(['COLOR', 'RED']); // Missing second color
      
      // Should not crash
      expect(mockContext2D.fillRect).toHaveBeenCalled();
    });
  });

  describe('Window lifecycle', () => {
    it('should create window with correct structure', () => {
      midiWindow.createDebugWindow();
      
      const container = mockElements.get('debug-windows-container');
      expect(container?.insertAdjacentHTML).toHaveBeenCalled();
      
      const canvas = mockElements.get('midi-canvas-0');
      expect(canvas).toBe(mockCanvas);
    });

    it('should clean up on close', () => {
      midiWindow.createDebugWindow();
      
      // Set up window element in mock with remove function
      const windowId = (midiWindow as any).windowId;
      const mockWindow = {
        remove: jest.fn()
      };
      mockElements.set(`debug-window-${windowId}`, mockWindow);
      
      midiWindow.closeDebugWindow();
      
      expect(mockWindow.remove).toHaveBeenCalled();
    });
  });
});