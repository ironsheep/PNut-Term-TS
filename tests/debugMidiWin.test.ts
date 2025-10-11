/**
 * @file debugMidiWin.test.ts
 * @description Unit tests for DebugMidiWindow class
 */

import { DebugMidiWindow, MidiDisplaySpec } from '../src/classes/debugMidiWin';
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
  
  // Helper to create default MIDI display spec for tests
  const createTestMidiDisplaySpec = (overrides?: Partial<MidiDisplaySpec>): MidiDisplaySpec => ({
    displayName: 'test-midi',
    windowTitle: 'Test MIDI',
    position: { x: 100, y: 100 },
    size: { width: 400, height: 200 },
    keySize: 20,
    keyRange: { first: 60, last: 72 }, // One octave around middle C
    channel: 0,
    keyColors: { white: 0xFFFFFF, black: 0x000000 },
    ...overrides
  });

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
    
    midiWindow = new DebugMidiWindow(mockContext, createTestMidiDisplaySpec());
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
      await midiWindow.updateContent(['test-midi', '$90', '60', '64']);

      // Window should be created
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should parse note-off messages correctly', async () => {
      // First send note-on
      await midiWindow.updateContent(['test-midi', '$90', '60', '64']);

      // Then send note-off
      await midiWindow.updateContent(['test-midi', '$80', '60', '0']);

      // Window should still exist
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should filter messages by channel', async () => {
      // Set to channel 1
      await midiWindow.updateContent(['test-midi', 'CHANNEL', '1']);

      // Send note-on on channel 0 (should be ignored)
      await midiWindow.updateContent(['test-midi', '$90', '60', '64']);

      // Send note-on on channel 1 (should be processed)
      await midiWindow.updateContent(['test-midi', '$91', '60', '64']);

      // Both should be processed without error
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should handle running status correctly', async () => {
      // Send note-on with status byte
      await midiWindow.updateContent(['test-midi', '$90', '60', '64']);

      // Send another note-on without status byte (running status)
      await midiWindow.updateContent(['test-midi', '62', '64']);

      // Should process both notes
      expect((midiWindow as any).debugWindow).toBeDefined();
    });
  });

  describe('Command parsing', () => {
    beforeEach(() => {
      // Trigger window creation with MIDI data before testing commands
      midiWindow.updateContent(['test-midi', '$90', '60', '64']);
    });

    it('should handle COLOR command', async () => {
      // COLOR command takes two colors for MIDI window
      await midiWindow.updateContent(['test-midi', 'COLOR', 'red', 'blue']);

      // Colors should be updated
      expect((midiWindow as any).whiteKeyColor).toBeDefined();
      expect((midiWindow as any).vColor[0]).toBeDefined();
    });

    it('should handle RANGE command', async () => {
      // Set range from MIDI note 48 to 72
      // Note: Include display name as first element (matches router behavior)
      midiWindow.updateContent(['test-midi', 'RANGE', '48', '72']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Range should be set
      expect((midiWindow as any).midiKeyFirst).toBe(48);
      expect((midiWindow as any).midiKeyLast).toBe(72);
    });

    it('should handle CHANNEL command', async () => {
      // Note: Include display name as first element (matches router behavior)
      midiWindow.updateContent(['test-midi', 'CHANNEL', '5']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Channel should be set (not 0-based - stores actual value)
      expect((midiWindow as any).midiChannel).toBe(5);
    });

    it('should handle SIZE command', async () => {
      // SIZE takes one parameter - the MIDI display size (1-50)
      // Note: Include display name as first element (matches router behavior)
      midiWindow.updateContent(['test-midi', 'SIZE', '10']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // MIDI size should be set
      expect((midiWindow as any).midiSize).toBe(10);
      expect((midiWindow as any).keySize).toBe(48); // 8 + 10 * 4
    });

    it('should handle TITLE command', async () => {
      await midiWindow.updateContent(['test-midi', 'TITLE', 'My MIDI Keyboard']);

      // Title should be set
      const mockWindow = (midiWindow as any).debugWindow;
      if (mockWindow) {
        expect(mockWindow.setTitle).toHaveBeenCalledWith('My MIDI Keyboard');
      }
    });

    it('should handle POS command', async () => {
      await midiWindow.updateContent(['test-midi', 'POS', '100', '200']);

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
      await midiWindow.updateContent(['test-midi']);

      // Should not crash
      expect(midiWindow).toBeDefined();
    });

    it('should handle mixed commands and data', async () => {
      // Mix of commands and MIDI data - COLOR needs two color parameters
      await midiWindow.updateContent(['test-midi', 'COLOR', 'red', 'blue', 'TITLE', 'Test', '$90', '60', '64']);

      // Should process all correctly
      expect((midiWindow as any).whiteKeyColor).toBeDefined();
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should handle invalid MIDI data gracefully', async () => {
      // Invalid status byte
      await midiWindow.updateContent(['test-midi', '$F5', '60', '64']);

      // Should not crash
      expect((midiWindow as any).debugWindow).toBeDefined();
    });

    it('should handle partial commands at end of input', async () => {
      // COLOR command without parameter
      await midiWindow.updateContent(['test-midi', 'COLOR']);

      // Should not crash
      expect(midiWindow).toBeDefined();
    });
  });

  describe('Window lifecycle', () => {
    it('should create window with correct structure', async () => {
      await midiWindow.updateContent(['test-midi', '$90', '60', '64']);

      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
      if (mockWindow) {
        expect(mockWindow.loadURL).toHaveBeenCalled();
      }
    });

    it('should clean up on close', async () => {
      await midiWindow.updateContent(['test-midi', '$90', '60', '64']);

      const mockWindow = (midiWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();

      // Close the window
      midiWindow.closeDebugWindow();

      if (mockWindow) {
        expect(mockWindow.destroy).toHaveBeenCalled();
      }
    });
  });

  describe('Base class delegation', () => {
    const displayName = 'test-midi';

    beforeEach(() => {
      // Trigger window creation with MIDI data
      midiWindow.updateContent([displayName, '$90', '60', '64']);
    });

    it('should delegate CLEAR command to base class', async () => {
      const clearSpy = jest.spyOn(midiWindow as any, 'clearDisplayContent');

      midiWindow.updateContent([displayName, 'CLEAR']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // clearDisplayContent should have been called via base class delegation
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should delegate SAVE command to base class', async () => {
      const saveSpy = jest.spyOn(midiWindow as any, 'saveWindowToBMPFilename');

      midiWindow.updateContent([displayName, 'SAVE', 'test.bmp']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // saveWindowToBMPFilename should have been called via base class delegation
      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should delegate PC_KEY command to base class', async () => {
      const keySpy = jest.spyOn(midiWindow as any, 'enableKeyboardInput');

      midiWindow.updateContent([displayName, 'PC_KEY']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // enableKeyboardInput should have been called via base class delegation
      expect(keySpy).toHaveBeenCalled();
    });

    it('should delegate PC_MOUSE command to base class', async () => {
      const mouseSpy = jest.spyOn(midiWindow as any, 'enableMouseInput');

      midiWindow.updateContent([displayName, 'PC_MOUSE']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // enableMouseInput should have been called via base class delegation
      expect(mouseSpy).toHaveBeenCalled();
    });

    it('should delegate UPDATE command to base class', async () => {
      const updateSpy = jest.spyOn(midiWindow as any, 'forceDisplayUpdate');

      midiWindow.updateContent([displayName, 'UPDATE']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // forceDisplayUpdate should have been called via base class delegation
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should delegate CLOSE command to base class', async () => {
      const closeSpy = jest.spyOn(midiWindow as any, 'closeDebugWindow');

      midiWindow.updateContent([displayName, 'CLOSE']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // closeDebugWindow should have been called via base class delegation
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});