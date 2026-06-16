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
    hasExplicitPosition: false,
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
    // Mark ready so updateContent processes immediately. In production the window enqueues messages
    // until its canvas-init onWindowReady() fires; the BrowserWindow lifecycle events that trigger
    // that don't run under the mock, so set it directly. (MIDI no longer overrides updateContent, so
    // it now uses the base ready-queue + single-flight serialization.) [MIDI save-clobber]
    (midiWindow as any).isWindowReady = true;
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
    beforeEach(() => {
      // Trigger window creation with MIDI data before testing commands
      midiWindow.updateContent(['$90', '60', '64']);
    });

    it('should handle COLOR command', async () => {
      // COLOR command takes two colors for MIDI window
      await midiWindow.updateContent(['COLOR', 'red', 'blue']);

      // Colors should be updated
      expect((midiWindow as any).whiteKeyColor).toBeDefined();
      expect((midiWindow as any).vColor[0]).toBeDefined();
    });

    it('should handle RANGE command', async () => {
      // Set range from MIDI note 48 to 72
      midiWindow.updateContent(['RANGE', '48', '72']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Range should be set
      expect((midiWindow as any).midiKeyFirst).toBe(48);
      expect((midiWindow as any).midiKeyLast).toBe(72);
    });

    it('should handle CHANNEL command', async () => {
      midiWindow.updateContent(['CHANNEL', '5']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Channel should be set (not 0-based - stores actual value)
      expect((midiWindow as any).midiChannel).toBe(5);
    });

    it('should handle SIZE command', async () => {
      // SIZE takes one parameter - the MIDI display size (1-50)
      midiWindow.updateContent(['SIZE', '10']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // MIDI size should be set
      expect((midiWindow as any).midiSize).toBe(10);
      expect((midiWindow as any).keySize).toBe(48); // 8 + 10 * 4
    });

    it('should handle TITLE command', async () => {
      await midiWindow.updateContent(['TITLE', 'My MIDI Keyboard']);

      // MIDI applies the title to its window-title state (and the renderer DOM via
      // setWindowTitle), not via the BrowserWindow.setTitle API. [9win §16]
      expect((midiWindow as any)._windowTitle).toBe('My MIDI Keyboard');
    });

    it('should handle POS command', async () => {
      await midiWindow.updateContent(['POS', '100', '200']);

      // MIDI positions via the renderer DOM (setWindowPosition) and records the explicit
      // position flag, not via the BrowserWindow.setPosition API. [9win §16]
      expect((midiWindow as any).displaySpec.hasExplicitPosition).toBe(true);
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
        expect(mockWindow.loadFile).toHaveBeenCalled();
      }
    });

    it('should clean up on close', async () => {
      await midiWindow.updateContent(['$90', '60', '64']);
      expect((midiWindow as any).debugWindow).toBeDefined();

      // Close the window. MIDI's closeDebugWindow() releases its keyboard/canvas state and
      // nulls debugWindow (the base class then performs the actual teardown) rather than
      // calling BrowserWindow.destroy() directly. [9win §16]
      midiWindow.closeDebugWindow();

      expect((midiWindow as any).debugWindow).toBeNull();
      expect((midiWindow as any).keyLayout).toBeNull();
      expect((midiWindow as any).canvasInitialized).toBe(false);
    });
  });

  describe('Base class delegation', () => {
    beforeEach(() => {
      // Trigger window creation with MIDI data
      midiWindow.updateContent(['$90', '60', '64']);
    });

    it('should delegate CLEAR command to base class', async () => {
      const clearSpy = jest.spyOn(midiWindow as any, 'clearDisplayContent');

      midiWindow.updateContent(['CLEAR']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // clearDisplayContent should have been called via base class delegation
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should delegate SAVE command to base class', async () => {
      const saveSpy = jest.spyOn(midiWindow as any, 'saveWindowToBMPFilename');

      midiWindow.updateContent(['SAVE', 'test.bmp']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // saveWindowToBMPFilename should have been called via base class delegation
      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should delegate PC_KEY command to base class', async () => {
      const keySpy = jest.spyOn(midiWindow as any, 'enableKeyboardInput');

      midiWindow.updateContent(['PC_KEY']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // enableKeyboardInput should have been called via base class delegation
      expect(keySpy).toHaveBeenCalled();
    });

    it('should delegate PC_MOUSE command to base class', async () => {
      const mouseSpy = jest.spyOn(midiWindow as any, 'enableMouseInput');

      midiWindow.updateContent(['PC_MOUSE']);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // enableMouseInput should have been called via base class delegation
      expect(mouseSpy).toHaveBeenCalled();
    });

    it('should ignore UPDATE (no-op, no redraw)', async () => {
      // Pascal MIDI_Update has no key_update case (DebugDisplayUnit.pas:2589-2598): MIDI draws
      // immediately on every note and has no deferred-update mode, so UPDATE must NOT redraw.
      // MIDI strips a leading UPDATE token so it never reaches forceDisplayUpdate. [9win §16]
      const updateSpy = jest.spyOn(midiWindow as any, 'forceDisplayUpdate');
      const drawSpy = jest.spyOn(midiWindow as any, 'drawKeyboard');

      await midiWindow.updateContent(['UPDATE']);
      await new Promise((resolve) => setImmediate(resolve));

      expect(updateSpy).not.toHaveBeenCalled();
      expect(drawSpy).not.toHaveBeenCalled();
    });

    it('should null the window on CLOSE (base-class teardown)', async () => {
      // The base CLOSE handler flushes pending ops and nulls debugWindow directly; it does not
      // call the window's closeDebugWindow() override. [9win §16]
      await midiWindow.updateContent(['CLOSE']);
      await new Promise((resolve) => setImmediate(resolve));

      expect((midiWindow as any).debugWindow).toBeNull();
    });
  });

  describe('Chord rendering (regression: duplicate-const SyntaxError)', () => {
    it('emits syntactically valid draw JS when multiple keys are active at once', () => {
      const win = midiWindow as any;
      win.updateKeyboardLayout(); // build keyLayout
      const layout = win.keyLayout as Map<number, any>;

      // Two simultaneous notes with velocity > 0 (a chord). Each key's draw code is
      // concatenated into ONE injected-function scope; the old code re-declared
      // `const velocityHeight`/`velocityTop` on the 2nd key — a parse-time SyntaxError
      // that failed the ENTIRE draw ("Script failed to execute").
      const [k1, k2] = [...layout.keys()].filter((k) => !layout.get(k).isBlack).slice(0, 2);
      win.midiVelocity[k1] = 100;
      win.midiVelocity[k2] = 100;

      const code1 = win.generateKeyDrawingCode(k1, layout.get(k1), 0xffffff, 0xff0000, 8);
      const code2 = win.generateKeyDrawingCode(k2, layout.get(k2), 0xffffff, 0xff0000, 8);

      // Both keys must have produced a velocity bar (this is what triggers the bug).
      expect((`${code1}${code2}`.match(/ctx\.fillRect\(/g) || []).length).toBe(2);

      // Concatenated into one scope, the result must parse as valid JS.
      const combined = `(function(){ const ctx = { fillRect(){}, fillStyle:'' }; ${code1}${code2} })`;
      expect(() => new Function(combined)).not.toThrow();
      // And it must declare no per-key JS variables that could collide across keys.
      expect(`${code1}${code2}`).not.toMatch(/\bconst velocityHeight\b/);
    });
  });

  // [MIDI lit-chord-not-captured: SAVE must await the draw — unified flow #49]
  // The held-chord SAVE rendered a BARELESS keyboard because drawKeyboard() was fire-and-forget and
  // nothing waited for it: a SAVE's capturePage/desktopCapturer grabbed the canvas before the chord's
  // velocity-bar draw landed. The unified fix funnels draws through the base renderChain (here via
  // flushDraw()→trackRender()), and the base SAVE methods await flushBeforeCapture() (→ renderChain)
  // before capturing. These tests pin (a) flushDraw records the draw on renderChain and (b) the SAVE
  // gate (flushBeforeCapture) blocks until that render resolves.
  describe('SAVE awaits the in-flight keyboard render', () => {
    it('flushBeforeCapture does not resolve until renderChain resolves', async () => {
      const order: string[] = [];
      let resolveRender!: () => void;
      (midiWindow as any).renderChain = new Promise<void>((resolve) => {
        resolveRender = () => {
          order.push('render-done');
          resolve();
        };
      });

      const gate = (midiWindow as any).flushBeforeCapture().then(() => order.push('capture-allowed'));
      // Let microtasks flush — the SAVE gate MUST NOT open while the render is still pending.
      await Promise.resolve();
      await Promise.resolve();
      expect(order).toEqual([]);

      resolveRender();
      await gate;
      // Render must complete strictly before the capture gate opens.
      expect(order).toEqual(['render-done', 'capture-allowed']);
    });

    it('flushDraw records the keyboard draw on the shared renderChain', async () => {
      let landed = false;
      // Make the async draw observable: stub drawKeyboard with a deferred promise.
      const drawPromise = new Promise<void>((resolve) => setTimeout(() => {
        landed = true;
        resolve();
      }, 0));
      (midiWindow as any).drawKeyboard = jest.fn().mockReturnValue(drawPromise);

      (midiWindow as any).flushDraw(false);
      // The SAVE gate must await that draw — i.e. not resolve before the draw lands.
      await (midiWindow as any).flushBeforeCapture();
      expect(landed).toBe(true);
    });
  });
});