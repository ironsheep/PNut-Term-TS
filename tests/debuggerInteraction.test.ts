/** @format */

// tests/debuggerInteraction.test.ts

import { DebuggerInteraction, KEYBOARD_SHORTCUTS, HitTestResult } from '../src/classes/shared/debuggerInteraction';
import { DebuggerRenderer } from '../src/classes/shared/debuggerRenderer';
import { DebuggerProtocol } from '../src/classes/shared/debuggerProtocol';
import { DebuggerDataManager } from '../src/classes/shared/debuggerDataManager';

// Mock dependencies
jest.mock('../src/classes/shared/debuggerRenderer');
jest.mock('../src/classes/shared/debuggerProtocol');
jest.mock('../src/classes/shared/debuggerDataManager');

describe('DebuggerInteraction', () => {
  let interaction: DebuggerInteraction;
  let mockRenderer: jest.Mocked<DebuggerRenderer>;
  let mockProtocol: jest.Mocked<DebuggerProtocol>;
  let mockDataManager: jest.Mocked<DebuggerDataManager>;
  const cogId = 0;

  beforeEach(() => {
    // Create mock instances
    mockDataManager = new DebuggerDataManager() as jest.Mocked<DebuggerDataManager>;
    mockRenderer = new DebuggerRenderer(null as any, mockDataManager, cogId) as jest.Mocked<DebuggerRenderer>;
    mockProtocol = new DebuggerProtocol() as jest.Mocked<DebuggerProtocol>;

    // Create interaction instance
    interaction = new DebuggerInteraction(
      mockRenderer,
      mockProtocol,
      mockDataManager,
      cogId
    );

    // Mock getCogState to return a valid state
    mockDataManager.getCogState.mockReturnValue({
      cogId,
      isActive: true,
      isBreaked: false,
      programCounter: 0x1000,
      skipPattern: 0,
      callDepth: 0,
      breakpoints: new Set(),
      cogMemory: new Map(),
      lutMemory: new Map(),
      lastMessage: null
    });
  });

  afterEach(() => {
    interaction.cleanup();
    jest.clearAllMocks();
  });

  describe('Keyboard Handling', () => {
    it('should handle SPACE key for GO command', () => {
      const event = createKeyboardEvent(' ', 'Space');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockProtocol.sendGo).toHaveBeenCalledWith(cogId);
    });

    it('should handle B key for BREAK command', () => {
      const event = createKeyboardEvent('B', 'KeyB');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockProtocol.sendBreak).toHaveBeenCalledWith(cogId);
    });

    it('should handle D key for DEBUG toggle', () => {
      const event = createKeyboardEvent('D', 'KeyD');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockProtocol.toggleDebugMode).toHaveBeenCalled();
    });

    it('should handle I key for INIT command', () => {
      const event = createKeyboardEvent('I', 'KeyI');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockProtocol.sendInitCommand).toHaveBeenCalled();
    });

    it('should handle S key for STEP command', () => {
      const event = createKeyboardEvent('S', 'KeyS');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockProtocol.sendStepCommand).toHaveBeenCalled();
    });

    it('should handle Shift+S for STEP OVER command', () => {
      const event = createKeyboardEvent('S', 'KeyS', true);
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockProtocol.sendStepOverCommand).toHaveBeenCalled();
    });

    it('should handle F9 for toggle breakpoint', () => {
      const event = createKeyboardEvent('F9', 'F9');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      // Breakpoint toggling happens through dataManager
      expect(mockDataManager.getCogState).toHaveBeenCalled();
    });

    it('should handle arrow keys for navigation', () => {
      const upEvent = createKeyboardEvent('ArrowUp', 'ArrowUp');
      const downEvent = createKeyboardEvent('ArrowDown', 'ArrowDown');

      interaction.handleKeyboard(upEvent);
      interaction.handleKeyboard(downEvent);

      expect(mockRenderer.setSelectedAddress).toHaveBeenCalledTimes(2);
    });

    it('should handle TAB for view cycling', () => {
      const event = createKeyboardEvent('Tab', 'Tab');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(true);
      expect(mockRenderer.markRegionDirty).toHaveBeenCalled();
    });

    it('should return false for unhandled keys', () => {
      const event = createKeyboardEvent('Z', 'KeyZ');
      const handled = interaction.handleKeyboard(event);

      expect(handled).toBe(false);
    });
  });

  describe('Mouse Click Handling', () => {
    it('should handle button clicks', () => {
      // Mock hit test to return a button
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'controls',
        type: 'button',
        data: { command: 'go' },
        tooltip: 'Click to GO'
      });

      interaction.handleMouseClick(100, 5, 0);

      expect(mockProtocol.sendGo).toHaveBeenCalledWith(cogId);
      expect(mockRenderer.handleMouseClick).toHaveBeenCalledWith(100, 5);
    });

    it('should handle memory clicks', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'cogRegisters',
        type: 'memory',
        data: { address: 0x100, type: 'COG' },
        tooltip: 'COG Register $100'
      });

      interaction.handleMouseClick(10, 10, 0);

      expect(mockRenderer.setSelectedAddress).toHaveBeenCalledWith(0x100);
      expect(mockRenderer.handleMouseClick).toHaveBeenCalledWith(10, 10);
    });

    it('should handle double-click on memory for editing', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'cogRegisters',
        type: 'memory',
        data: { address: 0x100, type: 'COG' },
        tooltip: 'COG Register $100'
      });

      // Simulate double-click
      interaction.handleMouseClick(10, 10, 0);
      interaction.handleMouseClick(10, 10, 0); // Second click within threshold

      // Should trigger edit (console.log for now)
      expect(mockRenderer.handleMouseClick).toHaveBeenCalledTimes(2);
    });

    it('should handle disassembly line clicks', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'disassembly',
        type: 'disassembly',
        data: { address: 0x2000, row: 5 },
        tooltip: 'Address $02000'
      });

      interaction.handleMouseClick(30, 25, 0);

      expect(mockRenderer.setSelectedAddress).toHaveBeenCalledWith(0x2000);
      expect(mockRenderer.handleMouseClick).toHaveBeenCalledWith(30, 25);
    });

    it('should toggle breakpoint on double-click in disassembly', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'disassembly',
        type: 'disassembly',
        data: { address: 0x2000, row: 5 },
        tooltip: 'Address $02000'
      });

      // Double-click
      interaction.handleMouseClick(30, 25, 0);
      interaction.handleMouseClick(30, 25, 0);

      expect(mockDataManager.getCogState).toHaveBeenCalled();
    });

    it('should handle pin clicks', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'pins',
        type: 'pin',
        data: { pin: 15 },
        tooltip: 'Pin 15'
      });

      interaction.handleMouseClick(20, 68, 0);

      expect(mockRenderer.markRegionDirty).toHaveBeenCalledWith('pins');
      expect(mockRenderer.handleMouseClick).toHaveBeenCalledWith(20, 68);
    });

    it('should ignore clicks with no hit', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue(null);

      interaction.handleMouseClick(500, 500, 0);

      expect(mockRenderer.handleMouseClick).not.toHaveBeenCalled();
    });
  });

  describe('Mouse Move Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should show tooltip on hover with debounce', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue({
        region: 'controls',
        type: 'button',
        data: { command: 'go' },
        tooltip: 'Click to GO'
      });

      interaction.handleMouseMove(100, 5);

      // Tooltip should not be set immediately
      expect(mockRenderer.setTooltip).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      jest.advanceTimersByTime(100);

      expect(mockRenderer.setTooltip).toHaveBeenCalledWith('Click to GO', 100, 5);
      expect(mockRenderer.handleMouseMove).toHaveBeenCalledWith(100, 5);
    });

    it('should clear tooltip when no hit', () => {
      jest.spyOn(interaction as any, 'hitTest').mockReturnValue(null);

      interaction.handleMouseMove(500, 500);
      jest.advanceTimersByTime(100);

      expect(mockRenderer.clearTooltip).toHaveBeenCalled();
    });
  });

  describe('Mouse Wheel Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle scroll wheel with debounce', () => {
      // Set focus to disassembly
      (interaction as any).currentFocus = 'disassembly';

      interaction.handleMouseWheel(120); // Scroll down

      // Should not update immediately
      expect(mockDataManager.updateProgramCounter).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      jest.advanceTimersByTime(50);

      // Should scroll disassembly
      expect(mockDataManager.getCogState).toHaveBeenCalled();
    });
  });

  describe('Hit Testing', () => {
    it('should correctly identify button hits', () => {
      const result = (interaction as any).hitTestButtons(100, 5);

      expect(result).toEqual({
        region: 'controls',
        type: 'button',
        data: { command: 'go' },
        tooltip: 'Click to GO'
      });
    });

    it('should correctly identify COG register hits', () => {
      const result = (interaction as any).hitTestMemory(10, 5);

      expect(result).toEqual({
        region: 'cogRegisters',
        type: 'memory',
        data: { address: expect.any(Number), type: 'COG' },
        tooltip: expect.stringContaining('COG Register')
      });
    });

    it('should correctly identify LUT register hits', () => {
      const result = (interaction as any).hitTestMemory(80, 5);

      expect(result).toEqual({
        region: 'lutRegisters',
        type: 'memory',
        data: { address: expect.any(Number), type: 'LUT' },
        tooltip: expect.stringContaining('LUT Register')
      });
    });

    it('should correctly identify HUB memory hits', () => {
      const result = (interaction as any).hitTestMemory(100, 45);

      expect(result).toEqual({
        region: 'hubMemory',
        type: 'memory',
        data: { address: expect.any(Number), type: 'HUB' },
        tooltip: expect.stringContaining('HUB Address')
      });
    });

    it('should correctly identify disassembly hits', () => {
      const result = (interaction as any).hitTestDisassembly(30, 25);

      expect(result).toEqual({
        region: 'disassembly',
        type: 'disassembly',
        data: { address: expect.any(Number), row: expect.any(Number) },
        tooltip: expect.stringContaining('Address')
      });
    });

    it('should correctly identify register watch hits', () => {
      const result = (interaction as any).hitTestRegisters(10, 38);

      expect(result).toEqual({
        region: 'registerWatch',
        type: 'register',
        data: { register: expect.stringMatching(/REG[AB]|PTR[AB]/) },
        tooltip: expect.stringContaining('Register')
      });
    });

    it('should correctly identify pin state hits', () => {
      const result = (interaction as any).hitTestPins(20, 68);

      expect(result).toEqual({
        region: 'pins',
        type: 'pin',
        data: { pin: expect.any(Number) },
        tooltip: expect.stringContaining('Pin')
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers on cleanup', () => {
      jest.useFakeTimers();

      // Trigger some timers
      interaction.handleMouseMove(100, 100);
      interaction.handleMouseWheel(120);

      // Cleanup should clear timers
      interaction.cleanup();

      // Advance time - no callbacks should fire
      jest.advanceTimersByTime(1000);

      expect(mockRenderer.setTooltip).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});

// Helper function to create keyboard events
function createKeyboardEvent(
  key: string,
  code: string,
  shiftKey = false,
  ctrlKey = false,
  altKey = false
): KeyboardEvent {
  return {
    key,
    code,
    shiftKey,
    ctrlKey,
    altKey,
    preventDefault: jest.fn()
  } as unknown as KeyboardEvent;
}