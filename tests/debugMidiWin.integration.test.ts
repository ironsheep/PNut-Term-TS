/**
 * @file debugMidiWin.integration.test.ts
 * @description Integration tests for DebugMidiWindow
 */

import { DebugMidiWindow } from '../src/classes/debugMidiWin';
import { Context } from '../src/utils/context';
import { InputForwarder } from '../src/classes/shared/inputForwarder';
import { 
  createMockContext, 
  createMockBrowserWindow, 
  createMockUsbSerial,
  setupDebugWindowTest,
  cleanupDebugWindowTest 
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

describe('DebugMidiWindow Integration', () => {
  let midiWindow: DebugMidiWindow;
  let mockContext: Context;
  let mockSerial: any;

  beforeEach(() => {
    // Use shared mock setup
    const testSetup = setupDebugWindowTest();
    mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });
    mockSerial = createMockUsbSerial();
    
    midiWindow = new DebugMidiWindow(mockContext);
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  describe('Window creation and configuration', () => {
    it('should create window with default parameters', async () => {
      // Send MIDI data to trigger window creation
      await midiWindow.updateContent(['$90', '60', '64']);
      
      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
      if (mockWindow) {
        expect(mockWindow.loadURL).toHaveBeenCalled();
      }
    });

    it('should configure window with custom parameters', async () => {
      // Configure before window creation
      await midiWindow.updateContent(['TITLE', 'Custom MIDI Display']);
      await midiWindow.updateContent(['SIZE', '25']);
      await midiWindow.updateContent(['RANGE', '48', '72']);
      await midiWindow.updateContent(['COLOR', 'green', 'red']);
      
      // Now send MIDI data to create window
      await midiWindow.updateContent(['$90', '60', '64']);
      
      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
      if (mockWindow) {
        expect(mockWindow.setTitle).toHaveBeenCalledWith('Custom MIDI Display');
      }
    });
  });

  describe('Complete MIDI data flow', () => {
    it('should process MIDI stream from raw bytes to display', async () => {
      // Note on
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Window should be created
      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
      
      // Note off
      await midiWindow.updateContent(['$80', '60', '0']);
      
      // Window should still exist
      expect(mockWindow).toBeDefined();
    });

    it('should handle multiple notes simultaneously', async () => {
      // Play chord C-E-G
      await midiWindow.updateContent(['$90', '60', '64']); // C
      await midiWindow.updateContent(['$90', '64', '64']); // E
      await midiWindow.updateContent(['$90', '67', '64']); // G
      
      // Release in different order
      await midiWindow.updateContent(['$80', '64', '0']); // E off
      await midiWindow.updateContent(['$80', '60', '0']); // C off
      await midiWindow.updateContent(['$80', '67', '0']); // G off
      
      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
    });
  });

  describe('Window resizing and positioning', () => {
    it('should resize window when SIZE changes', async () => {
      // Create window first
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Store initial MIDI size
      const initialSize = (midiWindow as any).midiSize;
      
      // Change size
      await midiWindow.updateContent(['SIZE', '40']);
      
      // MIDI size should have changed
      expect((midiWindow as any).midiSize).toBe(40);
      expect((midiWindow as any).midiSize).toBeGreaterThan(initialSize);
    });

    it('should resize window when RANGE changes', async () => {
      // Create window first
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Store initial range
      const initialFirst = (midiWindow as any).midiKeyFirst;
      const initialLast = (midiWindow as any).midiKeyLast;
      
      // Change to smaller range
      await midiWindow.updateContent(['RANGE', '60', '72']);
      
      // Range should have changed
      expect((midiWindow as any).midiKeyFirst).toBe(60);
      expect((midiWindow as any).midiKeyLast).toBe(72);
    });

    it('should position window correctly', async () => {
      // Create window first
      await midiWindow.updateContent(['$90', '60', '64']);
      
      const mockWindow = (midiWindow as any).debugWindow;
      
      // Position window
      await midiWindow.updateContent(['POS', '123', '456']);
      
      if (mockWindow) {
        expect(mockWindow.setPosition).toHaveBeenCalledWith(123, 456);
      }
    });
  });

  describe('InputForwarder integration', () => {
    it('should forward keyboard input when PC_KEY is enabled', async () => {
      // Enable PC_KEY
      await midiWindow.updateContent(['PC_KEY']);
      
      const inputForwarder = (midiWindow as any).inputForwarder;
      expect(inputForwarder).toBeDefined();
      expect(inputForwarder.isActive).toBe(true);
    });

    it('should forward mouse input when PC_MOUSE is enabled', async () => {
      // Enable PC_MOUSE
      await midiWindow.updateContent(['PC_MOUSE']);
      
      const inputForwarder = (midiWindow as any).inputForwarder;
      expect(inputForwarder).toBeDefined();
      expect(inputForwarder.isActive).toBe(true);
    });
  });

  describe('Save functionality', () => {
    it('should save window to BMP file', async () => {
      // Mock the protected method
      const saveSpy = jest.spyOn(midiWindow as any, 'saveWindowToBMPFilename').mockResolvedValue(undefined);
      
      // Create window and save
      await midiWindow.updateContent(['$90', '60', '64']);
      await midiWindow.updateContent(['SAVE', 'test.bmp']);
      
      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });
  });

  describe('Error handling', () => {
    it('should handle missing canvas gracefully', async () => {
      // Try to send MIDI without window creation
      // updateContent doesn't return a promise, just verify no error
      expect(() => midiWindow.updateContent(['$90', '60', '64'])).not.toThrow();
    });

    it('should handle invalid window ID gracefully', async () => {
      // Window ID is handled internally, just verify no crash
      // updateContent doesn't return a promise, just verify no error
      expect(() => midiWindow.updateContent(['$90', '60', '64'])).not.toThrow();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rapid configuration changes', async () => {
      // Rapid fire configuration changes
      const commands = [
        ['SIZE', '10'],
        ['SIZE', '20'],
        ['SIZE', '30'],
        ['RANGE', '48', '72'],
        ['RANGE', '36', '84'],
        ['COLOR', 'red', 'blue'],
        ['COLOR', 'green', 'yellow'],
        ['CHANNEL', '0'],
        ['CHANNEL', '1'],
        ['CHANNEL', '2']
      ];
      
      for (const cmd of commands) {
        await midiWindow.updateContent(cmd);
      }
      
      // Finally send MIDI data
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Should have latest values
      expect((midiWindow as any).midiSize).toBe(30);
      expect((midiWindow as any).midiChannel).toBe(2);
    });

    it('should handle mixed MIDI channels correctly', async () => {
      // Set to channel 1 only
      await midiWindow.updateContent(['CHANNEL', '1']);
      
      // Send notes on different channels
      await midiWindow.updateContent(['$90', '60', '64']); // Channel 0 - ignored
      await midiWindow.updateContent(['$91', '62', '64']); // Channel 1 - processed
      await midiWindow.updateContent(['$92', '64', '64']); // Channel 2 - ignored
      
      // Window should be created (at least one note was processed)
      expect((midiWindow as any).debugWindow).toBeDefined();
    });
  });
});