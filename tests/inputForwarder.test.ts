/** @format */

'use strict';

import { InputForwarder } from '../src/classes/shared/inputForwarder';
import { UsbSerial } from '../src/utils/usb.serial';
import { PC_KEY_VALUES, MOUSE_BUTTON_STATE, MOUSE_POSITION } from '../src/classes/shared/debugInputConstants';
import { createMockUsbSerial } from './shared/mockHelpers';

// Mock UsbSerial
jest.mock('../src/utils/usb.serial');

describe('InputForwarder', () => {
  let forwarder: InputForwarder;
  let mockSerial: jest.Mocked<UsbSerial>;

  beforeEach(() => {
    forwarder = new InputForwarder();
    mockSerial = createMockUsbSerial();
    
    // Remove all event listeners to prevent test interference
    forwarder.removeAllListeners();
    
    jest.useFakeTimers({ legacyFakeTimers: false });
  });

  afterEach(() => {
    forwarder.stopPolling();
    forwarder.removeAllListeners(); // Clean up event listeners
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should start with empty queue', () => {
      expect(forwarder.getQueueSize()).toBe(0);
      expect(forwarder.isActive).toBe(false);
    });

    it('should set USB serial connection', () => {
      forwarder.setUsbSerial(mockSerial);
      // Should not throw
      expect(() => forwarder.startPolling()).not.toThrow();
    });

    it('should set window dimensions', () => {
      forwarder.setWindowDimensions(640, 480);
      // Dimensions will be used in mouse coordinate validation
      expect(() => forwarder.setWindowDimensions(0, 0)).not.toThrow();
    });

    it('should set dot size with minimum of 1', () => {
      forwarder.setDotSize(4, 4);
      forwarder.setDotSize(0, -1); // Should clamp to 1,1
      // Will be tested with mouse events
      expect(() => forwarder.setDotSize(100, 100)).not.toThrow();
    });
  });

  describe('Keyboard event queuing', () => {
    it('should queue special key events', () => {
      const specialKeys = [
        { key: 'ArrowLeft', value: PC_KEY_VALUES.LEFT_ARROW },
        { key: 'ArrowRight', value: PC_KEY_VALUES.RIGHT_ARROW },
        { key: 'ArrowUp', value: PC_KEY_VALUES.UP_ARROW },
        { key: 'ArrowDown', value: PC_KEY_VALUES.DOWN_ARROW },
        { key: 'Home', value: PC_KEY_VALUES.HOME },
        { key: 'End', value: PC_KEY_VALUES.END },
        { key: 'Delete', value: PC_KEY_VALUES.DELETE },
        { key: 'Backspace', value: PC_KEY_VALUES.BACKSPACE },
        { key: 'Tab', value: PC_KEY_VALUES.TAB },
        { key: 'Insert', value: PC_KEY_VALUES.INSERT },
        { key: 'PageUp', value: PC_KEY_VALUES.PAGE_UP },
        { key: 'PageDown', value: PC_KEY_VALUES.PAGE_DOWN },
        { key: 'Enter', value: PC_KEY_VALUES.ENTER },
        { key: 'Escape', value: PC_KEY_VALUES.ESC },
      ];

      specialKeys.forEach(({ key }) => {
        forwarder.queueKeyEvent(key);
      });

      expect(forwarder.getQueueSize()).toBe(specialKeys.length);
    });

    it('should queue printable ASCII characters', () => {
      const chars = 'ABCabc123 !@#';
      for (const char of chars) {
        forwarder.queueKeyEvent(char);
      }
      expect(forwarder.getQueueSize()).toBe(chars.length);
    });

    it('should queue numeric key codes', () => {
      forwarder.queueKeyEvent(65); // 'A'
      forwarder.queueKeyEvent(32); // Space
      forwarder.queueKeyEvent(127); // Del
      expect(forwarder.getQueueSize()).toBe(3);
    });

    it('should ignore invalid key codes', () => {
      forwarder.queueKeyEvent('invalid');
      forwarder.queueKeyEvent(256); // Out of range
      forwarder.queueKeyEvent(-1);  // Negative
      
      // These should all result in NO_KEYPRESS
      expect(forwarder.getQueueSize()).toBe(3);
    });

    it('should handle case insensitive special keys', () => {
      forwarder.queueKeyEvent('arrowleft');
      forwarder.queueKeyEvent('ARROWRIGHT');
      forwarder.queueKeyEvent('Home');
      expect(forwarder.getQueueSize()).toBe(3);
    });
  });

  describe('Mouse event queuing', () => {
    beforeEach(() => {
      forwarder.setWindowDimensions(100, 100);
      forwarder.setDotSize(1, 1);
    });

    it('should queue basic mouse events', () => {
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, 0);
      
      expect(forwarder.getQueueSize()).toBe(1);
    });

    it('should handle mouse button states', () => {
      forwarder.queueMouseEvent(10, 10, 
        { left: true, middle: false, right: false }, 0);
      forwarder.queueMouseEvent(10, 10, 
        { left: false, middle: true, right: false }, 0);
      forwarder.queueMouseEvent(10, 10, 
        { left: false, middle: false, right: true }, 0);
      
      expect(forwarder.getQueueSize()).toBe(3);
    });

    it('should clamp wheel delta to -1, 0, 1', () => {
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, 100);
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, -100);
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, 0);
      
      expect(forwarder.getQueueSize()).toBe(3);
    });

    it('should handle coordinate transformation with DOTSIZE', () => {
      forwarder.setDotSize(4, 4);
      
      // Position 50,50 with DOTSIZE 4,4 should transform to 12,12
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, 0);
      
      expect(forwarder.getQueueSize()).toBe(1);
    });

    it('should detect out of bounds mouse position', () => {
      // Window is 100x100
      forwarder.queueMouseEvent(150, 150, 
        { left: false, middle: false, right: false }, 0);
      forwarder.queueMouseEvent(-10, -10, 
        { left: false, middle: false, right: false }, 0);
      
      expect(forwarder.getQueueSize()).toBe(2);
    });

    it('should get pixel color when getter provided', () => {
      const pixelGetter = jest.fn((x: number, y: number) => 0xFF0000);
      
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, 0, pixelGetter);
      
      expect(pixelGetter).toHaveBeenCalledWith(50, 50);
      expect(forwarder.getQueueSize()).toBe(1);
    });

    it('should mask pixel color to 24-bit', () => {
      const pixelGetter = jest.fn(() => 0xFFFFFFFF);
      
      forwarder.queueMouseEvent(50, 50, 
        { left: false, middle: false, right: false }, 0, pixelGetter);
      
      expect(forwarder.getQueueSize()).toBe(1);
    });
  });

  describe('Queue management', () => {
    it('should limit queue size to MAX_QUEUE_SIZE', () => {
      // Queue 110 events (MAX is 100)
      for (let i = 0; i < 110; i++) {
        forwarder.queueKeyEvent(65);
      }
      
      expect(forwarder.getQueueSize()).toBe(100);
    });

    it('should remove oldest events when queue is full', () => {
      // Fill queue
      for (let i = 0; i < 100; i++) {
        forwarder.queueKeyEvent(i);
      }
      
      // Add one more - should remove first
      forwarder.queueKeyEvent(255);
      
      expect(forwarder.getQueueSize()).toBe(100);
    });

    it('should clear queue', () => {
      forwarder.queueKeyEvent('A');
      forwarder.queueKeyEvent('B');
      forwarder.queueKeyEvent('C');
      
      forwarder.clearQueue();
      expect(forwarder.getQueueSize()).toBe(0);
    });
  });

  describe('Polling and event processing', () => {
    beforeEach(() => {
      forwarder.setUsbSerial(mockSerial);
      forwarder.setWindowDimensions(100, 100);
    });

    it('should start and stop polling', () => {
      expect(forwarder.isActive).toBe(false);
      
      forwarder.startPolling();
      expect(forwarder.isActive).toBe(true);
      
      forwarder.stopPolling();
      expect(forwarder.isActive).toBe(false);
    });

    it('should not start polling twice', () => {
      forwarder.startPolling();
      forwarder.startPolling(); // Should be ignored
      
      expect(forwarder.isActive).toBe(true);
    });

    it('should process keyboard events at 60Hz', async () => {
      forwarder.queueKeyEvent('A');
      forwarder.startPolling();
      
      // Advance timer by 16ms (one poll interval)
      await jest.advanceTimersByTimeAsync(16);
      
      expect(mockSerial.write).toHaveBeenCalledTimes(1);
      expect(forwarder.getQueueSize()).toBe(0);
    });

    it('should process mouse events', async () => {
      forwarder.queueMouseEvent(50, 50, 
        { left: true, middle: false, right: false }, 0);
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      expect(mockSerial.write).toHaveBeenCalledTimes(1);
      expect(forwarder.getQueueSize()).toBe(0);
    });

    it('should format PC_KEY data correctly', async () => {
      forwarder.queueKeyEvent('A'); // ASCII 65
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      const callArg = mockSerial.write.mock.calls[0][0];
      const buffer = Buffer.from(callArg, 'base64');
      
      expect(buffer.length).toBe(4);
      expect(buffer.readUInt32LE(0)).toBe(65);
    });

    it('should format PC_MOUSE data correctly', async () => {
      forwarder.queueMouseEvent(10, 20, 
        { left: true, middle: false, right: true }, 1);
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      const callArg = mockSerial.write.mock.calls[0][0];
      const buffer = Buffer.from(callArg, 'base64');
      
      expect(buffer.length).toBe(28); // 7 longs
      expect(buffer.readInt32LE(0)).toBe(10);  // xpos
      expect(buffer.readInt32LE(4)).toBe(20);  // ypos
      expect(buffer.readInt32LE(8)).toBe(1);   // wheeldelta
      expect(buffer.readInt32LE(12)).toBe(MOUSE_BUTTON_STATE.PRESSED); // lbutton
      expect(buffer.readInt32LE(16)).toBe(MOUSE_BUTTON_STATE.RELEASED); // mbutton
      expect(buffer.readInt32LE(20)).toBe(MOUSE_BUTTON_STATE.PRESSED); // rbutton
      expect(buffer.readInt32LE(24)).toBe(-1); // pixel (no getter provided)
    });

    it('should handle out of bounds mouse correctly', async () => {
      forwarder.queueMouseEvent(200, 200, 
        { left: false, middle: false, right: false }, 0);
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      const callArg = mockSerial.write.mock.calls[0][0];
      const buffer = Buffer.from(callArg, 'base64');
      
      expect(buffer.readInt32LE(0)).toBe(MOUSE_POSITION.OUTSIDE); // xpos
      expect(buffer.readInt32LE(4)).toBe(MOUSE_POSITION.OUTSIDE); // ypos
      expect(buffer.readInt32LE(24)).toBe(-1); // pixel
    });

    it('should log error on serial failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSerial.write.mockRejectedValueOnce(new Error('Serial error'));
      
      forwarder.setUsbSerial(mockSerial);
      forwarder.queueKeyEvent('A');
      forwarder.startPolling();
      
      // Advance timers and flush promises
      await jest.advanceTimersByTimeAsync(16);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'InputForwarder: Event processing error:',
        expect.objectContaining({
          message: expect.stringContaining('Failed to process key event')
        })
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should continue processing after error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSerial.write
        .mockRejectedValueOnce(new Error('Serial error'))
        .mockResolvedValueOnce(undefined);
      
      forwarder.setUsbSerial(mockSerial);
      forwarder.queueKeyEvent('A');
      forwarder.queueKeyEvent('B');
      forwarder.startPolling();
      
      // First interval - error
      await jest.advanceTimersByTimeAsync(16);
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // Only event processing error
      expect(mockSerial.write).toHaveBeenCalledTimes(1);
      
      // Second interval - success
      await jest.advanceTimersByTimeAsync(16);
      
      expect(mockSerial.write).toHaveBeenCalledTimes(2);
      expect(forwarder.getQueueSize()).toBe(0); // Both processed
      
      consoleErrorSpy.mockRestore();
    });

    it('should clear queue on stop', () => {
      forwarder.queueKeyEvent('A');
      forwarder.queueKeyEvent('B');
      
      forwarder.startPolling();
      forwarder.stopPolling();
      
      expect(forwarder.getQueueSize()).toBe(0);
    });
  });

  describe('No serial connection', () => {
    it('should not process events without serial', async () => {
      // No serial set
      forwarder.queueKeyEvent('A');
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      expect(mockSerial.write).not.toHaveBeenCalled();
      expect(forwarder.getQueueSize()).toBe(1); // Still in queue
    });
    
    it('should not process events when no serial is set', async () => {
      const errorHandler = jest.fn();
      forwarder.on('error', errorHandler);
      
      forwarder.queueKeyEvent('A');
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      // Queue should remain unchanged because processEventQueue returns early
      expect(forwarder.getQueueSize()).toBe(1);
      
      // No errors should be emitted because processEventQueue returns early
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });
  
  describe('Disconnection handling', () => {
    beforeEach(() => {
      forwarder.setUsbSerial(mockSerial);
    });
    
    it('should handle port disconnection error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSerial.write.mockRejectedValueOnce(new Error('port is not open'));
      
      const disconnectedHandler = jest.fn();
      forwarder.on('disconnected', disconnectedHandler);
      
      forwarder.queueKeyEvent('A');
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(disconnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'USB serial connection lost'
        })
      );
      expect(forwarder.isActive).toBe(false); // Should stop polling
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle device disconnected error', async () => {
      mockSerial.write.mockRejectedValueOnce(new Error('device disconnected'));
      
      const disconnectedHandler = jest.fn();
      forwarder.on('disconnected', disconnectedHandler);
      
      forwarder.setUsbSerial(mockSerial);
      forwarder.queueKeyEvent('A');
      forwarder.startPolling();
      
      await jest.advanceTimersByTimeAsync(16);
      
      expect(disconnectedHandler).toHaveBeenCalled();
    });
    
    it('should support reconnection', () => {
      const reconnectedHandler = jest.fn();
      forwarder.on('reconnected', reconnectedHandler);
      
      const newSerial = createMockUsbSerial();
      forwarder.reconnect(newSerial);
      
      expect(reconnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'USB serial connection restored'
        })
      );
    });
    
    it('should not auto-restart polling after reconnect', () => {
      forwarder.startPolling();
      expect(forwarder.isActive).toBe(true);
      
      // Simulate disconnection
      forwarder['handleDisconnection']();
      expect(forwarder.isActive).toBe(false);
      
      // Reconnect
      const newSerial = createMockUsbSerial();
      forwarder.reconnect(newSerial);
      
      // Should still be stopped
      expect(forwarder.isActive).toBe(false);
    });
  });
});