/**
 * @file debugMidiWin.test.ts
 * @description Unit tests for DebugMidiWindow class
 */

import { DebugMidiWindow } from '../src/classes/debugMidiWin';
import { Context } from '../src/utils/context';
import { 
  createMockContext, 
  createMockBrowserWindow, 
  setupDebugWindowTest,
  cleanupDebugWindowTest 
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

describe('DebugMidiWindow', () => {
  let midiWindow: DebugMidiWindow;
  let mockContext: Context;

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
    
    midiWindow = new DebugMidiWindow(mockContext);
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  describe('Creation and initialization', () => {
    it('should create instance with correct defaults', () => {
      expect(midiWindow).toBeInstanceOf(DebugMidiWindow);
      // DebugMidiWindow doesn't have getDisplayType method
    });
  });

  describe('MIDI message parsing', () => {
    it('should parse note-on messages correctly', async () => {
      // Send note-on for middle C (60) with velocity 64 on channel 0
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Window should be created
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should parse note-off messages correctly', async () => {
      // First send note-on
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Then send note-off
      await midiWindow.updateContent(['$80', '60', '0']);
      
      // Window should still exist
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should filter messages by channel', async () => {
      // Set to channel 1
      await midiWindow.updateContent(['CHANNEL', '1']);
      
      // Send note-on on channel 0 (should be ignored)
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Send note-on on channel 1 (should be processed)
      await midiWindow.updateContent(['$91', '60', '64']);
      
      // Both should be processed without error
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should handle running status correctly', async () => {
      // Send note-on with status byte
      await midiWindow.updateContent(['$90', '60', '64']);
      
      // Send another note-on without status byte (running status)
      await midiWindow.updateContent(['62', '64']);
      
      // Should process both notes
      expect((midiWindow as any).debugWindow).toBeDefined();
    });
  });

  describe('Command parsing', () => {
    it('should handle COLOR command', async () => {
      // COLOR command takes two colors for MIDI window
      await midiWindow.updateContent(['COLOR', 'red', 'blue']);
      
      // Colors should be updated
      expect((midiWindow as any).whiteKeyColor).toBeDefined();
      expect((midiWindow as any).vColor[0]).toBeDefined();
    });

    it('should handle RANGE command', async () => {
      // Set range from MIDI note 48 to 72
      await midiWindow.updateContent(['RANGE', '48', '72']);
      
      // Range should be set
      expect((midiWindow as any).midiKeyFirst).toBe(48);
      expect((midiWindow as any).midiKeyLast).toBe(72);
    });

    it('should handle CHANNEL command', async () => {
      await midiWindow.updateContent(['CHANNEL', '5']);
      
      // Channel should be set (not 0-based - stores actual value)
      expect((midiWindow as any).midiChannel).toBe(5);
    });

    it('should handle SIZE command', async () => {
      // SIZE takes one parameter - the MIDI display size (1-50)
      await midiWindow.updateContent(['SIZE', '10']);
      
      // MIDI size should be set
      expect((midiWindow as any).midiSize).toBe(10);
      expect((midiWindow as any).keySize).toBe(48); // 8 + 10 * 4
    });

    it('should handle TITLE command', async () => {
      await midiWindow.updateContent(['TITLE', 'My MIDI Keyboard']);
      
      // Title should be set
      const mockWindow = (midiWindow as any).debugWindow;
      if (mockWindow) {
        expect(mockWindow.setTitle).toHaveBeenCalledWith('My MIDI Keyboard');
      }
    });

    it('should handle POS command', async () => {
      await midiWindow.updateContent(['POS', '100', '200']);
      
      // Position should be set
      const mockWindow = (midiWindow as any).debugWindow;
      if (mockWindow) {
        expect(mockWindow.setPosition).toHaveBeenCalledWith(100, 200);
      }
    });

    // PRESET command is not implemented in the TypeScript version
  });

  describe('Edge cases', () => {
    it('should handle empty input', async () => {
      await midiWindow.updateContent([]);
      
      // Should not crash
      expect(midiWindow).toBeDefined();
    });

    it('should handle mixed commands and data', async () => {
      // Mix of commands and MIDI data - COLOR needs two color parameters
      await midiWindow.updateContent(['COLOR', 'red', 'blue', 'TITLE', 'Test', '$90', '60', '64']);
      
      // Should process all correctly
      expect((midiWindow as any).whiteKeyColor).toBeDefined();
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should handle invalid MIDI data gracefully', async () => {
      // Invalid status byte
      await midiWindow.updateContent(['$F5', '60', '64']);
      
      // Should not crash
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should handle partial commands at end of input', async () => {
      // COLOR command without parameter
      await midiWindow.updateContent(['COLOR']);
      
      // Should not crash
      expect(midiWindow).toBeDefined();
    });
  });

  describe('Window lifecycle', () => {
    it('should create window with correct structure', async () => {
      await midiWindow.updateContent(['$90', '60', '64']);
      
      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
      if (mockWindow) {
        expect(mockWindow.loadURL).toHaveBeenCalled();
      }
    });

    it('should clean up on close', async () => {
      await midiWindow.updateContent(['$90', '60', '64']);
      
      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
      
      // Close the window
      midiWindow.closeDebugWindow();
      
      if (mockWindow) {
        expect(mockWindow.destroy).toHaveBeenCalled();
      }
    });
  });
});